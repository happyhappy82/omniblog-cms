// Vercel Serverless Function - Google 자동완성 API 사용

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

  try {
    console.log('Keyword analysis request:', keyword);

    // Google Suggest API (자동완성)
    const response = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&q=${encodeURIComponent(keyword)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      console.error('Google Suggest API Error:', response.status);
      return res.status(response.status).json({
        error: `Google API Error: ${response.status}`
      });
    }

    const data = await response.json();
    // Google Suggest 응답 형식: [검색어, [자동완성 배열]]
    const suggestions = data[1] || [];

    // 자동완성 키워드를 형식에 맞게 변환
    const keywords = suggestions.map((suggestion) => ({
      keyword: suggestion,
      searchVolume: 0, // Google Suggest는 검색량 제공 안함
      cpc: 0,
      competition: 0,
      competitionLevel: 'UNKNOWN',
    }));

    console.log(`Found ${keywords.length} autocomplete keywords for "${keyword}"`);

    return res.status(200).json({ keywords });

  } catch (error) {
    console.error('Keyword analysis error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
