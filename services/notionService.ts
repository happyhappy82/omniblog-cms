interface NotionBlock {
  object: 'block';
  type: string;
  [key: string]: any;
}

interface RichText {
  type: 'text';
  text: {
    content: string;
    link?: {
      url: string;
    };
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
}

/**
 * 마크다운 텍스트를 파싱하여 Notion rich_text 배열로 변환
 * 지원 형식: **볼드**, __밑줄__, [링크](url)
 */
function parseTextWithLinks(text: string): RichText[] {
  const richTextArray: RichText[] = [];

  // 마크다운 패턴: 링크, 볼드, 밑줄
  // 순서 중요: 링크를 먼저 처리한 후 볼드와 밑줄 처리
  const segments = parseFormattedText(text);

  for (const segment of segments) {
    richTextArray.push(segment);
  }

  // 빈 배열이면 기본 텍스트 추가
  if (richTextArray.length === 0) {
    richTextArray.push({
      type: 'text',
      text: { content: text }
    });
  }

  return richTextArray;
}

/**
 * 텍스트를 파싱하여 포맷팅된 세그먼트로 분할
 */
function parseFormattedText(text: string): RichText[] {
  const result: RichText[] = [];
  let currentIndex = 0;

  // 모든 포맷팅 마커를 찾는 정규식
  // 1. 링크: [text](url)
  // 2. 볼드: **text**
  // 3. 밑줄: __text__
  const combinedRegex = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(__([^_]+)__)/g;

  let match;
  while ((match = combinedRegex.exec(text)) !== null) {
    const [fullMatch] = match;
    const matchIndex = match.index;

    // 이전 일반 텍스트 추가
    if (matchIndex > currentIndex) {
      const plainText = text.substring(currentIndex, matchIndex);
      result.push({
        type: 'text',
        text: { content: plainText }
      });
    }

    // 링크인 경우
    if (match[1]) {
      const linkText = match[2];
      const url = match[3];

      // 링크 텍스트 내부의 볼드/밑줄 처리
      const formattedLinkSegments = parseInlineFormatting(linkText);

      for (const segment of formattedLinkSegments) {
        result.push({
          type: 'text',
          text: {
            content: segment.text.content,
            link: { url }
          },
          annotations: segment.annotations
        });
      }
    }
    // 볼드인 경우
    else if (match[4]) {
      const boldText = match[5];

      // 볼드 텍스트 내부의 밑줄 처리
      const innerSegments = parseInlineFormatting(boldText);

      for (const segment of innerSegments) {
        result.push({
          type: 'text',
          text: { content: segment.text.content },
          annotations: {
            ...segment.annotations,
            bold: true
          }
        });
      }
    }
    // 밑줄인 경우
    else if (match[6]) {
      const underlineText = match[7];

      // 밑줄 텍스트 내부의 볼드 처리
      const innerSegments = parseInlineFormatting(underlineText);

      for (const segment of innerSegments) {
        result.push({
          type: 'text',
          text: { content: segment.text.content },
          annotations: {
            ...segment.annotations,
            underline: true
          }
        });
      }
    }

    currentIndex = matchIndex + fullMatch.length;
  }

  // 마지막 일반 텍스트 추가
  if (currentIndex < text.length) {
    const remainingText = text.substring(currentIndex);
    result.push({
      type: 'text',
      text: { content: remainingText }
    });
  }

  return result;
}

/**
 * 인라인 포맷팅 처리 (중첩된 볼드/밑줄)
 */
function parseInlineFormatting(text: string): RichText[] {
  const result: RichText[] = [];
  let currentIndex = 0;

  // 볼드와 밑줄만 처리
  const inlineRegex = /(\*\*([^*]+)\*\*)|(__([^_]+)__)/g;

  let match;
  while ((match = inlineRegex.exec(text)) !== null) {
    const [fullMatch] = match;
    const matchIndex = match.index;

    // 이전 일반 텍스트 추가
    if (matchIndex > currentIndex) {
      const plainText = text.substring(currentIndex, matchIndex);
      result.push({
        type: 'text',
        text: { content: plainText }
      });
    }

    // 볼드인 경우
    if (match[1]) {
      result.push({
        type: 'text',
        text: { content: match[2] },
        annotations: { bold: true }
      });
    }
    // 밑줄인 경우
    else if (match[3]) {
      result.push({
        type: 'text',
        text: { content: match[4] },
        annotations: { underline: true }
      });
    }

    currentIndex = matchIndex + fullMatch.length;
  }

  // 마지막 일반 텍스트 추가
  if (currentIndex < text.length) {
    const remainingText = text.substring(currentIndex);
    result.push({
      type: 'text',
      text: { content: remainingText }
    });
  }

  // 포맷팅이 없으면 전체 텍스트 반환
  if (result.length === 0) {
    result.push({
      type: 'text',
      text: { content: text }
    });
  }

  return result;
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
        cells: headerRow.map(cell => parseTextWithLinks(cell))
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
        cells: paddedRow.map(cell => parseTextWithLinks(cell))
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
 * 들여쓰기 레벨 감지 (2칸 = 1레벨)
 */
function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  const spaces = match[1].length;
  return Math.floor(spaces / 2);
}

/**
 * 리스트 항목인지 확인하고 내용 추출
 */
function parseListItem(line: string): { isList: boolean; isNumbered: boolean; content: string; indentLevel: number } {
  const indentLevel = getIndentLevel(line);
  const trimmed = line.trim();

  // 글머리 기호 목록
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
    return {
      isList: true,
      isNumbered: false,
      content: trimmed.substring(2),
      indentLevel
    };
  }

