// Vercel Serverless Function for Notion API proxy
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
    const { apiKey, databaseId, title, blocks, scheduledDate } = req.body;

    console.log('Received scheduledDate:', scheduledDate);

    if (!apiKey || !databaseId || !title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // properties 객체 구성
    const properties = {
      title: {
        title: [
          {
            text: {
              content: title
            }
          }
        ]
      },
      Status: {
        status: {
          name: 'Review'
        }
      }
    };

    // scheduledDate가 있으면 Date 속성 추가
    if (scheduledDate) {
      // ISO 8601 형식으로 변환
      const dateObj = new Date(scheduledDate);

      // 노션은 ISO 8601 형식을 요구: YYYY-MM-DDTHH:mm:ss.sssZ 또는 YYYY-MM-DD
      // 시간이 있는 경우: 전체 ISO 문자열 사용
      // 시간이 없는 경우: 날짜만 사용 (YYYY-MM-DD)
      let dateStart;

      if (scheduledDate.includes('T') || scheduledDate.includes(':')) {
        // 시간 포함된 경우: ISO 8601 형식으로 변환
        dateStart = dateObj.toISOString();
      } else {
        // 날짜만 있는 경우
        dateStart = scheduledDate;
      }

      console.log('Setting Date property:', {
        original: scheduledDate,
        converted: dateStart,
        type: typeof dateStart
      });

      properties.Date = {
        date: {
          start: dateStart
        }
      };

      console.log('Date property object:', JSON.stringify(properties.Date, null, 2));
    } else {
      console.log('No scheduledDate provided');
    }

    const requestBody = {
      parent: {
        type: 'database_id',
        database_id: databaseId
      },
      properties,
      children: blocks
    };

    console.log('Notion API Request Body:', JSON.stringify(requestBody, null, 2));

    // Notion API 호출
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Notion API Error:', data);
      return res.status(response.status).json({
        success: false,
        error: data.message || `HTTP ${response.status}: ${response.statusText}`
      });
    }

    console.log('Notion API Success Response:', JSON.stringify(data, null, 2));

    res.json({
      success: true,
      pageUrl: data.url
    });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
