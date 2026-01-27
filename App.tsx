import React, { useState, useEffect } from 'react';
import { NICHES, MOCK_INITIAL_CONTENT } from './constants';
import { NicheType, Draft, AppSettings, ProductInfo, NotionGamingLaptop } from './types';
import { Icon } from './components/Icon';
import { SettingsDialog } from './components/SettingsDialog';
import { NotionEditor } from './components/NotionEditor';
import { NaverEditor } from './components/NaverEditor';
import { QueuePanel } from './components/QueuePanel';
import { RestaurantSearchDialog } from './components/RestaurantSearchDialog';
import { RegionalDataManager } from './components/RegionalDataManager';
import { KeywordAnalysisDialog } from './components/KeywordAnalysisDialog';
import { NotionProductImporter } from './components/NotionProductImporter';
import { BulkProductAssigner } from './components/BulkProductAssigner';
import { generateBlogDraft } from './services/geminiService';
import { createNotionPage } from './services/notionService';
import { RegionalData } from './types';
import { formatRegionalDataAsText, formatGroupedRegionalData, groupRegionsByLocation } from './utils/fileParser';
import { useAuth } from './hooks/useAuth';
import { LoginDialog } from './components/LoginDialog';
import { LoadingScreen } from './components/LoadingScreen';
import { ProductInfoManager } from './components/ProductInfoManager';

