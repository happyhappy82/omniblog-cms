/**
 * URL 슬러그 생성 유틸리티
 * 블로그 내부 링크를 위한 타이틀 → 슬러그 변환
 */

/**
 * 타이틀을 URL 슬러그로 변환
 * - 소문자 변환
 * - 한글 유지 (영문 블로그의 경우 영문만 유지하도록 옵션 추가 가능)
 * - 특수문자 제거
 * - 공백 → 하이픈
 * - 연속 하이픈 제거
 */
export function titleToSlug(title: string, keepKorean: boolean = true): string {
  let slug = title
    .toLowerCase()
    .trim();

  if (keepKorean) {
    // 한글, 영문, 숫자, 공백, 하이픈만 유지
    slug = slug.replace(/[^\w\s가-힣-]/g, '');
  } else {
    // 영문, 숫자, 공백, 하이픈만 유지
    slug = slug.replace(/[^\w\s-]/g, '');
  }

  return slug
    .replace(/\s+/g, '-')  // 공백 → 하이픈
    .replace(/-+/g, '-')   // 연속 하이픈 제거
    .replace(/^-|-$/g, ''); // 시작/끝 하이픈 제거
}

/**
 * 블로그 기본 URL과 슬러그를 조합하여 전체 URL 생성
 */
export function generateBlogUrl(baseUrl: string, slug: string): string {
  // baseUrl 끝의 슬래시 제거
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  return `${cleanBaseUrl}/${slug}`;
}

/**
 * 선택된 글들을 마크다운 링크 형식으로 변환
 */
export function formatAsMarkdownLink(title: string, url: string): string {
  return `[${title}](${url})`;
}

/**
 * 여러 글을 "관련 글 더 보기" 섹션 마크다운으로 변환
 */
export function formatAsRelatedPosts(
  posts: Array<{ title: string; url: string }>,
  sectionTitle: string = '관련 글 더 보기'
): string {
  if (posts.length === 0) return '';

  const links = posts
    .map(post => `- [${post.title}](${post.url})`)
    .join('\n');

  return `---

## ${sectionTitle}

${links}`;
}

/**
 * 커서 위치에 삽입할 인라인 링크 포맷
 * 단일 선택 시 사용
 */
export function formatAsInlineLink(title: string, url: string): string {
  return `[${title}](${url})`;
}

/**
 * 여러 글을 관련 글 목록으로 포맷 (커서 위치 삽입용)
 */
export function formatAsInlineLinkList(
  posts: Array<{ title: string; url: string }>
): string {
  if (posts.length === 0) return '';

  if (posts.length === 1) {
    return formatAsInlineLink(posts[0].title, posts[0].url);
  }

  // 다중 선택 시 불릿 리스트로
  return posts
    .map(post => `- [${post.title}](${post.url})`)
    .join('\n');
}
