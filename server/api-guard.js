// Shared hardening for the serverless API proxies in /api.
//
// Why this exists (2026-10 audit, O-21): both proxies answered
// `Access-Control-Allow-Origin: *` and would relay any request using the
// OWNER's key — api/claude.js had no credential check at all, and
// api/groq.js fell back to a client-supplied key. Any page on the internet
// could therefore spend this project's Anthropic/Groq credits, without an
// account, without a limit and without a trace. A proxy that holds a paid
// key is an authenticated endpoint; this module makes it behave like one.
//
// Everything is env-driven so the owner opts into stricter behaviour without
// a code change:
//   FARM_API_TOKEN   — required from callers that want to use the SERVER key.
//                      If a server key is configured and this is not, the
//                      server key is refused (bring-your-own still works).
//   ALLOWED_ORIGINS  — comma-separated origin allowlist. When unset, only
//                      same-host and *.vercel.app origins are accepted.
//   RATE_LIMIT       — requests per IP per minute (default 30).
//   MAX_BODY_BYTES   — request body cap (default 200 KB).
//   MAX_OUTPUT_TOKENS— clamps the model's completion length (default 4096).

const DEFAULT_RATE = 30;
const DEFAULT_BODY = 200 * 1024;
const DEFAULT_MAX_TOKENS = 4096;

// Best-effort in-memory limiter. Serverless instances are short-lived and
// there may be several of them, so this is a speed bump rather than a hard
// quota — it stops a loop, not a distributed attacker. Deliberately simple:
// no dependency, no external store, no state to leak between cold starts.
const hits = new Map();
function rateLimited(ip, limit) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { hits.set(ip, arr); return true; }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) {                     // never grow without bound
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  }
  return false;
}

function originAllowed(req) {
  const configured = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin || req.headers.referer || '';
  if (!origin) return true;                    // curl / server-to-server: no Origin header
  let host = '';
  try { host = new URL(origin).host; } catch (e) { return false; }
  if (configured.length) return configured.some((o) => {
    try { return new URL(o).host === host; } catch (e) { return o === host; }
  });
  const reqHost = (req.headers.host || '').split(':')[0];
  return host === reqHost || /\.vercel\.app$/i.test(host);
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Returns {ok:true, mode} or {ok:false, status, error}. `mode` is 'server-key'
// (the proxy pays) or 'byo' (the caller brought their own key).
function authorize(req, { serverKey, headerKey }) {
  const ip = clientIp(req);
  const limit = Number(process.env.RATE_LIMIT || DEFAULT_RATE);
  if (rateLimited(ip, limit)) {
    return { ok: false, status: 429, error: 'معدل الطلبات مرتفع — حاول بعد دقيقة. (rate limit: ' + limit + '/min)' };
  }
  if (!originAllowed(req)) {
    return { ok: false, status: 403, error: 'Origin not allowed. Set ALLOWED_ORIGINS to include this deployment.' };
  }

  const suppliedKey = typeof headerKey === 'string' ? headerKey.trim() : '';
  const token = (req.headers['x-farm-token'] || '').trim();
  const configuredToken = (process.env.FARM_API_TOKEN || '').trim();

  // 1 · the caller brought their own key: their cost, their quota. Still
  //    rate-limited and origin-checked, but no server secret is involved.
  if (suppliedKey) return { ok: true, mode: 'byo', apiKey: suppliedKey, ip };

  // 2 · the caller wants the SERVER key: it must be paid for with a token the
  //    browser does not have. If no token is configured we refuse rather than
  //    run an open relay — that refusal is the fix for O-21.
  if (serverKey) {
    if (!configuredToken) {
      return {
        ok: false, status: 403,
        error: 'Server key is configured but FARM_API_TOKEN is not. Set FARM_API_TOKEN in the ' +
               'Vercel environment and send it as x-farm-token, or let callers send their own ' +
               'key via x-user-key. Refusing to act as an open relay.'
      };
    }
    if (!timingSafeEqual(token, configuredToken)) {
      return { ok: false, status: 401, error: 'Invalid or missing x-farm-token.' };
    }
    return { ok: true, mode: 'server-key', apiKey: serverKey, ip };
  }

  return { ok: false, status: 500, error: 'No key available: set the provider key in Vercel environment variables, or send your own via x-user-key.' };
}

function setCors(req, res) {
  const origin = req.headers.origin;
  // Echo the specific origin instead of "*" so credentials-bearing requests
  // stay impossible from arbitrary sites while the app itself keeps working.
  res.setHeader('Access-Control-Allow-Origin', originAllowed(req) && origin ? origin : 'null');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-key, x-farm-token');
  res.setHeader('Access-Control-Max-Age', '600');
}

// Bounds what a caller can ask the model for, so one request cannot run up an
// unbounded bill.
function clampBody(body) {
  const max = Number(process.env.MAX_OUTPUT_TOKENS || DEFAULT_MAX_TOKENS);
  if (body && typeof body === 'object') {
    if (typeof body.max_tokens === 'number' && body.max_tokens > max) body.max_tokens = max;
    if (body.max_completion_tokens && Number(body.max_completion_tokens) > max) body.max_completion_tokens = max;
  }
  return body;
}

function bodyTooLarge(req) {
  const cap = Number(process.env.MAX_BODY_BYTES || DEFAULT_BODY);
  const len = Number(req.headers['content-length'] || 0);
  if (len && len > cap) return cap;
  try {
    const size = Buffer.byteLength(JSON.stringify(req.body || {}));
    return size > cap ? cap : 0;
  } catch (e) { return 0; }
}

module.exports = { authorize, setCors, clampBody, bodyTooLarge, clientIp, DEFAULT_MAX_TOKENS };
