// Vercel Serverless Function — Groq (GroqCloud) API Proxy (CommonJS)
//
// NOTE: this is Groq (console.groq.com — fast inference for open models),
// NOT Grok (xAI). Similar names, different companies.
//
// Purpose: assistant.html calls https://api.groq.com/openai/v1/chat/completions
// directly from the browser first. If the browser blocks that (cross-origin),
// it automatically retries against this same-origin endpoint instead.
//
// Key resolution (2026-10 audit, O-21 — see server/api-guard.js):
//   1. 'x-user-key' request header — the caller's OWN key: their quota, their
//      bill. This is what assistant.html sends today, so nothing about the
//      existing UX changes.
//   2. process.env.GROQ_API_KEY — the OWNER's key, and only for callers that
//      also present FARM_API_TOKEN via 'x-farm-token'. Before this change any
//      page on the internet could relay through here with CORS "*" and spend
//      the owner's credits; now that path requires a token the browser does
//      not have, and if no token is configured the server key is refused
//      outright instead of becoming an open relay.
//
// Also new: an origin allowlist, a per-IP rate limit, a body-size cap and a
// clamp on requested completion tokens.
const guard = require('../server/api-guard');

module.exports = async function handler(req, res) {
  guard.setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const tooLarge = guard.bodyTooLarge(req);
  if (tooLarge) return res.status(413).json({ error: 'Request body too large (limit ' + tooLarge + ' bytes).' });

  const auth = guard.authorize(req, {
    serverKey: process.env.GROQ_API_KEY || '',
    headerKey: req.headers['x-user-key'],
  });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        // Built here, never forwarded from the client: an inbound
        // Authorization header is dropped so it cannot be smuggled through.
        'Authorization': 'Bearer ' + auth.apiKey,
      },
      body: JSON.stringify(guard.clampBody(req.body)),
    });

    const data = await response.json().catch(() => ({ error: 'upstream returned a non-JSON body' }));
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream request failed: ' + err.message });
  }
};
