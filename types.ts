export enum NicheType {
  AI = 'AI',
  TECH = 'TECH',
  REAL_ESTATE = 'REAL_ESTATE',
  STOCK = 'STOCK',
  POLICY = 'POLICY',
  TRAVEL = 'TRAVEL',
  RESTAURANT = 'RESTAURANT',
  SEO = 'SEO',
}

export interface NicheConfig {
  id: NicheType;
  label: string;
  icon: string; // Component name or identifier
  color: string;
  description: string;
  systemInstruction: string;
  notionDatabaseId?: string; // Optional pre-linked DB ID
}

export type DraftStatus = 'idle' | 'generating' | 'generated' | 'published' | 'error';

export interface Draft {
  id: string;
  nicheId: NicheType;
  title: string;
  context: string;
  userPrompt: string; // Notion 프롬프트
  naverPrompt: string; // Naver 프롬프트
  content: string; // Notion Content
  naverContent: string; // Naver Content
  status: DraftStatus;
  error?: string; // 에러 메시지 저장
  scheduledDate?: string; // 포스팅 예정 날짜 (ISO 8601 format)
  createdAt: number;
  lastModified: number;
  products?: ProductInfo[]; // Tech 플랫폼용: 선택된 제품 리스트
  generateNotion?: boolean; // AI 플랫폼용: 노션 생성 여부 (기본값: true)
  generateNaver?: boolean; // AI 플랫폼용: 네이버 생성 여부 (기본값: true)
}

export interface NicheSettings {
  notionApiKey: string;
  notionDatabaseId: string;
  defaultPrompt?: string; // Notion용 기본 프롬프트
  defaultNaverPrompt?: string; // Naver용 기본 프롬프트 (AI 플랫폼만)
}

export interface AppSettings {
  geminiApiKey: string;
  imgbbApiKey: string; // imgBB 이미지 호스팅 API Key (전체 플랫폼 공유)
  nicheSettings: {
    [key in NicheType]: NicheSettings;
  };
}

// imgBB API 응답 타입
export interface ImgBBUploadResponse {
  data: {
    id: string;
    url_viewer: string;
    url: string;
    display_url: string;
    title: string;
    time: string;
    image: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    thumb: {
      url: string;
    };
    medium: {
      url: string;
    };
    delete_url: string;
  };
  success: boolean;
  status: number;
}

// 이미지 업로드 상태
export interface ImageUploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

// 지역 데이터 타입
export interface RegionalData {
  sido: string; // 시/도
  sigungu: string; // 시/군/구
  dong: string; // 읍/면/동
  data: Record<string, string | number>; // 실제 데이터 (컬럼명: 값)
}

// 지역 데이터 저장 구조
export interface RegionalDataStore {
  fileName: string;
  uploadDate: string;
  columns: string[]; // 엑셀 컬럼명 목록
  regions: RegionalData[]; // 전체 지역 데이터
}

// 컬럼 매핑 딕셔너리 (학습형)
export interface ColumnMappingDictionary {
  [columnName: string]: 'sido' | 'sigungu' | 'dong' | 'other';
}

// 필수 필드 매핑
export interface RequiredFieldMapping {
  sido: string | null;    // 시/도 컬럼명
  sigungu: string | null; // 시/군/구 컬럼명
  dong: string | null;    // 읍/면/동 컬럼명
  eupMyeon?: string | null; // 부동산 전용: 읍/면 컬럼명
  dongRi?: string | null;   // 부동산 전용: 동/리 컬럼명
}

// 인증 관련 타입
export interface AuthSession {
  isAuthenticated: boolean;
  timestamp: number;
  passwordHash: string;
}

export interface LoginDialogProps {
  isOpen: boolean;
  onLogin: (password: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

// 제품 정보 타입 (Tech 플랫폼용)
export interface ProductInfo {
  id: string;
  name: string;
  price: string;
  coupangLink: string;
  specs: string;
  features: string;
  createdAt: number;
}

// 제품 라이브러리 저장 구조
export interface ProductLibrary {
  [nicheId: string]: ProductInfo[]; // 니치별 제품 라이브러리
}

// 노션에서 가져온 확장된 제품 정보 (게이밍 노트북용)
export interface NotionGamingLaptop {
  id: string;
  name: string;
  price: string;
  coupangLink: string;
  order: number;
  rocketDelivery?: boolean;
  // 전체 페이지 내용 (마크다운 형식)
  fullContent?: string;
  // 스펙 (fullContent에서 추출 가능)
  processor?: string;
  graphics?: string;
  memory?: string;
  storage?: string;
  display?: string;
}

// 5개 제품 그룹
export interface ProductGroup {
  id: string;
  name: string;  // "RTX 4060 게이밍 노트북 TOP5"
  groupType: 'price' | 'gpu' | 'brand';
  products: NotionGamingLaptop[];
}