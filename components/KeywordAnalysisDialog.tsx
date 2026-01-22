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

export const KeywordAnalysisDialog: React.FC<KeywordAnalysisDialogProps> = ({
  isOpen,
  onClose,
  onAddKeywords,
}) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
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

  const selectAll = () => {
    const allKeywords = new Set(keywords.map(k => k.keyword));
    setSelectedKeywords(allKeywords);
  };

  const deselectAll = () => {
    setSelectedKeywords(new Set());
  };

  const handleAddSelected = () => {
    if (selectedKeywords.size === 0) {
      setError('추가할 키워드를 선택해주세요.');
      return;
    }
    onAddKeywords(Array.from(selectedKeywords));
    onClose();
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1C2128] rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/20 rounded-lg">
              <Icon name="Search" size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">키워드 분석</h2>
              <p className="text-xs text-slate-400">DataForSEO API를 통한 관련 키워드 분석</p>
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

        {/* Results Section */}
        <div className="flex-1 overflow-y-auto p-6">
          {keywords.length > 0 ? (
            <>
              {/* Selection Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-slate-400">
                  총 <span className="text-white font-bold">{keywords.length}</span>개의 관련 키워드
                  {selectedKeywords.size > 0 && (
                    <span className="ml-2">
                      (<span className="text-purple-400 font-bold">{selectedKeywords.size}</span>개 선택됨)
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                  >
                    전체 선택
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                  >
                    선택 해제
                  </button>
                </div>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-800/50 rounded-t-lg text-xs font-bold text-slate-400">
                <div className="col-span-1"></div>
                <div className="col-span-5">키워드</div>
                <div className="col-span-2 text-right">검색량</div>
                <div className="col-span-2 text-right">CPC ($)</div>
                <div className="col-span-2 text-center">경쟁도</div>
              </div>

              {/* Keyword List */}
              <div className="divide-y divide-slate-800/50">
                {keywords.map((kw, index) => (
                  <div
                    key={index}
                    onClick={() => toggleKeywordSelection(kw.keyword)}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 cursor-pointer transition-colors ${
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
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Icon name="Search" size={48} className="mb-4 text-slate-700" />
              <p className="text-sm">키워드를 입력하고 분석 버튼을 클릭하세요</p>
              <p className="text-xs mt-1 text-slate-600">관련 키워드, 검색량, 경쟁도를 확인할 수 있습니다</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {keywords.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              선택한 키워드를 대기열에 추가하여 블로그 글을 작성할 수 있습니다
            </p>
            <button
              onClick={handleAddSelected}
              disabled={selectedKeywords.size === 0}
              className={`px-6 py-2.5 font-bold rounded-lg transition-colors flex items-center gap-2 ${
                selectedKeywords.size === 0
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              <Icon name="Plus" size={18} />
              선택한 키워드 대기열에 추가 ({selectedKeywords.size}개)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
