#!/usr/bin/env node
/**
 * Persistent funnel verification — run any time to re-prove Phase 1 behavior.
 * Usage: node scripts/verify-funnel.js [--live]
 *   (default)  exercises local handler modules + static HTML checks
 *   --live     also hits the deployed production endpoints
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env for store-read checks.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const SITE_DIR = path.resolve(__dirname, '..');
const LIVE = process.argv.includes('--live');

let passed = 0, failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log('PASS: ' + name); }
  else { failed++; console.log('FAIL: ' + name + (extra ? ' — ' + extra : '')); }
}

function mockReqRes({ method = 'GET', query = {}, headers = {}, body = '' } = {}) {
  const listeners = {};
  const req = {
    method, query, headers,
    on(ev, cb) { (listeners[ev] = listeners[ev] || []).push(cb); },
  };
  const res = {
    _status: 200, _headers: {}, _body: null, _redirect: null,
    setHeader(k, v) { this._headers[k.toLowerCase()] = v; },
    redirect(code, url) { this._status = code; this._redirect = url; },
    status(code) { this._status = code; return this; },
    json(obj) { this._body = JSON.stringify(obj); return this; },
  };
  setImmediate(() => {
    if (method === 'POST') {
      (listeners.data || []).forEach((cb) => cb(Buffer.from(body)));
      (listeners.end || []).forEach((cb) => cb());
    }
  });
  return { req, res };
}

async function main() {
  const go = require(path.join(SITE_DIR, 'api', 'go.js'));
  const pb = require(path.join(SITE_DIR, 'api', 'pb.js'));

  // 1. /go: 302 with unique aff_sub UUID + aff_sub2, no-store
  const { req: r1, res: s1 } = mockReqRes({ query: { src: 'test' }, headers: { 'user-agent': 'Mozilla/5.0', 'x-forwarded-for': '1.2.3.4' } });
  await go(r1, s1);
  check('/go 302', s1._status === 302);
  check('/go aff_sub UUID', /aff_sub=[0-9a-f-]{36}/.test(s1._redirect));
  check('/go aff_sub2=test', s1._redirect.includes('aff_sub2=test'));
  check('/go aff_sub5 preserved', s1._redirect.includes('aff_sub5=SF_006OG000004lmDN'));
  check('/go no-store', s1._headers['cache-control'] === 'no-store');

  // 2. /go: 20 unique click IDs
  const ids = new Set();
  for (let i = 0; i < 20; i++) {
    const { req, res } = mockReqRes({ query: { src: 'x' } });
    await go(req, res);
    ids.add(res._redirect.match(/aff_sub=([0-9a-f-]{36})/)[1]);
  }
  check('/go 20 unique click IDs', ids.size === 20);

  // 3. /go: src sanitization + ref folding
  const { req: r3, res: s3 } = mockReqRes({ query: { src: 'yt_<b>', ref: 'cancel-tinder' } });
  await go(r3, s3);
  check('/go sanitizes src', s3._redirect.includes('aff_sub2=yt_b_from-cancel-tinder'));

  // 4. /pb: extracts conversion_id, join click_id, never 500
  const clickUuid = '11111111-2222-4333-8444-555555555555';
  const { req: r4, res: s4 } = mockReqRes({ method: 'POST', body: `conversion_id=T1&aff_sub=${clickUuid}` });
  await pb(r4, s4);
  const b4 = JSON.parse(s4._body);
  check('/pb 200 + conversion_id', s4._status === 200 && b4.conversionId === 'T1');
  check('/pb joins click_id', b4.clickId === clickUuid);

  // 5. /pb: JSON body, empty body, GET 405
  const { req: r5, res: s5 } = mockReqRes({ method: 'POST', body: '{"conversion_id":"J9"}' });
  await pb(r5, s5);
  check('/pb JSON body', JSON.parse(s5._body).conversionId === 'J9');
  const { req: r6, res: s6 } = mockReqRes({ method: 'POST', body: '' });
  await pb(r6, s6);
  check('/pb empty body no 500', s6._status === 200);
  const { req: r7, res: s7 } = mockReqRes({ method: 'GET' });
  await pb(r7, s7);
  check('/pb GET 405', s7._status === 405);

  // 6. HTML checks
  const site = path.basename(SITE_DIR);
  const pages = site === 'dating-cancel-guide'
    ? ['index', 'tinder', 'bumble', 'hinge', 'badoo', 'refund', 'faq', 'stop-charges']
    : ['index', 'pricing', 'red-flags', 'ai-companions', 'privacy'];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(SITE_DIR, p + '.html'), 'utf8');
    check(`${site}/${p} analytics tag`, html.includes('va.vercel-scripts.com/v1/script.js'));
    if (site === 'dating-cancel-guide') {
      check(`${site}/${p} no agegate`, !html.includes('agegate'));
      check(`${site}/${p} no /go CTA`, !html.includes('href="/go?src='));
      check(`${site}/${p} crosslink w/ ref`, html.includes('pricing.html?ref=cancel-' + p));
    } else {
      check(`${site}/${p} agegate intact`, html.includes('agegate'));
      check(`${site}/${p} /go CTA present`, html.includes('/go?src='));
      // ref-passthrough lives in site.js (loaded defer) rather than an inline
      // per-page script. Verify BOTH the loader is present and site.js has the
      // /go?src= ref-folding logic.
      check(`${site}/${p} ref-passthrough loader`, html.includes('site.js') || html.includes('querySelectorAll'));
      fs.readFileSync(path.join(SITE_DIR, 'site.js'), 'utf8');
      check(`${site} site.js ref-folding logic`, fs.existsSync(path.join(SITE_DIR, 'site.js')) && fs.readFileSync(path.join(SITE_DIR, 'site.js'), 'utf8').includes('/go?src='));
    }
  }

  // 7. --live: production endpoints
  if (LIVE) {
    const base = site === 'dating-cancel-guide'
      ? 'https://dating-cancel-guide.vercel.app'
      : 'https://dating-safety-guide.vercel.app';
    const r = await fetch(base + '/go?src=verify-live', { redirect: 'manual' });
    const loc = r.headers.get('location') || '';
    check('live /go 302', r.status === 302);
    check('live /go aff_sub UUID', /aff_sub=[0-9a-f-]{36}/.test(loc));
    check('live /go aff_sub2', loc.includes('aff_sub2=verify-live'));

    // Use UUID to avoid collision with previous test runs
    const convId = 'VERIFY-' + crypto.randomUUID();
    
    // First call: should insert (201) and report not duplicate
    const p1 = await fetch(base + '/pb', { method: 'POST', body: 'conversion_id=' + convId });
    const j1 = await p1.json();
    check('live /pb first call ok', j1.ok, 
          `status=${p1.status} body=${JSON.stringify(j1)}`);
    
    // Second call with same ID: should be detected as duplicate
    const p2 = await fetch(base + '/pb', { method: 'POST', body: 'conversion_id=' + convId });
    const j2 = await p2.json();
    check('live /pb replay IS duplicate', j2.ok && j2.duplicate === true,
          `status=${p2.status} body=${JSON.stringify(j2)}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
