// Click-tracking redirect with per-click attribution + Supabase persistence.
// - Mints a UUID per click, sent as aff_sub (opaque to upstream).
// - Keeps aff_sub2 = src (page/video/source).
// - Persists one append-only row to Supabase `clicks` (fire-and-forget:
//   the redirect must never be blocked or broken by a store failure).
// - `?ref=<origin>` from cross-site links is folded into src.
const { randomUUID } = require('crypto');
const { deviceClass, sbInsert } = require('./_supabase');
const BASE = 'https://t.datsk9.com/163898/9986/0?po=6456&aff_sub5=SF_006OG000004lmDN';
const SITE = process.env.SITE_NAME || 'unknown';

module.exports = async (req, res) => {
  const src = String(req.query.src || 'direct').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'direct';
  const ref = String(req.query.ref || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const srcFull = ref ? src + '_from-' + ref : src;
  const ua = String(req.headers['user-agent'] || '').slice(0, 300);
  const geo = String(req.headers['x-vercel-ip-country'] || '').slice(0, 8);
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 45);
  const referrer = String(req.headers['referer'] || req.headers['referrer'] || '').slice(0, 500);
  const clickId = randomUUID();
  const ts = new Date().toISOString();
  const target = BASE + '&aff_sub=' + clickId + '&aff_sub2=' + encodeURIComponent(srcFull);

  const row = {
    click_id: clickId, src: srcFull, ts, ip, country: geo,
    device: deviceClass(ua), ua, referrer, dest_url: target, site: SITE,
  };
  // Fire-and-forget: do not await the write before redirecting.
  sbInsert('clicks', row).then((r) => {
    if (!r.ok) console.log(JSON.stringify({ event: 'CLICK_STORE_FAIL', clickId, status: r.status, error: r.error || '' }));
  });

  console.log(JSON.stringify({ event: 'CLICK', clickId, src: srcFull, geo, ip, ua: ua.slice(0, 120), ts }));
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, target);
};
