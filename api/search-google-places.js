// Vercel Serverless Function for Google Places Search
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
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    // Google API 키 확인
    const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

    if (!GOOGLE_API_KEY) {
      return res.status(400).json({
        success: false,
        error: 'Google Places API key not configured'
      });
    }

    // Google Places Text Search API 호출
    const apiUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=ko&key=${GOOGLE_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Places API Error:', errorData);
      return res.status(response.status).json({
        success: false,
        error: errorData.error_message || 'Google Places API request failed'
      });
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API Status:', data.status);
      return res.status(400).json({
        success: false,
        error: `Google Places API error: ${data.status}`
      });
    }

    // 결과를 간단한 형식으로 변환 (최대 20개)
    const results = (data.results || []).slice(0, 20).map(place => ({
      title: place.name,
      placeId: place.place_id,
      address: place.formatted_address || '',
      category: place.types?.[0] || '',
      rating: place.rating ? `${place.rating}점` : ''
    }));

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
