import React, { useState } from 'react';
import { Icon } from './Icon';

interface KeywordData {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  competitionLevel: string;
}

interface KeywordAnalysisDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddKeywords: (keywords: string[]) => void;
}

const TITLE_TEMPLATES = [
  { id: 'summary', label: '총정리', template: (kw: string) => `${kw} 총정리: 알아야 할 모든 것` },
  { id: 'guide', label: '완벽 가이드', template: (kw: string) => `${kw} 완벽 가이드 (2024)` },
  { id: 'allinone', label: '올인원', template: (kw: string) => `${kw} 올인원 가이드: 초보부터 전문가까지` },
  { id: 'top3', label: 'TOP 3', template: (kw: string) => `${kw} TOP 3 추천 및 비교` },
  { id: 'top5', label: 'TOP 5', template: (kw: string) => `${kw} TOP 5 완벽 비교 분석` },
  { id: 'top10', label: 'TOP 10', template: (kw: string) => `${kw} TOP 10 총정리` },
  { id: 'howto', label: '사용법', template: (kw: string) => `${kw} 사용법 A to Z` },
  { id: 'compare', label: '비교 분석', template: (kw: string) => `${kw} 비교 분석: 장단점 총정리` },
  { id: 'beginner', label: '초보자용', template: (kw: string) => `${kw} 초보자를 위한 완벽 입문 가이드` },
  { id: 'tips', label: '꿀팁', template: (kw: string) => `${kw} 꿀팁 모음: 전문가가 알려주는 비법` },
  { id: 'review', label: '후기', template: (kw: string) => `${kw} 실제 사용 후기 및 솔직 리뷰` },
  { id: 'price', label: '가격', template: (kw: string) => `${kw} 가격 비교 및 최저가 정보` },
];

