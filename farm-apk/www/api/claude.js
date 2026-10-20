// Vercel Serverless Function — Anthropic API Proxy (CommonJS)
//
// SECURITY FIX (2026-10 audit, O-21): this endpoint held ANTHROPIC_API_KEY and
// answered `Access-Control-Allow-Origin: *` with no credential of any kind —
// anyone who found the URL could spend the owner's Anthropic credits, without
// an account and without a limit. It now goes through the same guard as
// api/groq.js: origin allowlist, per-IP rate limit, body cap, token clamp, and
// a required FARM_API_TOKEN for any caller that wants to use the SERVER key
// (a caller may instead bring their own key via x-user-key).
const guard = require('../server/api-guard');

module.exports = async function handler(req, res) {
  guard.setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const tooLarge = guard.bodyTooLarge(req);
  if (tooLarge) return res.status(413).json({ error: 'Request body too large (limit ' + tooLarge + ' bytes).' });

  const auth = guard.authorize(req, {
    serverKey: process.env.ANTHROPIC_API_KEY || '',
    headerKey: req.headers['x-user-key'],
  });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key':         auth.apiKey,     // never a client-supplied header
      },
      body: JSON.stringify(guard.clampBody(req.body)),
    });

    const data = await response.json().catch(() => ({ error: 'upstream returned a non-JSON body' }));
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream request failed: ' + err.message });
  }
};