  // 번호 목록
  const numberedMatch = trimmed.match(/^\d+\.\s(.+)$/);
  if (numberedMatch) {
    return {
      isList: true,
      isNumbered: true,
      content: numberedMatch[1],
      indentLevel
    };
  }

  return { isList: false, isNumbered: false, content: '', indentLevel: 0 };
}

/**
 * Q&A 토글 블록 처리
 */
function processQAToggle(lines: string[], startIndex: number): { block: NotionBlock; endIndex: number } | null {
  const line = lines[startIndex];

  // Q: 또는 Q. 로 시작하는지 확인
  const qMatch = line.match(/^Q[:.]\s*(.+)$/);
  if (!qMatch) return null;

  const question = qMatch[1];
  const answerBlocks: NotionBlock[] = [];
  let i = startIndex + 1;

  // 다음 Q: 또는 Q. 또는 빈 줄이 2번 연속 나올 때까지 답변 수집
  while (i < lines.length) {
    const currentLine = lines[i];

    // 다음 질문이 시작되면 종료
    if (currentLine.trim().match(/^Q[:.]/)) {
      break;
    }

    // 빈 줄 건너뛰기
    if (currentLine.trim() === '') {
      i++;
      continue;
    }

    // 답변 내용을 블록으로 변환
    // 리스트 항목
    if (parseListItem(currentLine).isList) {
      const listResult = processNestedLists(lines, i);
      answerBlocks.push(...listResult.blocks);
      i = listResult.endIndex + 1;
    }
    // 이미지
    else if (currentLine.match(/^!\[(.*?)\]\((.*?)\)$/)) {
      const imageMatch = currentLine.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imageMatch) {
        const [, alt, url] = imageMatch;
        if (url && url.trim() !== '') {
          answerBlocks.push({
            object: 'block',
            type: 'image',
            image: {
              type: 'external',
              external: { url: url.trim() }
            }
          } as any);
        }
      }
      i++;
    }
    // 코드 블록
    else if (currentLine.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      answerBlocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }],
          language: 'plain text'
        }
      });
      i++;
    }
    // 일반 텍스트
    else {
      answerBlocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: parseTextWithLinks(currentLine)
        }
      });
      i++;
    }
  }

  // 토글 블록 생성
  const toggleBlock: NotionBlock = {
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: parseTextWithLinks(question),
      children: answerBlocks.length > 0 ? answerBlocks : [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: '' } }]
        }
      }]
    }
  };

  return {
    block: toggleBlock,
    endIndex: i - 1
  };
}