export const KeywordAnalysisDialog: React.FC<KeywordAnalysisDialogProps> = ({
  isOpen,
  onClose,
  onAddKeywords,
}) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      setError('키워드를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setKeywords([]);
    setSelectedKeywords(new Set());
    setSelectedTitles(new Set());

    try {
      const apiUrl = import.meta.env.DEV
        ? 'http://localhost:3007/api/keyword-analysis'
        : '/api/keyword-analysis';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: searchKeyword.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '키워드 분석에 실패했습니다.');
      }

      if (data.keywords && data.keywords.length > 0) {
        setKeywords(data.keywords);
      } else {
        setError('관련 키워드를 찾을 수 없습니다.');
      }
    } catch (err: any) {
      console.error('Keyword analysis error:', err);
      setError(err.message || '키워드 분석 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleKeywordSelection = (keyword: string) => {
    const newSelected = new Set(selectedKeywords);
    if (newSelected.has(keyword)) {
      newSelected.delete(keyword);
    } else {
      newSelected.add(keyword);
    }
    setSelectedKeywords(newSelected);
  };

  const toggleTitleSelection = (title: string) => {
    const newSelected = new Set(selectedTitles);
    if (newSelected.has(title)) {
      newSelected.delete(title);
    } else {
      newSelected.add(title);
    }
    setSelectedTitles(newSelected);
  };

  const selectAll = () => {
    const allKeywords = new Set(keywords.map(k => k.keyword));
    setSelectedKeywords(allKeywords);
  };

  const deselectAll = () => {
    setSelectedKeywords(new Set());
  };

  const handleAddSelected = () => {
    const itemsToAdd: string[] = [];

    // 선택된 키워드 추가
    selectedKeywords.forEach(kw => itemsToAdd.push(kw));

    // 선택된 제목 추가
    selectedTitles.forEach(title => itemsToAdd.push(title));

    if (itemsToAdd.length === 0) {
      setError('추가할 키워드나 제목을 선택해주세요.');
      return;
    }

    onAddKeywords(itemsToAdd);
    onClose();
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const getCompetitionColor = (level: string): string => {
    switch (level?.toUpperCase()) {
      case 'LOW':
        return 'text-green-400 bg-green-900/30';
      case 'MEDIUM':
        return 'text-yellow-400 bg-yellow-900/30';
      case 'HIGH':
        return 'text-red-400 bg-red-900/30';
      default:
        return 'text-slate-400 bg-slate-800';
    }
  };

  const getCompetitionLabel = (level: string): string => {
    switch (level?.toUpperCase()) {
      case 'LOW':
        return '낮음';
      case 'MEDIUM':
        return '중간';
      case 'HIGH':
        return '높음';
      default:
        return '-';
    }
  };

  // 선택된 키워드들에 대한 제목 생성
  const generateTitles = (): { keyword: string; title: string; templateId: string }[] => {
    const titles: { keyword: string; title: string; templateId: string }[] = [];
    const keywordsToUse = selectedKeywords.size > 0
      ? Array.from(selectedKeywords)
      : keywords.slice(0, 3).map(k => k.keyword);

    keywordsToUse.forEach(kw => {
      TITLE_TEMPLATES.forEach(template => {
        titles.push({
          keyword: kw,
          title: template.template(kw),
          templateId: template.id,
        });
      });
    });

    return titles;
  };

  const generatedTitles = keywords.length > 0 ? generateTitles() : [];
  const totalSelected = selectedKeywords.size + selectedTitles.size;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1C2128] rounded-xl w-full max-w-7xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/20 rounded-lg">
              <Icon name="Search" size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">키워드 분석</h2>
              <p className="text-xs text-slate-400">Google 자동완성 기반 관련 키워드 분석</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Icon name="X" size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Search Section */}
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex gap-3">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="분석할 키워드를 입력하세요 (예: 블로그 수익화)"
              className="flex-1 bg-[#0D1014] border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none placeholder:text-slate-500"
            />
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Icon name="Loader2" size={18} className="animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  <Icon name="Search" size={18} />
                  분석하기
                </>
              )}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Column - Keywords */}
          <div className="w-1/2 border-r border-slate-700 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">관련 키워드</h3>
                {keywords.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="px-2 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                    >
                      전체 선택
                    </button>
                    <button
                      onClick={deselectAll}
                      className="px-2 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                    >
                      선택 해제
                    </button>
                  </div>
                )}
              </div>
              {keywords.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  총 {keywords.length}개 / {selectedKeywords.size}개 선택됨
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {keywords.length > 0 ? (
                <>
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-800/50 text-xs font-bold text-slate-400 sticky top-0">
                    <div className="col-span-1"></div>
                    <div className="col-span-5">키워드</div>
                    <div className="col-span-2 text-right">월 검색량</div>
                    <div className="col-span-2 text-right">CPC</div>
                    <div className="col-span-2 text-center">경쟁도</div>
                  </div>

                  {/* Keyword List */}
                  <div className="divide-y divide-slate-800/50">
                    {keywords.map((kw, index) => (
                      <div
                        key={index}
                        onClick={() => toggleKeywordSelection(kw.keyword)}
                        className={`grid grid-cols-12 gap-2 px-4 py-2.5 cursor-pointer transition-colors ${
                          selectedKeywords.has(kw.keyword)
                            ? 'bg-purple-900/20 border-l-2 border-purple-500'
                            : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <div className="col-span-1 flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedKeywords.has(kw.keyword)}
                            onChange={() => {}}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 checked:bg-purple-600 checked:border-purple-600"
                          />
                        </div>
                        <div className="col-span-5 text-sm text-white font-medium truncate">
                          {kw.keyword}
                        </div>
                        <div className="col-span-2 text-sm text-slate-300 text-right">
                          {formatNumber(kw.searchVolume)}
                        </div>
                        <div className="col-span-2 text-sm text-slate-300 text-right">
                          ${kw.cpc.toFixed(2)}
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getCompetitionColor(kw.competitionLevel)}`}>
                            {getCompetitionLabel(kw.competitionLevel)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6">
                  <Icon name="Search" size={40} className="mb-3 text-slate-700" />
                  <p className="text-sm">키워드를 입력하고 분석하세요</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Title Suggestions */}
          <div className="w-1/2 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
              <h3 className="text-sm font-bold text-white">제목 추천</h3>
              <p className="text-xs text-slate-500 mt-1">
                {generatedTitles.length > 0
                  ? `${selectedTitles.size}개 선택됨`
                  : '키워드를 선택하면 제목이 생성됩니다'
                }
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {generatedTitles.length > 0 ? (
                <div className="space-y-2">
                  {generatedTitles.map((item, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg transition-all ${
                        selectedTitles.has(item.title)
                          ? 'bg-emerald-900/30 border border-emerald-500/50'
                          : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedTitles.has(item.title)}
                          onChange={() => toggleTitleSelection(item.title)}
                          className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-slate-700 checked:bg-emerald-600 checked:border-emerald-600 cursor-pointer"
                        />
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => toggleTitleSelection(item.title)}
                        >
                          <p className="text-sm text-white font-medium leading-relaxed">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                              {item.keyword}
                            </span>
                            <span className="text-xs text-slate-500">
                              {TITLE_TEMPLATES.find(t => t.id === item.templateId)?.label}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://www.google.com/search?q=${encodeURIComponent(item.keyword)}`, '_blank');
                          }}
                          className="p-1.5 hover:bg-slate-600 rounded transition-colors flex-shrink-0"
                          title="구글에서 키워드 검색"
                        >
                          <Icon name="Search" size={14} className="text-slate-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <Icon name="FileText" size={40} className="mb-3 text-slate-700" />
                  <p className="text-sm text-center">
                    키워드를 분석하면<br />자동으로 제목이 추천됩니다
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            선택한 키워드와 제목을 대기열에 추가합니다
          </p>
          <button
            onClick={handleAddSelected}
            disabled={totalSelected === 0}
            className={`px-6 py-2.5 font-bold rounded-lg transition-colors flex items-center gap-2 ${
              totalSelected === 0
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            <Icon name="Plus" size={18} />
            대기열에 추가 ({totalSelected}개)
          </button>
        </div>
      </div>
    </div>
  );
};
