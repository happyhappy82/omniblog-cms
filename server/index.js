import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 4000;

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID || '2f4753eb-c013-80cc-baac-cd83c8d38866';

app.use(cors());
app.use(express.json());

// Notion API 직접 호출 헬퍼
async function notionFetch(endpoint, options = {}) {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return response.json();
}

/**
 * 제품 목록 조회 (데이터베이스에서)
 * GET /api/notion/products
 */
app.get('/api/notion/products', async (req, res) => {
  try {
    // Notion REST API 직접 호출
    const response = await notionFetch(`/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      body: JSON.stringify({ page_size: 100 }),
    });

    if (response.object === 'error') {
      throw new Error(response.message);
    }

    const products = response.results.map((page, index) => {
      const props = page.properties;
      return {
        id: page.id,
        name: extractTitle(props['제품명']),
        price: extractRichText(props['할인가']),
        coupangLink: extractUrl(props['파트너스 링크']) || extractUrl(props['쿠팡 상품 URL']),
        order: extractNumber(props['순서']) || index + 1,
        rocketDelivery: props['로켓배송']?.checkbox || false,
      };
    });

    res.json({ success: true, products, total: products.length });
  } catch (error) {
    console.error('Notion API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 선택된 제품들의 상세 페이지 내용 조회
 * POST /api/notion/products/details
 * Body: { productIds: string[] }
 */
app.post('/api/notion/products/details', async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({ success: false, error: 'productIds 배열이 필요합니다' });
    }

    // 병렬로 모든 제품의 상세 정보 가져오기
    const detailsPromises = productIds.map(async (pageId) => {
      try {
        // 페이지 기본 정보
        const page = await notionFetch(`/pages/${pageId}`);
        if (page.object === 'error') throw new Error(page.message);

        const props = page.properties;

        // 페이지 블록 내용 (상세 스펙, 장단점 등)
        const blocks = await notionFetch(`/blocks/${pageId}/children?page_size=100`);
        if (blocks.object === 'error') throw new Error(blocks.message);

        // 표(table) 블록의 내용도 가져오기
        const blocksWithTableData = await fetchTableContents(blocks.results || []);

        // 블록 파싱하여 상세 정보 추출
        const details = parseBlocksToDetails(blocksWithTableData);

        return {
          id: pageId,
          name: extractTitle(props['제품명']),
          price: extractRichText(props['할인가']),
          coupangLink: extractUrl(props['파트너스 링크']) || extractUrl(props['쿠팡 상품 URL']),
          order: extractNumber(props['순서']),
          rocketDelivery: props['로켓배송']?.checkbox || false,
          ...details,
        };
      } catch (err) {
        console.error(`Error fetching page ${pageId}:`, err.message);
        return { id: pageId, error: err.message };
      }
    });

    const products = await Promise.all(detailsPromises);
    res.json({ success: true, products });
  } catch (error) {
    console.error('Notion API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 표(table) 블록의 내용을 가져오기
 */
async function fetchTableContents(blocks) {
  const enrichedBlocks = [];

  for (const block of blocks) {
    if (block.type === 'table' && block.has_children) {
      // 표의 행(row) 데이터 가져오기
      const tableRows = await notionFetch(`/blocks/${block.id}/children?page_size=100`);
      if (tableRows.results) {
        block.tableData = tableRows.results.map(row => {
          const cells = row.table_row?.cells || [];
          return cells.map(cell => cell.map(c => c.plain_text || '').join(''));
        });
      }
    }
    enrichedBlocks.push(block);
  }

  return enrichedBlocks;
}

/**
 * 블록 내용에서 전체 페이지 내용을 마크다운 형식으로 추출
 * - 모든 섹션, 표, 리스트 등을 그대로 가져옴
 */
function parseBlocksToDetails(blocks) {
  const contentParts = [];

  for (const block of blocks) {
    const type = block.type;
    let text = '';

    // 제목 (Heading)
    if (type === 'heading_1') {
      text = extractPlainText(block.heading_1?.rich_text);
      if (text) contentParts.push(`\n# ${text}\n`);
    } else if (type === 'heading_2') {
      text = extractPlainText(block.heading_2?.rich_text);
      if (text) contentParts.push(`\n## ${text}\n`);
    } else if (type === 'heading_3') {
      text = extractPlainText(block.heading_3?.rich_text);
      if (text) contentParts.push(`\n### ${text}\n`);
    }

    // 문단 (Paragraph)
    else if (type === 'paragraph') {
      text = extractPlainText(block.paragraph?.rich_text);
      if (text) contentParts.push(text);
    }

    // 번호 리스트
    else if (type === 'numbered_list_item') {
      text = extractPlainText(block.numbered_list_item?.rich_text);
      if (text) contentParts.push(`• ${text}`);
    }

    // 불릿 리스트
    else if (type === 'bulleted_list_item') {
      text = extractPlainText(block.bulleted_list_item?.rich_text);
      if (text) contentParts.push(`• ${text}`);
    }

    // 인용구
    else if (type === 'quote') {
      text = extractPlainText(block.quote?.rich_text);
      if (text) contentParts.push(`> ${text}`);
    }

    // 콜아웃
    else if (type === 'callout') {
      text = extractPlainText(block.callout?.rich_text);
      if (text) contentParts.push(`📌 ${text}`);
    }

    // 토글
    else if (type === 'toggle') {
      text = extractPlainText(block.toggle?.rich_text);
      if (text) contentParts.push(`▶ ${text}`);
    }

    // 코드 블록
    else if (type === 'code') {
      text = extractPlainText(block.code?.rich_text);
      if (text) contentParts.push(`\`\`\`\n${text}\n\`\`\``);
    }

    // 구분선
    else if (type === 'divider') {
      contentParts.push('\n---\n');
    }

    // 표(table) - 마크다운 표 형식으로 변환
    else if (type === 'table' && block.tableData) {
      const tableRows = block.tableData;
      if (tableRows.length > 0) {
        contentParts.push(''); // 빈 줄 추가

        tableRows.forEach((row, rowIndex) => {
          const rowText = '| ' + row.join(' | ') + ' |';
          contentParts.push(rowText);

          // 첫 번째 행 후에 구분선 추가 (헤더)
          if (rowIndex === 0) {
            const separator = '| ' + row.map(() => '---').join(' | ') + ' |';
            contentParts.push(separator);
          }
        });

        contentParts.push(''); // 빈 줄 추가
      }
    }
  }

  // 전체 내용을 하나의 문자열로 합침
  const fullContent = contentParts.join('\n').trim();

  return {
    fullContent,  // 전체 페이지 내용 (마크다운 형식)
    rawContent: fullContent,  // 호환성을 위해 유지
  };
}

// 유틸리티 함수들
function extractPlainText(richText) {
  if (!richText || !Array.isArray(richText)) return '';
  return richText.map(t => t.plain_text || '').join('');
}

function extractTitle(prop) {
  if (!prop) return '';
  if (prop.type === 'title') {
    return extractPlainText(prop.title);
  }
  return '';
}

function extractRichText(prop) {
  if (!prop) return '';
  if (prop.type === 'rich_text') {
    return extractPlainText(prop.rich_text);
  }
  return '';
}

function extractUrl(prop) {
  if (!prop) return '';
  if (prop.type === 'url') {
    return prop.url || '';
  }
  if (prop.type === 'rich_text') {
    return extractPlainText(prop.rich_text);
  }
  return '';
}

function extractNumber(prop) {
  if (!prop) return 0;
  if (prop.type === 'number') {
    return prop.number || 0;
  }
  return 0;
}

/**
 * 노션 페이지 생성
 * POST /api/notion/pages
 * Body: { apiKey, databaseId, title, blocks, scheduledDate? }
 */
app.post('/api/notion/pages', async (req, res) => {
  try {
    const { apiKey, databaseId, title, blocks, scheduledDate } = req.body;

    if (!apiKey || !databaseId || !title) {
      return res.status(400).json({
        success: false,
        error: 'apiKey, databaseId, title이 필요합니다'
      });
    }

    // 페이지 속성 설정
    const properties = {
      title: {
        title: [{ text: { content: title } }]
      },
      // Status를 "Review"로 설정
      'Status': {
        status: { name: 'Review' }
      }
    };

    // 날짜 속성 추가 (있는 경우)
    if (scheduledDate) {
      properties['날짜'] = {
        date: { start: scheduledDate }
      };
    }

    // 노션 API로 페이지 생성
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
        children: blocks || []
      }),
    });

    const data = await response.json();

    if (data.object === 'error') {
      console.error('Notion API Error:', data);
      return res.status(400).json({
        success: false,
        error: data.message || 'Notion API 오류'
      });
    }

    // 페이지 URL 생성
    const pageUrl = data.url || `https://notion.so/${data.id.replace(/-/g, '')}`;

    res.json({
      success: true,
      pageId: data.id,
      pageUrl
    });
  } catch (error) {
    console.error('Page Creation Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '페이지 생성 중 오류가 발생했습니다'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Notion API 서버 실행 중: http://localhost:${PORT}`);
  console.log(`   - GET  /api/notion/products`);
  console.log(`   - POST /api/notion/products/details`);
  console.log(`   - POST /api/notion/pages`);
  console.log(`   - Database ID: ${DATABASE_ID}`);
});
