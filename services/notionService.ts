interface NotionBlock {
  object: 'block';
  type: string;
  [key: string]: any;
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
    const response = await fetch('http://localhost:3007/api/notion/pages', {
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
