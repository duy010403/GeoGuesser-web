// api/mapkey.js
export default function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from environment variable
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('❌ GOOGLE_MAPS_API_KEY not found in environment variables');
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Return the API key
  res.status(200).json({ 
    apiKey: apiKey,
    status: 'success'
  });
}