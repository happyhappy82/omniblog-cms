// Vercel Serverless Function - Google 자동완성 + DataForSEO 검색량 조회

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

    // 1단계: Google Suggest API로 자동완성 키워드 가져오기
    const suggestResponse = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&q=${encodeURIComponent(keyword)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!suggestResponse.ok) {
      console.error('Google Suggest API Error:', suggestResponse.status);
      return res.status(suggestResponse.status).json({
        error: `Google API Error: ${suggestResponse.status}`
      });
    }

    const suggestData = await suggestResponse.json();
    const suggestions = suggestData[1] || [];

    if (suggestions.length === 0) {
      return res.status(200).json({ keywords: [] });
    }

    console.log(`Found ${suggestions.length} autocomplete keywords for "${keyword}"`);

    // 2단계: DataForSEO로 검색량 조회
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      console.warn('DataForSEO credentials not found, returning keywords without metrics');
      const keywords = suggestions.map((suggestion) => ({
        keyword: suggestion,
        searchVolume: 0,
        cpc: 0,
        competition: 0,
        competitionLevel: 'UNKNOWN',
      }));
      return res.status(200).json({ keywords });
    }

    const auth = Buffer.from(`${login}:${password}`).toString('base64');

    // DataForSEO Search Volume API 호출
    const dataforSeoResponse = await fetch(
      'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          keywords: suggestions,
          language_code: 'ko',
          location_code: 2410 // South Korea
        }])
      }
    );

    const dataforSeoData = await dataforSeoResponse.json();
    console.log('DataForSEO Response:', JSON.stringify(dataforSeoData, null, 2));

    // 태스크 레벨 에러 체크
    if (dataforSeoData.tasks && dataforSeoData.tasks[0]) {
      const task = dataforSeoData.tasks[0];
      if (task.status_code !== 20000) {
        console.error('DataForSEO Task Error:', task.status_code, task.status_message);

        if (task.status_code === 40200) {
          // 결제 필요 - 검색량 없이 키워드만 반환
          console.warn('DataForSEO payment required, returning keywords without metrics');
          const keywords = suggestions.map((suggestion) => ({
            keyword: suggestion,
            searchVolume: 0,
            cpc: 0,
            competition: 0,
            competitionLevel: 'UNKNOWN',
          }));
          return res.status(200).json({ keywords, warning: '검색량 데이터를 가져오려면 DataForSEO 크레딧이 필요합니다.' });
        }

        return res.status(400).json({ error: task.status_message });
      }
    }

    // 검색량 데이터 매핑
    const searchVolumeMap = new Map();
    if (dataforSeoData.tasks?.[0]?.result) {
      for (const item of dataforSeoData.tasks[0].result) {
        searchVolumeMap.set(item.keyword, {
          searchVolume: item.search_volume || 0,
          cpc: item.cpc || 0,
          competition: item.competition || 0,
          competitionLevel: item.competition_level || 'UNKNOWN'
        });
      }
    }

    // 최종 키워드 배열 생성
    const keywords = suggestions.map((suggestion) => {
      const metrics = searchVolumeMap.get(suggestion) || {
        searchVolume: 0,
        cpc: 0,
        competition: 0,
        competitionLevel: 'UNKNOWN'
      };
      return {
        keyword: suggestion,
        ...metrics
      };
    });

    // 검색량 기준 내림차순 정렬
    keywords.sort((a, b) => b.searchVolume - a.searchVolume);

    console.log(`Returning ${keywords.length} keywords with search volume data`);

    return res.status(200).json({ keywords });

  } catch (error) {
    console.error('Keyword analysis error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
