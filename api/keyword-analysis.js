// Vercel Serverless Function for DataForSEO API
// Related Keywords API: https://docs.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { keyword } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
  const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    return res.status(500).json({ error: 'DataForSEO API credentials not configured' });
  }

  try {
    // Base64 encode credentials
    const credentials = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

    // DataForSEO Related Keywords API
    const response = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          keyword: keyword,
          language_code: 'ko',
          location_code: 2410, // South Korea
          include_seed_keyword: true,
          include_serp_info: false,
          limit: 50,
        }
      ]),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('DataForSEO API Error:', data);
      return res.status(response.status).json({
        error: data.status_message || 'DataForSEO API request failed'
      });
    }

    // Check for API-level errors
    if (data.status_code !== 20000) {
      return res.status(400).json({
        error: data.status_message || 'DataForSEO API returned an error'
      });
    }

    // Extract keywords from response
    const tasks = data.tasks || [];
    if (tasks.length === 0 || !tasks[0].result) {
      return res.status(200).json({ keywords: [] });
    }

    const result = tasks[0].result[0];
    const items = result?.items || [];

    // Transform and sort by search volume
    const keywords = items
      .map(item => ({
        keyword: item.keyword_data?.keyword || item.keyword || '',
        searchVolume: item.keyword_data?.keyword_info?.search_volume || 0,
        cpc: item.keyword_data?.keyword_info?.cpc || 0,
        competition: item.keyword_data?.keyword_info?.competition || 0,
        competitionLevel: item.keyword_data?.keyword_info?.competition_level || 'UNKNOWN',
      }))
      .filter(kw => kw.keyword && kw.searchVolume > 0)
      .sort((a, b) => b.searchVolume - a.searchVolume);

    return res.status(200).json({ keywords });

  } catch (error) {
    console.error('Keyword analysis error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
