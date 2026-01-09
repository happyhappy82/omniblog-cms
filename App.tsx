import React, { useState, useEffect } from 'react';
import { NICHES, MOCK_INITIAL_CONTENT } from './constants';
import { NicheType, Draft, AppSettings } from './types';
import { Icon } from './components/Icon';
import { SettingsDialog } from './components/SettingsDialog';
import { NotionEditor } from './components/NotionEditor';
import { NaverEditor } from './components/NaverEditor';
import { QueuePanel } from './components/QueuePanel';
import { generateBlogDraft } from './services/geminiService';
import { createNotionPage } from './services/notionService';

const App = () => {
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
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return NICHES.filter(n => n.id !== NicheType.AI).map(n => n.id);
      }
    }
    return NICHES.filter(n => n.id !== NicheType.AI).map(n => n.id);
  });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
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
      [NicheType.HOSPITAL]: {
        notionApiKey: import.meta.env.VITE_HOSPITAL_NOTION_API_KEY || '',
        notionDatabaseId: import.meta.env.VITE_HOSPITAL_NOTION_DATABASE_ID || ''
      },
      [NicheType.RESTAURANT]: {
        notionApiKey: import.meta.env.VITE_RESTAURANT_NOTION_API_KEY || '',
        notionDatabaseId: import.meta.env.VITE_RESTAURANT_NOTION_DATABASE_ID || ''
      },
      [NicheType.TRAVEL]: {
        notionApiKey: import.meta.env.VITE_TRAVEL_NOTION_API_KEY || '',
        notionDatabaseId: import.meta.env.VITE_TRAVEL_NOTION_DATABASE_ID || ''
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
          nicheSettings: {
            [NicheType.AI]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.TECH]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.REAL_ESTATE]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.STOCK]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.POLICY]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.HOSPITAL]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.RESTAURANT]: { notionApiKey: '', notionDatabaseId: '' },
            [NicheType.TRAVEL]: { notionApiKey: '', notionDatabaseId: '' },
          }
        };
        setSettings(migratedSettings);
      } else if (parsed.naverSettings) {
        // naverSettings가 있는 경우 제거하고 마이그레이션
        const { naverSettings, ...rest } = parsed;
        setSettings({
          ...rest,
          nicheSettings: {
            [NicheType.AI]: { notionApiKey: '', notionDatabaseId: '' },
            ...rest.nicheSettings
          }
        });
      } else if (!parsed.nicheSettings?.[NicheType.AI]) {
        // AI nicheSettings가 없는 경우 추가
        setSettings({
          ...parsed,
          nicheSettings: {
            [NicheType.AI]: { notionApiKey: '', notionDatabaseId: '' },
            ...parsed.nicheSettings
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
        // 기존 데이터 마이그레이션: status, createdAt, naverPrompt 필드 추가
        const migratedDrafts = parsed.map((d: any) => ({
          ...d,
          status: d.status || 'idle',
          createdAt: d.createdAt || d.lastModified || Date.now(),
          naverPrompt: d.naverPrompt || '',
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
    const newDraft: Draft = {
      id: crypto.randomUUID(),
      nicheId: nicheId,
      title: '',
      context: '',
      userPrompt: '',
      naverPrompt: '',
      content: '',
      naverContent: '',
      status: 'idle',
      createdAt: now,
      lastModified: now
    };
    setDrafts(prev => [...prev, newDraft]);
    setCurrentDraftId(newDraft.id);
  };

  const handleAddTopics = (topics: string[]) => {
    const now = Date.now();
    const newDrafts: Draft[] = topics.map((topic, index) => ({
      id: crypto.randomUUID(),
      nicheId: activeNicheId,
      title: topic,
      context: '',
      userPrompt: '',
      naverPrompt: '',
      content: '',
      naverContent: '',
      status: 'idle',
      createdAt: now + index, // 약간의 차이를 둬서 순서 보장
      lastModified: now + index
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

  const updateCurrentDraft = (field: keyof Draft, value: string) => {
    if (!currentDraftId) return;
    setDrafts(prev => prev.map(d => 
      d.id === currentDraftId 
        ? { ...d, [field]: value, lastModified: Date.now() } 
        : d
    ));
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

    try {
      if (activeNicheId === NicheType.AI) {
        // AI 플랫폼: 네이버와 노션 각각 생성
        // 네이버 콘텐츠 생성
        const naverContent = await generateBlogDraft(
          settings.geminiApiKey,
          activeNiche,
          currentDraft.title,
          currentDraft.context,
          currentDraft.naverPrompt
        );

        if (controller.signal.aborted) {
          throw new Error('생성이 취소되었습니다.');
        }

        // 노션 콘텐츠 생성
        const notionContent = await generateBlogDraft(
          settings.geminiApiKey,
          activeNiche,
          currentDraft.title,
          currentDraft.context,
          currentDraft.userPrompt
        );

        if (controller.signal.aborted) {
          throw new Error('생성이 취소되었습니다.');
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
        const generatedContent = await generateBlogDraft(
          settings.geminiApiKey,
          activeNiche,
          currentDraft.title,
          currentDraft.context,
          currentDraft.userPrompt
        );

        if (controller.signal.aborted) {
          throw new Error('생성이 취소되었습니다.');
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

  const handleBulkGenerate = async () => {
    if (!settings.geminiApiKey) {
      setIsSettingsOpen(true);
      return;
    }

    const idleDrafts = drafts.filter(d => d.nicheId === activeNicheId && d.status === 'idle');

    if (idleDrafts.length === 0) {
      alert('생성할 대기 항목이 없습니다.');
      return;
    }

    // 순차적으로 생성
    for (const draft of idleDrafts) {
      // 상태를 generating으로 변경
      setDrafts(prev => prev.map(d =>
        d.id === draft.id
          ? { ...d, status: 'generating' as const, lastModified: Date.now() }
          : d
      ));

      try {
        if (activeNicheId === NicheType.AI) {
          // AI 플랫폼: 네이버와 노션 각각 생성
          const naverContent = await generateBlogDraft(
            settings.geminiApiKey,
            activeNiche,
            draft.title,
            draft.context,
            draft.naverPrompt
          );

          const notionContent = await generateBlogDraft(
            settings.geminiApiKey,
            activeNiche,
            draft.title,
            draft.context,
            draft.userPrompt
          );

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
          const generatedContent = await generateBlogDraft(
            settings.geminiApiKey,
            activeNiche,
            draft.title,
            draft.context,
            draft.userPrompt
          );

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
          draft.content
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
        currentDraft.content
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
                      </div>
                   </div>
                </div>

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
    </div>
  );
};

export default App;