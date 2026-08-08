// Shared Supabase REST helpers for /go and /pb.
// Zero npm deps — uses Node 18+ built-in fetch.
//
// Env vars (set in Vercel dashboard / CLI, never committed):
//   SUPABASE_URL              e.g. https://duncigipcjmvxwgmboxg.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY service_role JWT (bypasses RLS; server-only)
//
// Tables (SQL in schema.sql, created once in Supabase SQL editor):
//   clicks(click_id uuid PK, src text, ts timestamptz, ip text, country text,
//          device text, ua text, referrer text, dest_url text, site text)
//   conversions(conversion_id text PK, click_id uuid NULL, ts timestamptz,
//               raw_body text)
// PostgREST upsert with Prefer: resolution=ignore-duplicates makes a replayed
// postback a silent no-op (HTTP 201, 0 rows) while the raw body still lands
// in postback_log first (append-only audit trail).

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function deviceClass(ua) {
  ua = (ua || '').toLowerCase();
  if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(ua)) return 'mobile';
  if (/ipad|android(?!.*mobile)|tablet/.test(ua)) return 'tablet';
  return 'desktop';
}

// Fire-and-forget safe insert: resolves {ok, status, duplicate} instead of throwing.
// - clicks: POST with return=minimal (we don't need the row back)
// - conversions: PATCH (upsert) with resolution=ignore-duplicates for idempotency
//   PATCH on /rest/v1/table?key=eq.value is the PostgREST upsert pattern
async function sbInsert(table, row, { upsertIgnore = false } = {}) {
  if (!supabaseConfigured()) {
    return { ok: false, status: 0, error: 'supabase not configured' };
  }
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
  };
  
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    
    let res;
    if (upsertIgnore) {
      // For idempotent conversion inserts: use POST with Prefer: resolution=ignore-duplicates,return=representation
      // POST inserts new rows; if the row already exists (PK conflict), it's ignored (204)
      // return=representation ensures we get 201 with the row on insert, 204 on duplicate
      headers.Prefer = 'resolution=ignore-duplicates,return=representation';
      res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(row),
        signal: ctrl.signal,
      });
    } else {
      headers.Prefer = 'return=minimal';
      res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(row),
        signal: ctrl.signal,
      });
    }
    
    clearTimeout(timer);
    // POST with resolution=ignore-duplicates,return=representation:
    // 201 = inserted (body contains the row), 201 with empty body [] = duplicate ignored
    // We detect duplicates by checking if the response body is empty
    let body = '';
    try { body = await res.text(); } catch (e) { /* ignore */ }
    const duplicate = upsertIgnore && res.status === 201 && (body === '' || body === '[]');
    return { ok: res.ok, status: res.status, duplicate };
  } catch (e) {
    return { ok: false, status: 0, error: String(e && e.message || e) };
  }
}

module.exports = { supabaseConfigured, deviceClass, sbInsert, SUPABASE_URL };
