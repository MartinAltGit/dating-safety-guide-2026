// Postback endpoint for CrakRevenue conversion webhooks.
// - Idempotent on the network's conversion ID: `conversions` has conversion_id
//   as PRIMARY KEY and we upsert with resolution=ignore-duplicates, so a
//   replayed postback stores nothing new and is reported as duplicate.
// - Raw body always lands in append-only `postback_log` first (audit trail).
// - Extracts click_id (our aff_sub) so conversions join back to clicks.
// - Never 500 on unexpected input; accept, log, move on.
const { createHash } = require('crypto');
const { sbInsert } = require('./_supabase');

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { if (body.length < 65536) body += c; });
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(body));
    setTimeout(() => resolve(body), 3000);
  });
}

function pickId(obj) {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of ['conversion_id', 'transaction_id', 'order_id', 'id', 'lead_id', 's1']) {
    if (obj[k]) return String(obj[k]).slice(0, 128);
  }
  return '';
}

function pickClick(obj) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of ['aff_sub', 'sub_id', 'subid', 'click_id', 's2']) {
    const v = obj[k];
    if (v && /^[0-9a-fA-F-]{36}$/.test(String(v))) return String(v);
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const ts = new Date().toISOString();
  const body = await readBody(req);

  let parsed = null;
  try { parsed = JSON.parse(body); } catch (e) { /* not JSON */ }
  if (!parsed) {
    try { parsed = Object.fromEntries(new URLSearchParams(body)); } catch (e) { /* not form */ }
  }
  if (!parsed && req.query && Object.keys(req.query).length) parsed = req.query;

  const conversionId = pickId(parsed) ||
    'sha256:' + createHash('sha256').update(body + '|' + (req.headers['user-agent'] || '')).digest('hex').slice(0, 32);
  const clickId = pickClick(parsed);
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 45);
  const ua = String(req.headers['user-agent'] || '').slice(0, 300);

  // 1. Append-only audit log: raw body, always.
  const logWrite = sbInsert('postback_log', {
    conversion_id: conversionId, click_id: clickId, ts, ip, ua,
    raw_body: body.slice(0, 16000),
  });

  // 2. Idempotent conversion record.
  const convWrite = sbInsert(
    'conversions',
    { conversion_id: conversionId, click_id: clickId, ts, raw_body: body.slice(0, 16000) },
    { upsertIgnore: true }
  );

  const [logR, convR] = await Promise.all([logWrite, convWrite]);
  const duplicate = Boolean(convR.duplicate);

  console.log(JSON.stringify({
    event: duplicate ? 'POSTBACK_DUPLICATE' : 'POSTBACK',
    conversionId, clickId, ts, storeOk: convR.ok, storeStatus: convR.status,
    logOk: logR.ok,
  }));

  res.status(200).json({ ok: true, conversionId, clickId, duplicate, ts });
};
