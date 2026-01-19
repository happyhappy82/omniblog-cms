// Vercel Serverless Function for Naver Place Search
export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { query, clientId, clientSecret } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    // 네이버 API 키 확인 (환경 변수 또는 요청에서)
    const NAVER_CLIENT_ID = clientId || process.env.NAVER_CLIENT_ID;
    const NAVER_CLIENT_SECRET = clientSecret || process.env.NAVER_CLIENT_SECRET;

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      return res.status(400).json({
        success: false,
        error: 'Naver API credentials not configured'
      });
    }

    // 네이버 지역 검색 API 호출 (한 번에 5개 제한, 여러 번 호출로 20개까지 가져오기)
    const allResults = [];
    const maxResults = 20;
    const displayPerRequest = 5;

    // 4번 호출하여 최대 20개 결과 가져오기
    for (let i = 0; i < 4; i++) {
      const start = i * displayPerRequest + 1;
      const apiUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${displayPerRequest}&start=${start}&sort=random`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
        }
      });

      if (!response.ok) {
        // 첫 번째 요청이 실패하면 에러 반환
        if (i === 0) {
          const errorData = await response.json();
          console.error('Naver API Error:', errorData);
          return res.status(response.status).json({
            success: false,
            error: errorData.errorMessage || 'Naver API request failed'
          });
        }
        // 이후 요청 실패는 무시하고 이미 가져온 결과 사용
        break;
      }

      const data = await response.json();

      // 더 이상 결과가 없으면 중단
      if (!data.items || data.items.length === 0) {
        break;
      }

      allResults.push(...data.items);

      // 최대 개수에 도달하면 중단
      if (allResults.length >= maxResults) {
        break;
      }
    }

    console.log('Naver API Total Results:', allResults.length);

    // 결과를 간단한 형식으로 변환
    const results = allResults.slice(0, maxResults).map(item => {
      console.log('Item link:', item.link);
      return {
        title: item.title.replace(/<\/?b>/g, ''), // HTML 태그 제거
        link: item.link || '',
        address: item.address || item.roadAddress || '',
        category: item.category || '',
        phone: item.telephone || ''
      };
    });

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
