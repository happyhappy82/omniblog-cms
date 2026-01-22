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

// DataForSEO API 프록시 엔드포인트 (키워드 분석)
app.post('/api/keyword-analysis', async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
    const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
      return res.status(500).json({ error: 'DataForSEO API credentials not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in .env' });
    }

    // Base64 encode credentials
    const credentials = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

    console.log('Keyword analysis request:', keyword);

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

    console.log(`Found ${keywords.length} related keywords for "${keyword}"`);

    return res.status(200).json({ keywords });

  } catch (error) {
    console.error('Keyword analysis error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Notion Proxy Server running on http://localhost:${PORT}`);
});