/**
 * 중첩된 리스트를 처리하여 노션 블록 생성
 */
function processNestedLists(lines: string[], startIndex: number): { blocks: NotionBlock[]; endIndex: number } {
  const result: NotionBlock[] = [];
  const stack: { block: NotionBlock; level: number }[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];

    // 빈 줄이면 리스트 종료
    if (line.trim() === '') {
      i++;
      break;
    }

    const listInfo = parseListItem(line);

    // 리스트 항목이 아니면 종료
    if (!listInfo.isList) {
      break;
    }

    const blockType = listInfo.isNumbered ? 'numbered_list_item' : 'bulleted_list_item';
    const newBlock: NotionBlock = {
      object: 'block',
      type: blockType,
      [blockType]: {
        rich_text: parseTextWithLinks(listInfo.content)
      }
    };

    // 스택이 비어있거나 같은 레벨이면 결과에 추가
    if (stack.length === 0 || listInfo.indentLevel === 0) {
      // 이전 스택 정리
      while (stack.length > 0) {
        stack.pop();
      }
      result.push(newBlock);
      stack.push({ block: newBlock, level: 0 });
    }
    // 들여쓰기가 증가했으면 이전 블록의 자식으로 추가
    else if (listInfo.indentLevel > stack[stack.length - 1].level) {
      const parent = stack[stack.length - 1].block;
      const parentType = parent.type as string;

      if (!parent[parentType].children) {
        parent[parentType].children = [];
      }
      parent[parentType].children.push(newBlock);
      stack.push({ block: newBlock, level: listInfo.indentLevel });
    }
    // 들여쓰기가 감소했으면 적절한 부모 찾기
    else if (listInfo.indentLevel < stack[stack.length - 1].level) {
      // 현재 레벨보다 높은 스택 항목 제거
      while (stack.length > 0 && stack[stack.length - 1].level >= listInfo.indentLevel) {
        stack.pop();
      }

      if (stack.length === 0 || listInfo.indentLevel === 0) {
        result.push(newBlock);
        stack.push({ block: newBlock, level: 0 });
      } else {
        const parent = stack[stack.length - 1].block;
        const parentType = parent.type as string;

        if (!parent[parentType].children) {
          parent[parentType].children = [];
        }
        parent[parentType].children.push(newBlock);
        stack.push({ block: newBlock, level: listInfo.indentLevel });
      }
    }
    // 같은 레벨이면 형제로 추가
    else {
      if (stack.length === 1) {
        result.push(newBlock);
        stack[0] = { block: newBlock, level: 0 };
      } else {
        const parent = stack[stack.length - 2].block;
        const parentType = parent.type as string;

        if (!parent[parentType].children) {
          parent[parentType].children = [];
        }
        parent[parentType].children.push(newBlock);
        stack[stack.length - 1] = { block: newBlock, level: listInfo.indentLevel };
      }
    }

    i++;
  }

  return { blocks: result, endIndex: i - 1 };
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

    // Q&A 토글 처리 (Q: 또는 Q. 로 시작)
    if (line.trim().match(/^Q[:.]/)) {
      const toggleResult = processQAToggle(lines, i);
      if (toggleResult) {
        blocks.push(toggleResult.block);
        i = toggleResult.endIndex;
        continue;
      }
    }

    // 표 감지 및 처리
    if (line.trim().startsWith('|')) {
      const tableResult = parseMarkdownTable(lines, i);
      if (tableResult) {
        blocks.push(tableResult.block);
        i = tableResult.endIndex; // 표의 끝으로 인덱스 이동
        continue;
      }
    }

    // 이미지: ![alt](url)
    const imageMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      const [, alt, url] = imageMatch;
      if (url && url.trim() !== '') {
        blocks.push({
          object: 'block',
          type: 'image',
          image: {
            type: 'external',
            external: {
              url: url.trim()
            }
          }
        } as any);
      }
      continue;
    }

    // H1 제목
    if (line.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: parseTextWithLinks(line.substring(2))
        }
      });
    }
    // H2 제목
    else if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: parseTextWithLinks(line.substring(3))
        }
      });
    }
    // H3 제목
    else if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: parseTextWithLinks(line.substring(4))
        }
      });
    }
    // 리스트 항목 감지 (들여쓰기 포함)
    else if (parseListItem(line).isList) {
      const listResult = processNestedLists(lines, i);
      blocks.push(...listResult.blocks);
      i = listResult.endIndex;
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
          const chunk = text.substring(j, j + 2000);
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: parseTextWithLinks(chunk)
            }
          });
        }
      } else {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: parseTextWithLinks(text)
          }
        });
      }
    }
  }

  return blocks;
}

