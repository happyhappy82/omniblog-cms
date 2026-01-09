export enum NicheType {
  AI = 'AI',
  TECH = 'TECH',
  REAL_ESTATE = 'REAL_ESTATE',
  STOCK = 'STOCK',
  POLICY = 'POLICY',
  HOSPITAL = 'HOSPITAL',
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
  createdAt: number;
  lastModified: number;
}

export interface NicheSettings {
  notionApiKey: string;
  notionDatabaseId: string;
}

export interface AppSettings {
  geminiApiKey: string;
  nicheSettings: {
    [key in NicheType]: NicheSettings;
  };
}