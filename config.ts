/**
 * 애플리케이션 전역 설정
 * 하드코딩된 값들을 중앙에서 관리
 */

export const CONFIG = {
  // === 인증 관련 ===
  SESSION_DURATION_DAYS: 7,

  // === Notion API 관련 ===
  NOTION: {
    BLOCK_LIMIT: 100,           // Notion API 블록 제한 (한 번에 100개)
    APPEND_DELAY_MS: 200,       // 블록 추가 간 딜레이
    UPLOAD_DELAY_MS: 1000,      // 페이지 업로드 간 딜레이
    FETCH_POSTS_LIMIT: 100,     // 발행글 조회 최대 개수
  },

  // === AI 생성 관련 ===
  GENERATION: {
    RATE_LIMIT_DELAY_MS: 2000,  // AI 생성 요청 간 딜레이 (API rate limit 고려)
  },

  // === 제품 관련 ===
  PRODUCT: {
    GROUP_SIZE: 5,              // 제품 그룹당 개수
    MAX_IMPORT: 5,              // 노션에서 가져올 최대 제품 수
    FETCH_DELAY_MS: 300,        // 제품 상세 조회 간 딜레이
  },

  // === 파일 처리 관련 ===
  FILE: {
    CHUNK_SIZE: 1000,           // 엑셀 파일 처리 청크 크기 (행 단위)
  },

  // === UI 관련 ===
  UI: {
    FLOATING_MENU_WIDTH: 100,
    FLOATING_MENU_HEIGHT: 50,
  },
} as const;

// 타입 추출 (필요시 사용)
export type AppConfig = typeof CONFIG;