/**
 * 블록을 100개씩 분할하는 헬퍼 함수
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * 노션 페이지에 블록 추가 (append)
 */
async function appendBlocksToPage(
  apiKey: string,
  pageId: string,
  blocks: NotionBlock[]
): Promise<{ success: boolean; error?: string }> {
  const apiUrl = import.meta.env.DEV
    ? 'http://localhost:4000/api/notion/blocks/append'
    : '/api/notion-blocks-append';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apiKey,
      pageId,
      blocks
    })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || `HTTP ${response.status}`
    };
  }

  return { success: true };
}

/**
 * 노션 페이지 생성 (프록시 서버를 통해)
 * 100개 블록 제한을 우회하기 위해 분할 업로드 지원
 */
export async function createNotionPage(
  apiKey: string,
  databaseId: string,
  title: string,
  content: string,
  scheduledDate?: string
): Promise<{ success: boolean; pageUrl?: string; error?: string }> {
  try {
    // 마크다운을 노션 블록으로 변환
    const allBlocks = markdownToNotionBlocks(content);
    const BLOCK_LIMIT = 100;

    console.log('📅 Creating Notion page with scheduledDate:', scheduledDate);
    console.log(`📦 Total blocks: ${allBlocks.length}`);

    // 프록시 서버를 통해 노션 API 호출
    const apiUrl = import.meta.env.DEV
      ? 'http://localhost:4000/api/notion/pages'
      : '/api/notion-pages';

    // 첫 100개 블록으로 페이지 생성
    const firstChunk = allBlocks.slice(0, BLOCK_LIMIT);
    const remainingBlocks = allBlocks.slice(BLOCK_LIMIT);

    const requestData = {
      apiKey,
      databaseId,
      title: title || '제목 없음',
      blocks: firstChunk,
      scheduledDate
    };

    console.log('📤 Creating page with first', firstChunk.length, 'blocks');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('❌ Notion API Error:', data);
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const pageId = data.pageId;
    const pageUrl = data.pageUrl;

    console.log('✅ Page created with ID:', pageId);

    // 나머지 블록이 있으면 100개씩 나눠서 append
    if (remainingBlocks.length > 0) {
      const chunks = chunkArray(remainingBlocks, BLOCK_LIMIT);
      console.log(`📦 Appending ${remainingBlocks.length} more blocks in ${chunks.length} batch(es)`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`📤 Appending batch ${i + 1}/${chunks.length} (${chunk.length} blocks)`);

        const appendResult = await appendBlocksToPage(apiKey, pageId, chunk);

        if (!appendResult.success) {
          console.error(`❌ Failed to append batch ${i + 1}:`, appendResult.error);
          // 페이지는 이미 생성되었으므로 부분 성공으로 처리
          return {
            success: true,
            pageUrl,
            error: `페이지 생성됨, 하지만 일부 블록 추가 실패: ${appendResult.error}`
          };
        }

        // API 부하 방지를 위한 짧은 딜레이
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log('✅ All blocks appended successfully!');
    }

    console.log('✅ Notion page created successfully!', pageUrl);

    return {
      success: true,
      pageUrl
    };
  } catch (error: any) {
    console.error('Notion Upload Error:', error);
    return {
      success: false,
      error: error.message || '알 수 없는 오류가 발생했습니다.'
    };
  }
}