const App = () => {
  // --- Authentication State ---
  const { isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);

  // --- State Management ---
  // localStorage에서 초기값 복원
  const [viewMode, setViewMode] = useState<'AI' | 'NICHE'>(() => {
    const saved = localStorage.getItem('omni_viewMode');
    return (saved === 'AI' || saved === 'NICHE') ? saved : 'AI';
  });
  const [activeNicheId, setActiveNicheId] = useState<NicheType>(() => {
    const saved = localStorage.getItem('omni_activeNicheId');
    return (saved && Object.values(NicheType).includes(saved as NicheType)) ? (saved as NicheType) : NicheType.AI;
  });
  const [nicheOrder, setNicheOrder] = useState<NicheType[]>(() => {
    const saved = localStorage.getItem('omni_nicheOrder');
    const validNicheIds = NICHES.filter(n => n.id !== NicheType.AI).map(n => n.id);

    if (saved) {
      try {
        const parsedOrder = JSON.parse(saved) as NicheType[];
        // 마이그레이션: HOSPITAL 제거, 유효한 niche만 유지, 누락된 niche 추가
        const filtered = parsedOrder.filter(id =>
          id !== 'HOSPITAL' && validNicheIds.includes(id)
        );
        // 누락된 niche 추가 (예: TRAVEL)
        const missing = validNicheIds.filter(id => !filtered.includes(id));
        return [...filtered, ...missing];
      } catch {
        return validNicheIds;
      }
    }
    return validNicheIds;
  });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    imgbbApiKey: import.meta.env.VITE_IMGBB_API_KEY || '',
    nicheSettings: {
      [NicheType.AI]: {
        notionApiKey: import.meta.env.VITE_AI_NOTION_API_KEY || '',
        notionDatabaseId: import.meta.env.VITE_AI_NOTION_DATABASE_ID || ''
      },
      [NicheType.TECH]: {
        notionApiKey: import.meta.env.VITE_TECH_NOTION_API_KEY || '',
        notionDatabaseId: import.meta.env.VITE_TECH_NOTION_DATABASE_ID || ''
      },
      [NicheType.REAL_ESTATE]: {
        notionApiKey: import.meta.env.VITE_REAL_ESTATE_NOTION_API_KEY || '',
        notionDatabaseId: import.meta.env.VITE_REAL_ESTATE_NOTION_DATABASE_ID || ''
      },
      [NicheType.STOCK]: {
        notionApiKey: import.meta.env.VITE_STOCK_NOTION_API_KEY || '',
        notionDatabaseId: import.meta.env.VITE_STOCK_NOTION_DATABASE_ID || ''
      },
      [NicheType.POLICY]: {
        notionApiKey: import.meta.env.VITE_POLICY_NOTION_API_KEY || '',
        notionDatabaseId: import.meta.env.VITE_POLICY_NOTION_DATABASE_ID || ''
      },
      [NicheType.TRAVEL]: {
        notionApiKey: import.meta.env.VITE_TRAVEL_NOTION_API_KEY || '',
        notionDatabaseId: import.meta.env.VITE_TRAVEL_NOTION_DATABASE_ID || ''
      },
      [NicheType.RESTAURANT]: {
        notionApiKey: import.meta.env.VITE_RESTAURANT_NOTION_API_KEY || '',
        notionDatabaseId: import.meta.env.VITE_RESTAURANT_NOTION_DATABASE_ID || ''
      },
      [NicheType.SEO]: {
        notionApiKey: import.meta.env.VITE_SEO_NOTION_API_KEY || '',
        notionDatabaseId: import.meta.env.VITE_SEO_NOTION_DATABASE_ID || ''
      },
    }
  });
  
  // UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [deletedDraftsHistory, setDeletedDraftsHistory] = useState<Draft[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isRestaurantSearchOpen, setIsRestaurantSearchOpen] = useState(false);
  const [isKeywordAnalysisOpen, setIsKeywordAnalysisOpen] = useState(false);
  const [isNotionImporterOpen, setIsNotionImporterOpen] = useState(false);
  const [isBulkAssignerOpen, setIsBulkAssignerOpen] = useState(false);

  // --- Derived State ---
  const activeNiche = NICHES.find(n => n.id === activeNicheId)!;
  const currentDraft = drafts.find(d => d.id === currentDraftId);

  // --- Effects ---
  useEffect(() => {
    const savedSettings = localStorage.getItem('omni_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);

      // 기존 구조에서 새 구조로 마이그레이션
      if (parsed.notionApiKey || parsed.notionDatabaseId) {
        // 구 버전 데이터 - 마이그레이션 필요
        const migratedSettings: AppSettings = {
          geminiApiKey: parsed.geminiApiKey || '',
          imgbbApiKey: '',
          nicheSettings: {
            [NicheType.AI]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.TECH]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.REAL_ESTATE]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.STOCK]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.POLICY]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.TRAVEL]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.RESTAURANT]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.SEO]: { notionApiKey: '', notionDatabaseId: '' },
          }
        };
        setSettings(migratedSettings);
      } else if (parsed.naverSettings) {
        // naverSettings가 있는 경우 제거하고 마이그레이션
        const { naverSettings, ...rest } = parsed;
        setSettings({
          ...rest,
          imgbbApiKey: rest.imgbbApiKey || '',
          nicheSettings: {
            [NicheType.AI]: { notionApiKey: '', notionDatabaseId: '' },
            ...rest.nicheSettings
          }
        });
      } else if (!parsed.nicheSettings?.[NicheType.AI]) {
        // AI nicheSettings가 없는 경우 추가
        setSettings({
          ...parsed,
          imgbbApiKey: parsed.imgbbApiKey || '',
          nicheSettings: {
            [NicheType.AI]: { notionApiKey: '', notionDatabaseId: '' },
            ...parsed.nicheSettings
          }
        });
      } else if (!parsed.imgbbApiKey) {
        // imgbbApiKey가 없는 경우 추가 (기존 설정 마이그레이션)
        setSettings({
          ...parsed,
          imgbbApiKey: '',
          nicheSettings: {
            ...parsed.nicheSettings,
            [NicheType.SEO]: parsed.nicheSettings?.[NicheType.SEO] || { notionApiKey: '', notionDatabaseId: '' }
          }
        });
      } else if (!parsed.nicheSettings?.[NicheType.SEO]) {
        // SEO nicheSettings가 없는 경우 추가
        setSettings({
          ...parsed,
          nicheSettings: {
            ...parsed.nicheSettings,
            [NicheType.SEO]: { notionApiKey: '', notionDatabaseId: '' }
          }
        });
      } else {
        setSettings(parsed);
      }
    }

    const savedDrafts = localStorage.getItem('omni_drafts');
    if (savedDrafts) {
      try {
        const parsed = JSON.parse(savedDrafts);
        // 기존 데이터 마이그레이션: status, createdAt, naverPrompt, scheduledDate 필드 추가
        const migratedDrafts = parsed.map((d: any) => ({
          ...d,
          status: d.status || 'idle',
          createdAt: d.createdAt || d.lastModified || Date.now(),
          naverPrompt: d.naverPrompt || '',
          scheduledDate: d.scheduledDate || undefined,
        }));
        setDrafts(migratedDrafts);

        // 저장된 currentDraftId 복원
        const savedCurrentDraftId = localStorage.getItem('omni_currentDraftId');
        if (savedCurrentDraftId && migratedDrafts.some((d: Draft) => d.id === savedCurrentDraftId)) {
          setCurrentDraftId(savedCurrentDraftId);
        } else if (migratedDrafts.length > 0) {
          // 저장된 ID가 없거나 유효하지 않으면 가장 최근 draft를 선택
          const mostRecent = migratedDrafts.reduce((a: Draft, b: Draft) =>
            a.lastModified > b.lastModified ? a : b
          );
          setCurrentDraftId(mostRecent.id);
        }
      } catch (error) {
        console.error('Failed to load drafts from localStorage:', error);
      }
    } else {
      const initialId = crypto.randomUUID();
      const now = Date.now();
      const demoDraft: Draft = {
        id: initialId,
        nicheId: NicheType.AI,
        title: 'Chat GPT 이름 뜻은 무엇인가요?',
        context: '',
        userPrompt: '',
        naverPrompt: '',
        content: MOCK_INITIAL_CONTENT,
        naverContent: MOCK_INITIAL_CONTENT,
        status: 'generated',
        createdAt: now,
        lastModified: now
      };
      setDrafts([demoDraft]);
      setCurrentDraftId(initialId);
    }

    // 초기 로드 완료 표시
    setIsInitialLoadComplete(true);
  }, []);

  // drafts 자동 저장 - 초기 로드 완료 후에만
  useEffect(() => {
    if (isInitialLoadComplete && drafts.length > 0) {
      localStorage.setItem('omni_drafts', JSON.stringify(drafts));
    }
  }, [drafts, isInitialLoadComplete]);

  // currentDraftId 자동 저장
  useEffect(() => {
    if (isInitialLoadComplete && currentDraftId) {
      localStorage.setItem('omni_currentDraftId', currentDraftId);
    }
  }, [currentDraftId, isInitialLoadComplete]);

  // viewMode와 activeNicheId 자동 저장
  useEffect(() => {
    if (isInitialLoadComplete) {
      localStorage.setItem('omni_viewMode', viewMode);
      localStorage.setItem('omni_activeNicheId', activeNicheId);
    }
  }, [viewMode, activeNicheId, isInitialLoadComplete]);

  // nicheOrder 자동 저장
  useEffect(() => {
    if (isInitialLoadComplete) {
      localStorage.setItem('omni_nicheOrder', JSON.stringify(nicheOrder));
    }
  }, [nicheOrder, isInitialLoadComplete]);

  // Undo 키보드 단축키 (Cmd+Z / Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deletedDraftsHistory, drafts]);

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('omni_settings', JSON.stringify(newSettings));
  };

  // --- Handlers ---
  
  const handleViewModeChange = (mode: 'AI' | 'NICHE', nicheId?: NicheType) => {
    setViewMode(mode);
    if (mode === 'AI') {
      // AI 모드는 AI 니치로 전환
      handleNicheChange(NicheType.AI);
    } else if (nicheId) {
      handleNicheChange(nicheId);
    }
  };

  const handleNicheChange = (id: NicheType) => {
    setActiveNicheId(id);
    const nicheDrafts = drafts.filter(d => d.nicheId === id).sort((a, b) => b.lastModified - a.lastModified);
    if (nicheDrafts.length > 0) {
      setCurrentDraftId(nicheDrafts[0].id);
    } else {
      createNewDraft(id);
    }
  };

  const createNewDraft = (nicheId: NicheType = activeNicheId) => {
    const now = Date.now();
    const nicheSettings = settings.nicheSettings[nicheId];
    const newDraft: Draft = {
      id: crypto.randomUUID(),
      nicheId: nicheId,
      title: '',
      context: '',
      userPrompt: nicheSettings?.defaultPrompt || '',
      naverPrompt: nicheSettings?.defaultNaverPrompt || '',
      content: '',
      naverContent: '',
      status: 'idle',
      createdAt: now,
      lastModified: now,
      // AI 플랫폼일 때만 생성 옵션 추가
      ...(nicheId === NicheType.AI && {
        generateNotion: true,
        generateNaver: true
      })
    };
    setDrafts(prev => [...prev, newDraft]);
    setCurrentDraftId(newDraft.id);
  };

  const handleAddTopics = (topics: string[]) => {
    const now = Date.now();
    const nicheSettings = settings.nicheSettings[activeNicheId];
    const newDrafts: Draft[] = topics.map((topic, index) => ({
      id: crypto.randomUUID(),
      nicheId: activeNicheId,
      title: topic,
      context: '',
      userPrompt: nicheSettings?.defaultPrompt || '',
      naverPrompt: nicheSettings?.defaultNaverPrompt || '',
      content: '',
      naverContent: '',
      status: 'idle',
      createdAt: now + index, // 약간의 차이를 둬서 순서 보장
      lastModified: now + index,
      // AI 플랫폼일 때만 생성 옵션 추가
      ...(activeNicheId === NicheType.AI && {
        generateNotion: true,
        generateNaver: true
      })
    }));

    setDrafts(prev => [...newDrafts, ...prev]);
    if (newDrafts.length > 0) {
      setCurrentDraftId(newDrafts[0].id);
    }
  };

  const handleDeleteDraft = (draftId: string) => {
    const deletedDraft = drafts.find(d => d.id === draftId);
    if (!deletedDraft) return;

    // 삭제된 draft를 history에 추가 (최대 10개까지만 저장)
    setDeletedDraftsHistory(prev => [deletedDraft, ...prev].slice(0, 10));

    setDrafts(prev => prev.filter(d => d.id !== draftId));

    // 삭제하려는 draft가 현재 선택된 draft인 경우
    if (currentDraftId === draftId) {
      const remainingDrafts = drafts.filter(d => d.id !== draftId && d.nicheId === activeNicheId);
      if (remainingDrafts.length > 0) {
        // 같은 니치의 다른 draft 선택
        setCurrentDraftId(remainingDrafts[0].id);
      } else {
        // 같은 니치에 남은 draft가 없으면 새로 생성
        createNewDraft();
      }
    }
  };

  // 날짜 일괄 설정
  const handleBatchScheduleDates = (startDate: Date, intervalDays: number) => {
    const nicheDrafts = drafts
      .filter(d => d.nicheId === activeNicheId)
      .sort((a, b) => a.createdAt - b.createdAt); // 생성 순서대로 정렬

    const updatedDrafts = [...drafts];

    nicheDrafts.forEach((draft, index) => {
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + (index * intervalDays));

      const draftIndex = updatedDrafts.findIndex(d => d.id === draft.id);
      if (draftIndex !== -1) {
        updatedDrafts[draftIndex] = {
          ...updatedDrafts[draftIndex],
          scheduledDate: scheduledDate.toISOString(),
          lastModified: Date.now()
        };
      }
    });

    setDrafts(updatedDrafts);
  };

  const handleUndo = () => {
    if (deletedDraftsHistory.length === 0) return;

    // 가장 최근에 삭제된 draft 복원
    const [restoredDraft, ...remainingHistory] = deletedDraftsHistory;
    setDeletedDraftsHistory(remainingHistory);

    // draft 복원
    setDrafts(prev => [restoredDraft, ...prev]);

    // 복원된 draft를 선택
    setCurrentDraftId(restoredDraft.id);

    // 복원된 draft의 니치로 이동
    if (restoredDraft.nicheId !== activeNicheId) {
      setActiveNicheId(restoredDraft.nicheId);
      if (restoredDraft.nicheId === NicheType.AI) {
        setViewMode('AI');
      } else {
        setViewMode('NICHE');
      }
    }
  };

  const handleRestaurantSelect = (restaurantInfo: string) => {
    if (!currentDraftId) return;

    // 현재 draft의 context (참고 내용 및 문맥)에 맛집 정보 추가
    const currentContext = currentDraft?.context || '';
    const newContext = currentContext
      ? `${currentContext}\n\n${restaurantInfo}`
      : restaurantInfo;

    updateCurrentDraft('context', newContext);
  };

  const handleRegionalDataAdd = (text: string) => {
    if (!currentDraftId) return;

    // 현재 draft의 context에 지역 데이터 추가
    const currentContext = currentDraft?.context || '';
    const newContext = currentContext
      ? `${currentContext}\n\n${text}`
      : text;

    updateCurrentDraft('context', newContext);
  };

  const handleRegionalBulkGenerate = (regions: RegionalData[], columns: string[]) => {
    const now = Date.now();
    const nicheSettings = settings.nicheSettings[activeNicheId];

    // 지역별로 그룹화 (같은 지역의 여러 업소를 하나로)
    const grouped = groupRegionsByLocation(regions);
    const newDrafts: Draft[] = [];

    let index = 0;
    grouped.forEach((regionGroup, key) => {
      const [sido, sigungu, dong] = key.split('|');
      const title = `${sido} ${sigungu} ${dong} 상권 분석 및 SEO 가이드`;

      // 여러 업소가 있으면 통합 포맷, 하나만 있으면 단일 포맷
      const context = regionGroup.length > 1
        ? formatGroupedRegionalData(regionGroup, columns)
        : formatRegionalDataAsText(regionGroup[0], columns);

      newDrafts.push({
        id: crypto.randomUUID(),
        nicheId: activeNicheId,
        title: title,
        context: context,
        userPrompt: nicheSettings?.defaultPrompt || '',
        naverPrompt: nicheSettings?.defaultNaverPrompt || '',
        content: '',
        naverContent: '',
        status: 'idle',
        createdAt: now + index,
        lastModified: now + index
      });

      index++;
    });

    setDrafts(prev => [...newDrafts, ...prev]);
    if (newDrafts.length > 0) {
      setCurrentDraftId(newDrafts[0].id);
    }

    alert(`${newDrafts.length}개의 지역별 초안이 생성되었습니다.`);
  };

  // 노션 제품 가져오기 완료 핸들러 (선택된 제품들을 현재 Draft의 context에 저장)
  const handleNotionImportComplete = (products: NotionGamingLaptop[]) => {
    if (!currentDraft) {
      alert('먼저 Draft를 선택하세요.');
      return;
    }

    // 제품 정보를 Context 형식으로 포맷팅
    let context = `# 게이밍 노트북 추천 TOP${products.length}\n\n`;
    context += `---\n\n`;

    products.forEach((product, index) => {
      context += `## ${index + 1}위: ${product.name}\n\n`;
      context += `**기본 정보**\n`;
      if (product.price) context += `- 가격: ${product.price}\n`;
      if (product.coupangLink) context += `- 쿠팡 링크: ${product.coupangLink}\n`;
      if (product.rocketDelivery) context += `- 로켓배송: 지원\n`;
      context += '\n';

      // 전체 페이지 내용 (fullContent)
      if (product.fullContent && product.fullContent.trim()) {
        context += `**상세 정보**\n\n`;
        context += product.fullContent;
        context += '\n\n';
      }

      context += `---\n\n`;
    });

    // 제품 정보를 ProductInfo[] 형식으로 변환 (Draft.products용)
    const productInfos: ProductInfo[] = products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      coupangLink: p.coupangLink,
      specs: '',
      features: '',
      createdAt: Date.now(),
    }));

    // 현재 Draft 업데이트
    setDrafts(prev => prev.map(d =>
      d.id === currentDraft.id
        ? { ...d, context, products: productInfos, lastModified: Date.now() }
        : d
    ));

    alert(`${products.length}개 제품 정보가 문맥에 저장되었습니다.`);
  };

  const updateCurrentDraft = (field: keyof Draft, value: string) => {
    if (!currentDraftId) return;

    // 프롬프트 필드는 항상 같은 플랫폼의 모든 draft에 적용
    if (field === 'userPrompt' || field === 'naverPrompt') {
      // 1. 같은 플랫폼의 모든 draft 업데이트
      setDrafts(prev => prev.map(d =>
        d.nicheId === activeNicheId
          ? { ...d, [field]: value, lastModified: Date.now() }
          : d
      ));

      // 2. settings의 defaultPrompt도 업데이트
      setSettings(prev => ({
        ...prev,
        nicheSettings: {
          ...prev.nicheSettings,
          [activeNicheId]: {
            ...prev.nicheSettings[activeNicheId],
            [field === 'userPrompt' ? 'defaultPrompt' : 'defaultNaverPrompt']: value
          }
        }
      }));
    } else {
      // 다른 필드는 현재 draft만 업데이트
      setDrafts(prev => prev.map(d =>
        d.id === currentDraftId
          ? { ...d, [field]: value, lastModified: Date.now() }
          : d
      ));
    }
  };

  // 제품 정보를 Context 형식으로 변환 (링크와 가격 제외)
  const formatProductsForContext = (products: typeof currentDraft.products) => {
    if (!products || products.length === 0) return '';

    let text = '\n\n# 제품 정보\n\n';
    products.forEach((product, index) => {
      text += `## ${index + 1}. ${product.name}\n`;
      if (product.specs) text += `- 주요 스펙: ${product.specs}\n`;
      if (product.features) text += `- 특징: ${product.features}\n`;
      text += '\n';
    });

    return text;
  };

  // 생성된 콘텐츠에 쿠팡 버튼 삽입
  const insertCoupangButtons = (content: string, products: typeof currentDraft.products) => {
    if (!products || products.length === 0) return content;

    let result = content;

    products.forEach((product, index) => {
      // 제품명 패턴 찾기 (예: "## 1. LG 그램 17인치" 또는 "### 1. LG 그램 17인치")
      const productNumber = index + 1;
      const patterns = [
        new RegExp(`(##\\s*${productNumber}\\.\\s*${product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?\\n(?=[\\s\\S]*?(?:##|###|$)))`, 'i'),
        new RegExp(`(###\\s*${productNumber}\\.\\s*${product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?\\n(?=[\\s\\S]*?(?:##|###|$)))`, 'i')
      ];

      for (const pattern of patterns) {
        const match = result.match(pattern);
        if (match) {
          const sectionContent = match[1];
          // 섹션 끝부분 찾기 (다음 제목 또는 문서 끝)
          const nextHeaderIndex = result.indexOf(sectionContent) + sectionContent.length;
          const beforeNextSection = result.substring(0, nextHeaderIndex);
          const afterNextSection = result.substring(nextHeaderIndex);

          // 쿠팡 버튼 삽입
          const button = `\n\n> 💰 **현재 가격**: ${product.price}\n> \n> [🛒 쿠팡 최저가 확인하기](${product.coupangLink})\n\n`;

          result = beforeNextSection.trimEnd() + button + afterNextSection;
          break;
        }
      }
    });

    return result;
  };

  const handleGenerate = async () => {
    if (!currentDraft || !settings.geminiApiKey) {
      if (!settings.geminiApiKey) setIsSettingsOpen(true);
      return;
    }

    // AbortController 생성
    const controller = new AbortController();
    setAbortController(controller);
    setIsGenerating(true);

    // 상태를 generating으로 변경
    setDrafts(prev => prev.map(d =>
      d.id === currentDraftId
        ? { ...d, status: 'generating' as const, lastModified: Date.now() }
        : d
    ));

    // Context에 제품 정보 추가 (링크 제외)
    const enhancedContext = currentDraft.context + (currentDraft.products ? formatProductsForContext(currentDraft.products) : '');

    try {
      if (activeNicheId === NicheType.AI) {
        // AI 플랫폼: 선택적 생성
        const shouldGenerateNaver = currentDraft.generateNaver ?? true;
        const shouldGenerateNotion = currentDraft.generateNotion ?? true;

        // 둘 다 체크 해제된 경우
        if (!shouldGenerateNaver && !shouldGenerateNotion) {
          alert('최소 하나 이상의 콘텐츠를 선택해주세요.');
          setIsGenerating(false);
          setAbortController(null);
          setDrafts(prev => prev.map(d =>
            d.id === currentDraftId
              ? { ...d, status: 'idle' as const, lastModified: Date.now() }
              : d
          ));
          return;
        }

        let naverContent = '';
        let notionContent = '';

        // 네이버 콘텐츠 생성 (선택된 경우에만)
        if (shouldGenerateNaver) {
          naverContent = await generateBlogDraft(
            settings.geminiApiKey,
            activeNiche,
            currentDraft.title,
            enhancedContext,
            currentDraft.naverPrompt
          );

          if (controller.signal.aborted) {
            throw new Error('생성이 취소되었습니다.');
          }
        }

        // 노션 콘텐츠 생성 (선택된 경우에만)
        if (shouldGenerateNotion) {
          notionContent = await generateBlogDraft(
            settings.geminiApiKey,
            activeNiche,
            currentDraft.title,
            enhancedContext,
            currentDraft.userPrompt
          );

          if (controller.signal.aborted) {
            throw new Error('생성이 취소되었습니다.');
          }

          // 제품 정보가 있으면 쿠팡 버튼 삽입
          if (currentDraft.products && currentDraft.products.length > 0) {
            notionContent = insertCoupangButtons(notionContent, currentDraft.products);
          }
        }

        setDrafts(prev => prev.map(d =>
          d.id === currentDraftId
            ? {
                ...d,
                content: notionContent,
                naverContent: naverContent,
                status: 'generated' as const,
                lastModified: Date.now()
              }
            : d
        ));
      } else {
        // 다른 플랫폼: 노션만 생성
        let generatedContent = await generateBlogDraft(
          settings.geminiApiKey,
          activeNiche,
          currentDraft.title,
          enhancedContext,
          currentDraft.userPrompt
        );

        if (controller.signal.aborted) {
          throw new Error('생성이 취소되었습니다.');
        }

        // Tech 플랫폼이고 제품 정보가 있으면 쿠팡 버튼 삽입
        if (activeNicheId === NicheType.TECH && currentDraft.products && currentDraft.products.length > 0) {
          generatedContent = insertCoupangButtons(generatedContent, currentDraft.products);
        }

        setDrafts(prev => prev.map(d =>
          d.id === currentDraftId
            ? {
                ...d,
                content: generatedContent,
                naverContent: '',
                status: 'generated' as const,
                lastModified: Date.now()
              }
            : d
        ));
      }
    } catch (error: any) {
      console.error('생성 실패:', error);

      if (error.message === '생성이 취소되었습니다.') {
        // 취소된 경우 idle 상태로 복원
        setDrafts(prev => prev.map(d =>
          d.id === currentDraftId
            ? {
                ...d,
                status: 'idle' as const,
                lastModified: Date.now()
              }
            : d
        ));
      } else {
        setDrafts(prev => prev.map(d =>
          d.id === currentDraftId
            ? {
                ...d,
                status: 'error' as const,
                error: error.message || '생성 실패',
                lastModified: Date.now()
              }
            : d
        ));
        alert("생성 실패: API 키를 확인하거나 콘솔을 참조하세요.");
      }
    } finally {
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  const handleCancelGenerate = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  // 전체 초안에 생성 옵션 일괄 적용
  const handleApplyBulkOptions = (options: { generateNaver: boolean; generateNotion: boolean }) => {
    const idleDrafts = drafts.filter(d => d.nicheId === activeNicheId && d.status === 'idle');

    if (idleDrafts.length === 0) {
      alert('적용할 대기 항목이 없습니다.');
      return;
    }

    setDrafts(prev => prev.map(d =>
      d.nicheId === activeNicheId && d.status === 'idle'
        ? { ...d, generateNaver: options.generateNaver, generateNotion: options.generateNotion, lastModified: Date.now() }
        : d
    ));

    alert(`${idleDrafts.length}개 항목에 옵션이 적용되었습니다.\n- 네이버: ${options.generateNaver ? '생성' : '미생성'}\n- Notion: ${options.generateNotion ? '생성' : '미생성'}`);
  };

  const handleBulkGenerate = async (options?: { generateNaver?: boolean; generateNotion?: boolean }) => {
    if (!settings.geminiApiKey) {
      setIsSettingsOpen(true);
      return;
    }

    const idleDrafts = drafts.filter(d => d.nicheId === activeNicheId && d.status === 'idle');

    if (idleDrafts.length === 0) {
      alert('생성할 대기 항목이 없습니다.');
      return;
    }

    // AI 플랫폼이고 옵션이 전달된 경우, 모든 idle drafts에 옵션 적용
    if (activeNicheId === NicheType.AI && options) {
      const { generateNaver = true, generateNotion = true } = options;

      // 둘 다 체크 해제된 경우
      if (!generateNaver && !generateNotion) {
        alert('최소 하나 이상의 콘텐츠를 선택해주세요.');
        return;
      }

      // 모든 idle drafts에 생성 옵션 적용
      setDrafts(prev => prev.map(d =>
        d.nicheId === activeNicheId && d.status === 'idle'
          ? { ...d, generateNaver, generateNotion, lastModified: Date.now() }
          : d
      ));
    }

    // 순차적으로 생성
    for (const draft of idleDrafts) {
      // 상태를 generating으로 변경
      setDrafts(prev => prev.map(d =>
        d.id === draft.id
          ? { ...d, status: 'generating' as const, lastModified: Date.now() }
          : d
      ));

      // Context에 제품 정보 추가 (링크 제외)
      const draftEnhancedContext = draft.context + (draft.products ? formatProductsForContext(draft.products) : '');

      try {
        if (activeNicheId === NicheType.AI) {
          // AI 플랫폼: 선택적 생성
          const shouldGenerateNaver = draft.generateNaver ?? true;
          const shouldGenerateNotion = draft.generateNotion ?? true;

          let naverContent = '';
          let notionContent = '';

          // 네이버 콘텐츠 생성 (선택된 경우에만)
          if (shouldGenerateNaver) {
            naverContent = await generateBlogDraft(
              settings.geminiApiKey,
              activeNiche,
              draft.title,
              draftEnhancedContext,
              draft.naverPrompt
            );
          }

          // 노션 콘텐츠 생성 (선택된 경우에만)
          if (shouldGenerateNotion) {
            notionContent = await generateBlogDraft(
              settings.geminiApiKey,
              activeNiche,
              draft.title,
              draftEnhancedContext,
              draft.userPrompt
            );

            // 제품 정보가 있으면 쿠팡 버튼 삽입
            if (draft.products && draft.products.length > 0) {
              notionContent = insertCoupangButtons(notionContent, draft.products);
            }
          }

          setDrafts(prev => prev.map(d =>
            d.id === draft.id
              ? {
                  ...d,
                  content: notionContent,
                  naverContent: naverContent,
                  status: 'generated' as const,
                  lastModified: Date.now()
                }
              : d
          ));
        } else {
          // 다른 플랫폼: 노션만 생성
          let generatedContent = await generateBlogDraft(
            settings.geminiApiKey,
            activeNiche,
            draft.title,
            draftEnhancedContext,
            draft.userPrompt
          );

          // Tech 플랫폼이고 제품 정보가 있으면 쿠팡 버튼 삽입
          if (activeNicheId === NicheType.TECH && draft.products && draft.products.length > 0) {
            generatedContent = insertCoupangButtons(generatedContent, draft.products);
          }

          setDrafts(prev => prev.map(d =>
            d.id === draft.id
              ? {
                  ...d,
                  content: generatedContent,
                  naverContent: '',
                  status: 'generated' as const,
                  lastModified: Date.now()
                }
              : d
          ));
        }
      } catch (error: any) {
        console.error(`Draft ${draft.title} 생성 실패:`, error);
        setDrafts(prev => prev.map(d =>
          d.id === draft.id
            ? {
                ...d,
                status: 'error' as const,
                error: error.message || '생성 실패',
                lastModified: Date.now()
              }
            : d
        ));
      }

      // 요청 간 딜레이 (API rate limit 고려)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    alert(`일괄 생성 완료! 총 ${idleDrafts.length}개 처리`);
  };

  const handleDragStart = (e: React.DragEvent, nicheId: NicheType) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nicheId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetNicheId: NicheType) => {
    e.preventDefault();
    const draggedNicheId = e.dataTransfer.getData('text/plain') as NicheType;

    if (draggedNicheId === targetNicheId) return;

    const newOrder = [...nicheOrder];
    const draggedIndex = newOrder.indexOf(draggedNicheId);
    const targetIndex = newOrder.indexOf(targetNicheId);

    // 배열에서 요소 이동
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedNicheId);

    setNicheOrder(newOrder);
  };

  const handleBulkNotionUpload = async () => {
    const currentNicheSettings = settings.nicheSettings[activeNicheId];

    if (!currentNicheSettings?.notionApiKey || !currentNicheSettings?.notionDatabaseId) {
      alert(`${NICHES.find(n => n.id === activeNicheId)?.label} 블로그의 Notion 설정이 필요합니다.\n설정 메뉴에서 API Key와 Database ID를 입력해주세요.`);
      setIsSettingsOpen(true);
      return;
    }

    const generatedDrafts = drafts.filter(d => d.nicheId === activeNicheId && d.status === 'generated');

    if (generatedDrafts.length === 0) {
      alert('Notion에 저장할 생성된 초안이 없습니다.');
      return;
    }

    const confirmed = confirm(`${generatedDrafts.length}개의 초안을 Notion에 일괄 저장하시겠습니까?`);
    if (!confirmed) return;

    let successCount = 0;
    let failCount = 0;

    for (const draft of generatedDrafts) {
      try {
        const result = await createNotionPage(
          currentNicheSettings.notionApiKey,
          currentNicheSettings.notionDatabaseId,
          draft.title,
          draft.content,
          draft.scheduledDate
        );

        if (result.success) {
          setDrafts(prev => prev.map(d =>
            d.id === draft.id
              ? { ...d, status: 'published' as const, lastModified: Date.now() }
              : d
          ));
          successCount++;
        } else {
          failCount++;
        }

        // API rate limit 고려하여 딜레이
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Draft ${draft.title} 업로드 실패:`, error);
        failCount++;
      }
    }

    alert(`일괄 저장 완료!\n성공: ${successCount}개\n실패: ${failCount}개`);
  };

  const handleNotionUpload = async () => {
    const currentNicheSettings = settings.nicheSettings[activeNicheId];

    if (!currentNicheSettings?.notionApiKey || !currentNicheSettings?.notionDatabaseId) {
      alert(`${activeNiche.label} 블로그의 Notion 설정이 필요합니다.\n설정 메뉴에서 API Key와 Database ID를 입력해주세요.`);
      setIsSettingsOpen(true);
      return;
    }

    if (!currentDraft) {
      alert('업로드할 초안을 선택해주세요.');
      return;
    }

    if (!currentDraft.content || currentDraft.content.trim() === '') {
      alert('업로드할 내용이 없습니다. 먼저 AI 초안을 생성해주세요.');
      return;
    }

    // 업로드 상태 시작
    setIsUploading(true);
    setUploadSuccess(false);

    try {
      // 노션 페이지 생성
      const result = await createNotionPage(
        currentNicheSettings.notionApiKey,
        currentNicheSettings.notionDatabaseId,
        currentDraft.title,
        currentDraft.content,
        currentDraft.scheduledDate
      );

      if (result.success) {
        // 상태를 published로 변경
        setDrafts(prev => prev.map(d =>
          d.id === currentDraftId
            ? { ...d, status: 'published' as const, lastModified: Date.now() }
            : d
        ));

        // 성공 표시
        setUploadSuccess(true);

        // 2초 후 원래 상태로 복구
        setTimeout(() => {
          setUploadSuccess(false);
        }, 2000);
      } else {
        alert(`❌ Notion 업로드 실패\n\n에러: ${result.error}\n\n설정을 확인해주세요:\n1. Notion API Key가 올바른지\n2. Database ID가 올바른지\n3. Integration이 데이터베이스에 연결되었는지`);
      }
    } catch (error: any) {
      console.error('Notion Upload Error:', error);
      alert(`❌ 업로드 중 오류 발생\n\n${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // --- Authentication Checks ---
  // 인증 확인 로딩 중
  if (authLoading) {
    return <LoadingScreen />;
  }

  // 인증되지 않은 경우
  if (!isAuthenticated) {
    return (
      <LoginDialog
        isOpen={true}
        onLogin={async (password) => {
          setLoginError(null);
          const success = await login(password);
          if (!success) {
            setLoginError('비밀번호가 올바르지 않습니다');
          }
          return success;
        }}
        isLoading={authLoading}
        error={loginError}
      />
    );
  }

  // --- Main App Render ---
  return (
    <div className="flex h-screen w-full bg-[#111418] text-slate-100 font-sans">
      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings}
        onSave={saveSettings}
      />

      {/* 1. Sidebar */}
      <div className="w-16 bg-[#0D1014] border-r border-slate-800/50 flex flex-col items-center py-6 gap-6 z-30">
        
        {/* AI Tab (Global Mode) */}
        <button
           onClick={() => handleViewModeChange('AI')}
           className={`p-2.5 rounded-xl transition-all duration-200 group relative ${viewMode === 'AI' ? 'bg-[#0EA5E9] text-white shadow-lg shadow-blue-900/40' : 'text-slate-500 hover:text-white'}`}
        >
           <Icon name="Sparkles" size={20} className={viewMode === 'AI' ? 'text-white' : ''} />
           <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap border border-slate-700 pointer-events-none transition-opacity z-50">
              AI
            </span>
        </button>

        <div className="w-8 h-px bg-slate-800/50"></div>

        {/* Niche Tabs */}
        {nicheOrder.map(nicheId => {
          const niche = NICHES.find(n => n.id === nicheId);
          if (!niche) return null;

          return (
            <button
              key={niche.id}
              draggable
              onDragStart={(e) => handleDragStart(e, niche.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, niche.id)}
              onClick={() => handleViewModeChange('NICHE', niche.id)}
              className={`p-2.5 rounded-xl transition-all duration-200 group relative cursor-move ${viewMode === 'NICHE' && activeNicheId === niche.id ? 'bg-slate-800 text-white shadow' : 'text-slate-600 hover:bg-slate-800/50 hover:text-slate-300'}`}
            >
              <Icon name={niche.icon} size={20} className={viewMode === 'NICHE' && activeNicheId === niche.id ? niche.color : ''} />
              <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap border border-slate-700 pointer-events-none transition-opacity z-50">
                {niche.label}
              </span>
            </button>
          );
        })}

        <div className="mt-auto">
          <button onClick={() => setIsSettingsOpen(true)} className="p-3 text-slate-600 hover:text-white transition-colors">
            <Icon name="Settings" size={20} />
          </button>
        </div>
      </div>

      {/* 2. Queue Panel */}
      <QueuePanel
        nicheId={activeNicheId}
        drafts={drafts}
        currentDraftId={currentDraftId}
        onDraftSelect={setCurrentDraftId}
        onBulkGenerate={handleBulkGenerate}
        onBulkNotionUpload={handleBulkNotionUpload}
        onAddTopics={handleAddTopics}
        onDeleteDraft={handleDeleteDraft}
        onBatchScheduleDates={handleBatchScheduleDates}
        onOpenKeywordAnalysis={() => setIsKeywordAnalysisOpen(true)}
        onApplyBulkOptions={handleApplyBulkOptions}
        onOpenBulkProductAssigner={() => setIsBulkAssignerOpen(true)}
      />

      {/* 3. Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {currentDraft ? (
          <>
            {/* Column 1: Input Form */}
            <div className={`${viewMode === 'AI' ? 'w-[420px]' : 'w-[480px]'} bg-[#111418] flex flex-col border-r border-slate-800 overflow-y-auto transition-all duration-300`}>
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-800/50 flex items-center gap-3">
                 <div className="p-2 bg-slate-800 rounded-lg">
                    <Icon name="ArrowLeftRight" size={20} className="text-[#0EA5E9]" />
                 </div>
                 <div>
                    <h1 className="text-lg font-bold text-white leading-none">Blog Sync Pro</h1>
                    <p className="text-xs text-slate-500 font-medium mt-1">통합 초안 생성기</p>
                 </div>
              </div>

              <div className="p-6 space-y-6">
                
                {/* Section: Basic Info */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
                    <Icon name="FileText" size={16} className="text-[#0EA5E9]" />
                    기본 정보 설정
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">블로그 글 제목</label>
                      <input 
                        type="text" 
                        value={currentDraft.title}
                        onChange={(e) => updateCurrentDraft('title', e.target.value)}
                        placeholder="블로그 주제나 제목을 입력하세요"
                        className="w-full bg-[#1C2128] border border-slate-700/50 rounded-lg px-4 py-3 text-base text-white focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] outline-none transition-all placeholder:text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">참고 내용 및 문맥 (Context)</label>
                      <textarea 
                        value={currentDraft.context}
                        onChange={(e) => updateCurrentDraft('context', e.target.value)}
                        placeholder="여기에 참고할 자료나 핵심 내용을 붙여넣으세요..."
                        className="w-full h-32 bg-[#1C2128] border border-slate-700/50 rounded-lg px-4 py-3 text-sm text-slate-300 focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] outline-none resize-none transition-all placeholder:text-slate-600 leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-800/50 w-full my-2"></div>

                {/* Section: Prompt & Persona */}
                <div>
                   <div className="flex items-center justify-between mb-3">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                        <Icon name="Wand2" size={16} className="text-[#0EA5E9]" />
                        프롬프트 설정
                      </h3>
                      <button
                        onClick={() => {
                          updateCurrentDraft('userPrompt', '');
                          if (activeNicheId === NicheType.AI) {
                            updateCurrentDraft('naverPrompt', '');
                          }
                        }}
                        className="text-xs text-[#0EA5E9] font-medium hover:underline"
                      >
                        모두 초기화
                      </button>
                   </div>

                   <div className="space-y-3">
                      {/* AI 플랫폼: 네이버 프롬프트 */}
                      {activeNicheId === NicheType.AI && (
                        <div className="bg-[#161B22] border border-slate-700 rounded-lg p-4 relative group hover:border-[#0EA5E9]/50 transition-colors">
                          <div className="flex items-start gap-3 mb-3">
                            <Icon name="PenLine" className="text-green-500 mt-0.5" size={18} />
                            <div className="flex-1">
                              <h4 className="text-sm font-bold text-white">네이버 블로그 페르소나</h4>
                              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                네이버 블로그 에디터에 표시될 콘텐츠용 프롬프트
                              </p>
                            </div>
                            <div className="w-1.5 h-8 bg-green-700 rounded-full"></div>
                          </div>

                          <textarea
                            value={currentDraft.naverPrompt}
                            onChange={(e) => updateCurrentDraft('naverPrompt', e.target.value)}
                            placeholder="[네이버용] 예: SEO 최적화, 이미지 삽입 위치 표시, 친근한 말투..."
                            className="w-full bg-[#0D1117] border border-slate-800 rounded-md p-3 text-sm text-slate-300 focus:border-[#0EA5E9] outline-none resize-none placeholder:text-slate-600 min-h-[80px]"
                          />
                          <p className="mt-2 text-xs text-slate-500 italic">
                            💡 이 프롬프트는 AI 플랫폼의 모든 글에 자동으로 적용됩니다
                          </p>
                        </div>
                      )}

                      {/* TECH 니치 전용: 제품 정보 추가 */}
                      {activeNicheId === NicheType.TECH && currentDraft && (
                        <div className="mb-4 space-y-3">
                          {/* 노션에서 제품 가져오기 버튼 */}
                          <button
                            onClick={() => setIsNotionImporterOpen(true)}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                          >
                            <Icon name="Download" size={18} />
                            노션에서 제품 대량 가져오기
                          </button>
                          <p className="text-xs text-slate-400 text-center">
                            노션 DB에서 70개 제품을 가져와 5개씩 그룹핑하여 블로그 초안 생성
                          </p>

                          <div className="h-px bg-slate-700 w-full"></div>

                          <ProductInfoManager
                            nicheId={activeNicheId}
                            currentProducts={currentDraft.products || []}
                            onSaveProducts={(products) => {
                              // 제품 정보를 Context 형식으로 변환
                              let context = `# ${currentDraft.title}\n\n`;
                              context += `총 ${products.length}개 제품 비교\n\n`;
                              context += `---\n\n`;

                              products.forEach((product, index) => {
                                context += `## ${index + 1}위: ${product.name}\n\n`;
                                context += `**기본 정보**\n`;
                                if (product.price) context += `- 가격: ${product.price}\n`;
                                if (product.coupangLink) context += `- 쿠팡 링크: ${product.coupangLink}\n`;
                                context += '\n';

                                // specs와 features가 있으면 상세 정보로 추가
                                if (product.specs && product.specs.trim()) {
                                  context += `**주요 스펙**\n${product.specs}\n\n`;
                                }
                                if (product.features && product.features.trim()) {
                                  context += `**특징/장점**\n${product.features}\n\n`;
                                }

                                context += `---\n\n`;
                              });

                              setDrafts(prev => prev.map(d =>
                                d.id === currentDraftId
                                  ? { ...d, products, context, lastModified: Date.now() }
                                  : d
                              ));
                            }}
                          />
                        </div>
                      )}

                      {/* RESTAURANT 니치 전용: 맛집 검색 버튼 */}
                      {activeNicheId === NicheType.RESTAURANT && (
                        <div className="mb-4">
                          <button
                            onClick={() => setIsRestaurantSearchOpen(true)}
                            className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-bold hover:from-orange-600 hover:to-red-600 transition-all flex items-center justify-center gap-2 shadow-lg"
                          >
                            <Icon name="Search" size={18} />
                            🍽️ 맛집 검색하기
                          </button>
                          <p className="text-xs text-slate-400 mt-2 text-center">
                            💡 네이버 플레이스에서 맛집 정보를 가져와 프롬프트에 추가합니다
                          </p>
                        </div>
                      )}

                      {/* SEO 니치 전용: 지역 데이터 관리 */}
                      {activeNicheId === NicheType.SEO && (
                        <div className="mb-4">
                          <RegionalDataManager
                            onAddToContext={handleRegionalDataAdd}
                            onBulkGenerate={handleRegionalBulkGenerate}
                            dataType="commercial"
                          />
                        </div>
                      )}

                      {/* REAL_ESTATE 니치 전용: 아파트 단지 데이터 관리 */}
                      {activeNicheId === NicheType.REAL_ESTATE && (
                        <div className="mb-4">
                          <RegionalDataManager
                            onAddToContext={handleRegionalDataAdd}
                            onBulkGenerate={handleRegionalBulkGenerate}
                            dataType="apartment"
                          />
                        </div>
                      )}

                      {/* Notion 페르소나 */}
                      <div className="bg-[#161B22] border border-slate-700 rounded-lg p-4 relative group hover:border-[#0EA5E9]/50 transition-colors">
                        <div className="flex items-start gap-3 mb-3">
                          <Icon name="CheckSquare" className="text-emerald-500 mt-0.5" size={18} />
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-white">Notion 페르소나 ({activeNiche.label})</h4>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                              {activeNiche.description}
                            </p>
                          </div>
                          <div className="w-1.5 h-8 bg-slate-700 rounded-full"></div>
                        </div>

                        <textarea
                          value={currentDraft.userPrompt}
                          onChange={(e) => updateCurrentDraft('userPrompt', e.target.value)}
                          placeholder="[필수 요구사항] 예: 30대 직장인을 타겟으로 해줘, 친근한 말투로..."
                          className="w-full bg-[#0D1117] border border-slate-800 rounded-md p-3 text-sm text-slate-300 focus:border-[#0EA5E9] outline-none resize-none placeholder:text-slate-600 min-h-[80px]"
                        />
                        <p className="mt-2 text-xs text-slate-500 italic">
                          💡 이 프롬프트는 {activeNiche.label} 플랫폼의 모든 글에 자동으로 적용됩니다
                        </p>
                      </div>
                   </div>
                </div>

                {/* AI 플랫폼 전용: 생성 옵션 선택 */}
                {activeNicheId === NicheType.AI && currentDraft && (
                  <div className="px-6 py-4 bg-[#161B22] border border-slate-700 rounded-lg">
                    <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <Icon name="Settings" size={14} className="text-[#0EA5E9]" />
                      생성 옵션 선택
                    </h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={currentDraft.generateNaver ?? true}
                          onChange={(e) => {
                            setDrafts(prev => prev.map(d =>
                              d.id === currentDraftId
                                ? { ...d, generateNaver: e.target.checked, lastModified: Date.now() }
                                : d
                            ));
                          }}
                          className="w-4 h-4 rounded border-slate-600 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                          <span className="font-bold text-green-400">네이버</span> 블로그 콘텐츠 생성
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={currentDraft.generateNotion ?? true}
                          onChange={(e) => {
                            setDrafts(prev => prev.map(d =>
                              d.id === currentDraftId
                                ? { ...d, generateNotion: e.target.checked, lastModified: Date.now() }
                                : d
                            ));
                          }}
                          className="w-4 h-4 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                          <span className="font-bold text-emerald-400">Notion</span> 페이지 콘텐츠 생성
                        </span>
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 mt-3 italic">
                      💡 필요한 콘텐츠만 선택하여 API 사용량을 절약할 수 있습니다
                    </p>
                  </div>
                )}

                {/* Generate Button */}
                <div className="pt-4 pb-8">
                  {isGenerating ? (
                    <div className="space-y-2">
                      <button
                        disabled
                        className="w-full py-3.5 rounded-lg font-bold text-white bg-slate-700 cursor-not-allowed shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <Icon name="Loader2" className="animate-spin" size={18} /> 생성 중...
                      </button>
                      <button
                        onClick={handleCancelGenerate}
                        className="w-full py-2.5 rounded-lg font-medium text-red-400 bg-red-900/20 hover:bg-red-900/30 border border-red-900/50 transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <Icon name="X" size={16} /> 생성 취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerate}
                      className="w-full py-3.5 rounded-lg font-bold text-white bg-[#0EA5E9] hover:bg-[#0284C7] shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <Icon name="Wand2" size={18} /> AI 초안 생성하기
                    </button>
                  )}
                  <p className="text-center text-[10px] text-slate-500 mt-3">
                    {isGenerating
                      ? activeNicheId === NicheType.AI
                        ? '네이버와 노션 콘텐츠를 각각 생성 중입니다...'
                        : '노션 콘텐츠를 생성 중입니다...'
                      : 'Generate 버튼 클릭 시 약 10~15초 소요됩니다.'
                    }
                  </p>
                </div>

              </div>
            </div>

            {/* Column 2: Naver Editor (Only visible in AI Mode) */}
            {viewMode === 'AI' && (
              <div className="flex-1 min-w-0 bg-[#1e2329] border-r border-slate-800">
                <NaverEditor
                  content={currentDraft.naverContent || ''}
                  onChange={(val) => updateCurrentDraft('naverContent', val)}
                  imgbbApiKey={settings.imgbbApiKey}
                />
              </div>
            )}

            {/* Column 3: Notion Editor */}
            <div className="flex-1 min-w-0 bg-[#15191E]">
               <NotionEditor
                 content={currentDraft.content}
                 onChange={(val) => updateCurrentDraft('content', val)}
                 onGenerateNotion={handleNotionUpload}
                 isUploading={isUploading}
                 uploadSuccess={uploadSuccess}
                 imgbbApiKey={settings.imgbbApiKey}
               />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
            <Icon name="ArrowLeftRight" size={48} className="mb-4 text-slate-800" />
            <p>초안을 선택하거나 새로 만드세요.</p>
          </div>
        )}
      </div>

      {/* Restaurant Search Dialog */}
      <RestaurantSearchDialog
        isOpen={isRestaurantSearchOpen}
        onClose={() => setIsRestaurantSearchOpen(false)}
        onSelectRestaurant={handleRestaurantSelect}
      />

      {/* Keyword Analysis Dialog */}
      <KeywordAnalysisDialog
        isOpen={isKeywordAnalysisOpen}
        onClose={() => setIsKeywordAnalysisOpen(false)}
        onAddKeywords={handleAddTopics}
      />

      {/* Notion Product Importer Dialog */}
      <NotionProductImporter
        isOpen={isNotionImporterOpen}
        onClose={() => setIsNotionImporterOpen(false)}
        onImportComplete={handleNotionImportComplete}
      />

      {/* Bulk Product Assigner Dialog */}
      <BulkProductAssigner
        isOpen={isBulkAssignerOpen}
        onClose={() => setIsBulkAssignerOpen(false)}
        drafts={drafts.filter(d => d.nicheId === NicheType.TECH)}
        onAssignComplete={(updatedDrafts) => {
          setDrafts(prev => prev.map(d => {
            const updated = updatedDrafts.find(u => u.id === d.id);
            return updated || d;
          }));
        }}
      />
    </div>
  );
};

export default App;