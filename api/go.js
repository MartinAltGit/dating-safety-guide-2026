// Click-tracking redirect with per-click attribution + Supabase persistence.
// Cams-only: redirects to Cam smartlink (Video Uploads default; Posts for social src).
// - Mints a UUID per click, sent as aff_sub (opaque to upstream).
// - Keeps aff_sub2 = src (page/video/source).
// - Persists one append-only row to Supabase `clicks` (fire-and-forget:
//   the redirect must never be blocked or broken by a store failure).
// - `?ref=<origin>` from cross-site links is folded into src.
// Cam lander (cam.html) builds the same URLs client-side with an age gate;
// /go remains for legacy links, compare submit, and API callers.
const { randomUUID } = require('crypto');
const { deviceClass, sbInsert } = require('./_supabase');
const CAM_VIDEO = 'https://t.frtayb.com/163898/3664/0?target=videouploads&po=6533&aff_sub5=SF_006OG000004lmDN';
const CAM_POSTS = 'https://t.frtayb.com/163898/3664/0?target=posts&po=6533&aff_sub5=SF_006OG000004lmDN';
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
  const social = /^(reddit|forum|quora|social|post)/i.test(src);
  const base = social ? CAM_POSTS : CAM_VIDEO;
  const target = base + '&aff_sub=' + clickId + '&aff_sub2=' + encodeURIComponent(srcFull);

  const row = {
    click_id: clickId, src: srcFull, ts, ip, country: geo,
    device: deviceClass(ua), ua, referrer, dest_url: target, site: SITE,
  };
  // Fire-and-forget: do not await the write before redirecting.
  sbInsert('clicks', row).then((r) => {
    if (!r.ok) console.log(JSON.stringify({ event: 'CLICK_STORE_FAIL', clickId, status: r.status, error: r.error || '' }));
  });

  console.log(JSON.stringify({ event: 'CLICK', clickId, src: srcFull, target: social ? 'posts' : 'videouploads', geo, ip, ua: ua.slice(0, 120), ts }));
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, target);
};
