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

    console.log('DataForSEO Response:', JSON.stringify(data, null, 2));

    // Check task-level status first (more specific errors)
    const tasks = data.tasks || [];
    if (tasks.length > 0) {
      const task = tasks[0];
      if (task.status_code !== 20000) {
        const errorMsg = task.status_code === 40200
          ? 'DataForSEO 크레딧이 부족합니다. 계정을 충전해주세요.'
          : `${task.status_message || 'Unknown error'} (code: ${task.status_code})`;
        console.error('DataForSEO Task Error:', task.status_message, task.status_code);
        return res.status(400).json({ error: errorMsg });
      }
    }

    // Check HTTP response
    if (!response.ok) {
      console.error('DataForSEO HTTP Error:', response.status);
      return res.status(response.status).json({
        error: `HTTP Error: ${response.status}`
      });
    }

    // Check for API-level errors
    if (data.status_code !== 20000) {
      return res.status(400).json({
        error: `API Error: ${data.status_message || 'Unknown error'} (code: ${data.status_code})`
      });
    }

    // Extract keywords from response
    if (tasks.length === 0) {
      return res.status(200).json({ keywords: [] });
    }

    const task = tasks[0];
    if (!task.result || task.result.length === 0) {
      return res.status(200).json({ keywords: [] });
    }

    const result = task.result[0];
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
