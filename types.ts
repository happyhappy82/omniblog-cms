export enum NicheType {
  AI = 'AI',
  TECH = 'TECH',
  REAL_ESTATE = 'REAL_ESTATE',
  STOCK = 'STOCK',
  POLICY = 'POLICY',
  TRAVEL = 'TRAVEL',
  RESTAURANT = 'RESTAURANT',
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