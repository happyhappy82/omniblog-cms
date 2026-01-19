// Vercel Serverless Function for fetching Google Place details
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
    const { placeId } = req.body;

    console.log('Received placeId:', placeId);

    if (!placeId || placeId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Place ID is required'
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

    // Google Places Details API 호출
    const fields = 'name,formatted_address,formatted_phone_number,rating,opening_hours,price_level,types,website,url';
    const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=ko&key=${GOOGLE_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Places API Error:', errorText);
      return res.status(500).json({
        success: false,
        error: `Google Places API 오류: ${response.status}`
      });
    }

    const data = await response.json();
    console.log('Google Places Response status:', data.status);

    if (data.status !== 'OK') {
      console.error('Google Places API Status:', data.status);
      return res.status(400).json({
        success: false,
        error: `Google Places API error: ${data.status}`
      });
    }

    const place = data.result;

    // 영업시간 포맷팅
    let hours = '정보 없음';
    if (place.opening_hours && place.opening_hours.weekday_text) {
      hours = place.opening_hours.weekday_text.join('\n');
    }

    // 카테고리
    const category = place.types ? place.types.slice(0, 2).join(', ') : '정보 없음';

    // 가격 수준
    let priceLevel = '정보 없음';
    if (place.price_level !== undefined) {
      const levels = ['무료', '저렴', '보통', '비쌈', '매우 비쌈'];
      priceLevel = levels[place.price_level] || '정보 없음';
    }

    res.json({
      success: true,
      name: place.name || '정보 없음',
      address: place.formatted_address || '정보 없음',
      category: category,
      phone: place.formatted_phone_number || '정보 없음',
      rating: place.rating ? `${place.rating}점` : '정보 없음',
      menu: `가격대: ${priceLevel}`,
      hours: hours,
      website: place.website || '',
      googleMapsUrl: place.url || ''
    });

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
