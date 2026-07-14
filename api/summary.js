export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Cle API non configuree' });

  try {
    var bodyStr = JSON.stringify(req.body);
    console.log('Summary - body size:', Math.round(bodyStr.length / 1024), 'KB');

    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: bodyStr,
    });

    var data = await response.json();
    if (!response.ok) console.error('Anthropic error:', response.status, JSON.stringify(data).slice(0, 300));
    return res.status(response.status).json(data);
  } catch (e) {
    console.error('Summary crash:', e.message);
    return res.status(500).json({ error: e.message });
  }
}