interface NotionBlock {
  object: 'block';
  type: string;
  [key: string]: any;
}

/**
 * 마크다운 표를 파싱하여 노션 테이블 블록으로 변환
 */
function parseMarkdownTable(lines: string[], startIndex: number): { block: NotionBlock; endIndex: number } | null {
  const tableLines: string[] = [];
  let i = startIndex;

  // 표 라인 수집 (| 로 시작하는 연속된 라인들)
  while (i < lines.length && lines[i].trim().startsWith('|')) {
    tableLines.push(lines[i].trim());
    i++;
  }

  if (tableLines.length < 2) return null; // 최소 헤더 + 구분선 필요

  // 각 행을 셀로 분할
  const rows = tableLines.map(line => {
    return line
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell !== ''); // 빈 셀 제거 (양 끝 | 때문에 생기는)
  });

  // 구분선 제거 (|---|---| 형태)
  const dataRows = rows.filter(row => !row.every(cell => /^[-:| ]+$/.test(cell)));

  if (dataRows.length === 0) return null;

  // 헤더와 데이터 분리
  const hasHeader = tableLines.length > 1 && /^[|\s:-]+$/.test(tableLines[1]);
  const headerRow = hasHeader ? dataRows[0] : null;
  const bodyRows = hasHeader ? dataRows.slice(1) : dataRows;

  const tableWidth = Math.max(...dataRows.map(row => row.length));

  // 노션 테이블 블록 생성
  const tableChildren: NotionBlock[] = [];

  // 헤더 행 추가
  if (headerRow) {
    tableChildren.push({
      object: 'block',
      type: 'table_row',
      table_row: {
        cells: headerRow.map(cell => [
          {
            type: 'text',
            text: { content: cell }
          }
        ])
      }
    });
  }

  // 데이터 행 추가
  bodyRows.forEach(row => {
    // 열 개수를 맞추기 위해 부족한 셀은 빈 문자열로 채움
    const paddedRow = [...row];
    while (paddedRow.length < tableWidth) {
      paddedRow.push('');
    }

    tableChildren.push({
      object: 'block',
      type: 'table_row',
      table_row: {
        cells: paddedRow.map(cell => [
          {
            type: 'text',
            text: { content: cell }
          }
        ])
      }
    });
  });

  const tableBlock: NotionBlock = {
    object: 'block',
    type: 'table',
    table: {
      table_width: tableWidth,
      has_column_header: hasHeader,
      has_row_header: false,
      children: tableChildren
    }
  };

  return {
    block: tableBlock,
    endIndex: i - 1
  };
}

/**
 * 마크다운 텍스트를 노션 블록으로 변환
 */
function markdownToNotionBlocks(markdown: string): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 빈 줄 건너뛰기
    if (line.trim() === '') continue;

    // 표 감지 및 처리
    if (line.trim().startsWith('|')) {
      const tableResult = parseMarkdownTable(lines, i);
      if (tableResult) {
        blocks.push(tableResult.block);
        i = tableResult.endIndex; // 표의 끝으로 인덱스 이동
        continue;
      }
    }

    // H1 제목
    if (line.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: line.substring(2) } }]
        }
      });
    }
    // H2 제목
    else if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: line.substring(3) } }]
        }
      });
    }
    // H3 제목
    else if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: line.substring(4) } }]
        }
      });
    }
    // 글머리 기호 목록
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: line.substring(2) } }]
        }
      });
    }
    // 번호 목록
    else if (/^\d+\.\s/.test(line)) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: [{ type: 'text', text: { content: line.replace(/^\d+\.\s/, '') } }]
        }
      });
    }
    // 코드 블록 시작
    else if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++; // 다음 줄로 이동

      // 코드 블록 끝까지 수집
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }

      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }],
          language: 'plain text'
        }
      });
    }
    // 일반 텍스트
    else {
      // 텍스트가 2000자를 넘으면 분할
      const text = line;
      if (text.length > 2000) {
        // 2000자씩 분할
        for (let j = 0; j < text.length; j += 2000) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: text.substring(j, j + 2000) } }]
            }
          });
        }
      } else {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: text } }]
          }
        });
      }
    }
  }

  return blocks;
}

/**
 * 노션 페이지 생성 (프록시 서버를 통해)
 */
export async function createNotionPage(
  apiKey: string,
  databaseId: string,
  title: string,
  content: string
): Promise<{ success: boolean; pageUrl?: string; error?: string }> {
  try {
    // 마크다운을 노션 블록으로 변환
    const blocks = markdownToNotionBlocks(content);

    // 프록시 서버를 통해 노션 API 호출
    // 개발 환경: localhost:3007, 프로덕션: Vercel serverless function
    const apiUrl = import.meta.env.DEV
      ? 'http://localhost:3007/api/notion/pages'
      : '/api/notion-pages';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKey,
        databaseId,
        title: title || '제목 없음',
        blocks
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Notion API Error:', data);
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    return {
      success: true,
      pageUrl: data.pageUrl
    };
  } catch (error: any) {
    console.error('Notion Upload Error:', error);
    return {
      success: false,
      error: error.message || '알 수 없는 오류가 발생했습니다.'
    };
  }
}
