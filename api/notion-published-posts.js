// Vercel Serverless Function for fetching published posts from Notion
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
    const { apiKey, databaseId, searchQuery, limit = 50 } = req.body;

    if (!apiKey || !databaseId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: apiKey, databaseId'
      });
    }

    // 오늘 날짜 (YYYY-MM-DD 형식)
    const today = new Date().toISOString().split('T')[0];

    // Notion API 필터: Status = Published AND Date <= 오늘
    const baseFilters = [
      {
        property: 'Status',
        status: {
          equals: 'Published'
        }
      },
      {
        property: 'Date',
        date: {
          on_or_before: today
        }
      }
    ];

    // 검색어가 있으면 제목 필터 추가
    const filters = searchQuery
      ? [
          ...baseFilters,
          {
            property: 'title',
            rich_text: {
              contains: searchQuery
            }
          }
        ]
      : baseFilters;

    const requestBody = {
      filter: { and: filters },
      sorts: [
        {
          timestamp: 'created_time',
          direction: 'descending'
        }
      ],
      page_size: Math.min(limit, 100) // Notion API 최대 100
    };

    // Notion API 호출
    const response = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(requestBody)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Notion API Error:', data);
      return res.status(response.status).json({
        success: false,
        error: data.message || `HTTP ${response.status}: ${response.statusText}`
      });
    }

    // 결과 파싱
    const posts = (data.results || []).map(page => {
      const properties = page.properties;

      // 제목 추출 - title 타입 속성 찾기
      let title = '';
      for (const [key, prop] of Object.entries(properties)) {
        if (prop && prop.type === 'title' && prop.title) {
          title = prop.title.map(t => t.plain_text || '').join('');
          break;
        }
      }

      // Date 속성 추출
      let publishDate = page.created_time; // 기본값은 생성일
      if (properties.Date?.date?.start) {
        publishDate = properties.Date.date.start;
      } else if (properties['날짜']?.date?.start) {
        publishDate = properties['날짜'].date.start;
      }

      // 태그 추출 (multi_select 또는 Tags 속성)
      let tags = [];
      if (properties.Tags?.multi_select) {
        tags = properties.Tags.multi_select.map(tag => tag.name);
      } else if (properties.tags?.multi_select) {
        tags = properties.tags.multi_select.map(tag => tag.name);
      } else if (properties['태그']?.multi_select) {
        tags = properties['태그'].multi_select.map(tag => tag.name);
      }

      return {
        pageId: page.id,
        title,
        createdTime: publishDate,  // Date 속성 값 사용
        tags
      };
    });

    res.json({
      success: true,
      posts,
      total: posts.length,
      hasMore: data.has_more,
      nextCursor: data.next_cursor
    });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
