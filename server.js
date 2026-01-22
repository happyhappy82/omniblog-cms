import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// .env.local 파일 로드
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3007;

// CORS 허용
app.use(cors());
app.use(express.json());

// Notion API 프록시 엔드포인트
app.post('/api/notion/pages', async (req, res) => {
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
      try {
        // ISO 8601 형식으로 변환
        const dateObj = new Date(scheduledDate);

        // 유효한 날짜인지 확인
        if (isNaN(dateObj.getTime())) {
          console.error('Invalid scheduledDate:', scheduledDate);
        } else {
          // 노션 API는 ISO 8601 형식 요구
          // 시간대 정보를 포함한 전체 ISO 문자열 사용
          const dateStart = dateObj.toISOString();

          console.log('Setting Date property:', {
            original: scheduledDate,
            converted: dateStart,
            dateObj: dateObj.toString()
          });

          properties.Date = {
            date: {
              start: dateStart
            }
          };

          console.log('Final Date property:', JSON.stringify(properties.Date, null, 2));
        }
      } catch (error) {
        console.error('Error processing scheduledDate:', error);
      }
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

    console.log('Notion API Response Status:', response.status);
    console.log('Notion API Full Response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('Notion API Error:', data);
      return res.status(response.status).json({
        success: false,
        error: data.message || `HTTP ${response.status}: ${response.statusText}`
      });
    }

    // 성공 응답에서 properties 확인
    if (data.properties && data.properties.Date) {
      console.log('✅ Date property in response:', JSON.stringify(data.properties.Date, null, 2));
    } else {
      console.warn('⚠️ Date property NOT found in response!');
      console.log('Available properties:', Object.keys(data.properties || {}));
    }

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
});

// 키워드 분석 - Google 자동완성 API 사용 (무료)
app.post('/api/keyword-analysis', async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

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
    const keywords = suggestions.map((suggestion, index) => ({
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
});

app.listen(PORT, () => {
  console.log(`🚀 Notion Proxy Server running on http://localhost:${PORT}`);
});
