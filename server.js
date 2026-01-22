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

// 키워드 분석 - Google 자동완성 + DataForSEO 검색량 조회
app.post('/api/keyword-analysis', async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

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
});

app.listen(PORT, () => {
  console.log(`🚀 Notion Proxy Server running on http://localhost:${PORT}`);
});
