// Vercel Serverless Function — Groq (GroqCloud) API Proxy (CommonJS)
//
// NOTE: this is Groq (console.groq.com — fast inference for open models),
// NOT Grok (xAI). Similar names, different companies.
//
// Purpose: assistant.html calls https://api.groq.com/openai/v1/chat/completions
// directly from the browser first. If the browser blocks that (cross-origin),
// it automatically retries against this same-origin endpoint instead.
//
// Key resolution order:
//   1. process.env.GROQ_API_KEY  — preferred: the key never leaves the server.
//   2. the 'x-user-key' request header — fallback that preserves this app's
//      existing "each user brings their own key" model (the key is already in
//      that user's own localStorage, exactly as the Gemini setup worked).
//
// Deliberately mirrors api/claude.js's structure rather than introducing a
// second, different proxy style in the same folder.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY || req.headers['x-user-key'];
  if (!apiKey) {
    return res.status(500).json({
      error: 'No Groq key: set GROQ_API_KEY in Vercel environment variables, or send x-user-key.'
    });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
