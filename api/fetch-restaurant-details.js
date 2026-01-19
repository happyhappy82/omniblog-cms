// Vercel Serverless Function for fetching restaurant details
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
    const { url } = req.body;

    console.log('Received URL:', url);

    if (!url || url.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // 페이지 HTML 가져오기
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch restaurant page'
      });
    }

    const html = await response.text();

    // Gemini API를 사용하여 HTML에서 정보 추출
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      // API 키가 없으면 기본 정보만 반환
      return res.json({
        success: true,
        name: '정보 없음',
        address: '정보 없음',
        category: '정보 없음',
        phone: '정보 없음',
        rating: '정보 없음',
        menu: '정보 없음',
        hours: '정보 없음'
      });
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are extracting restaurant information from Naver Place HTML. Extract ALL available information and return ONLY valid JSON.

Instructions:
- Find restaurant name, address, category, phone number
- Find rating/stars (평점, 별점)
- Find menu items with prices (메뉴, 가격) - look for menu sections, price lists
- Find business hours (영업시간, 운영시간) - look for daily schedule
- If information is not found, use "정보 없음"
- Return ONLY the JSON object, no markdown code blocks, no explanation

Required JSON format:
{
  "name": "restaurant name",
  "address": "full address",
  "category": "category type",
  "phone": "phone number or 정보 없음",
  "rating": "rating like 4.5점 or 정보 없음",
  "menu": "menu items with prices, each on new line (use \\n) or 정보 없음",
  "hours": "business hours by day, each on new line (use \\n) or 정보 없음"
}

HTML content:
${html.substring(0, 80000)}

Return ONLY the JSON object:`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API Error:', errorText);
      return res.status(500).json({
        success: false,
        error: `Gemini API 오류: ${geminiResponse.status} ${errorText.substring(0, 200)}`
      });
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini Response:', JSON.stringify(geminiData).substring(0, 500));

    // Gemini API 응답 구조 확인
    if (!geminiData.candidates || !geminiData.candidates[0]) {
      console.error('Invalid Gemini response structure:', geminiData);
      return res.status(500).json({
        success: false,
        error: 'Gemini API 응답 형식이 올바르지 않습니다.'
      });
    }

    let content = geminiData.candidates[0].content.parts[0].text;
    console.log('Gemini raw response:', content.substring(0, 1000));

    // 마크다운 코드 블록 제거 (```json ... ``` 또는 ``` ... ```)
    content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // JSON 추출
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // 전체 응답이 JSON일 수도 있음
      jsonMatch = [content];
    }

    let restaurantInfo;
    try {
      restaurantInfo = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Content that failed to parse:', jsonMatch[0].substring(0, 500));
      return res.status(500).json({
        success: false,
        error: 'Gemini 응답에서 JSON을 찾을 수 없습니다. 다시 시도해주세요.'
      });
    }

    res.json({
      success: true,
      ...restaurantInfo
    });

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
