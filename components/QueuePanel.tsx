import React, { useState } from 'react';
import { Draft, DraftStatus, NicheType } from '../types';
import { Icon } from './Icon';
import { NICHES } from '../constants';

interface QueuePanelProps {
  nicheId: NicheType;
  drafts: Draft[];
  currentDraftId: string | null;
  onDraftSelect: (draftId: string) => void;
  onBulkGenerate: () => void;
  onBulkNotionUpload: () => void;
  onAddTopics: (topics: string[]) => void;
  onDeleteDraft: (draftId: string) => void;
  onBatchScheduleDates: (startDate: Date, intervalDays: number) => void;
  onOpenKeywordAnalysis: () => void;
}

const STATUS_CONFIG = {
  idle: { label: '대기중', icon: 'Clock', color: 'text-slate-500', bgColor: 'bg-slate-800/50' },
  generating: { label: '생성중', icon: 'Loader2', color: 'text-blue-400', bgColor: 'bg-blue-900/30' },
  generated: { label: '진행중', icon: 'CheckCircle', color: 'text-orange-400', bgColor: 'bg-orange-900/30' },
  published: { label: '완료됨', icon: 'Check', color: 'text-green-400', bgColor: 'bg-green-900/30' },
  error: { label: '에러', icon: 'AlertCircle', color: 'text-red-400', bgColor: 'bg-red-900/30' },
};

export const QueuePanel: React.FC<QueuePanelProps> = ({
  nicheId,
  drafts,
  currentDraftId,
  onDraftSelect,
  onBulkGenerate,
  onBulkNotionUpload,
  onAddTopics,
  onDeleteDraft,
  onBatchScheduleDates,
  onOpenKeywordAnalysis,
}) => {
  const [showAddTopics, setShowAddTopics] = useState(false);
  const [topicsText, setTopicsText] = useState('');
  const [statusFilter, setStatusFilter] = useState<DraftStatus | 'all'>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const [showScheduleDate, setShowScheduleDate] = useState(false);
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('09:00');
  const [scheduleInterval, setScheduleInterval] = useState('1');

  const niche = NICHES.find(n => n.id === nicheId);

  // 플랫폼 변경 시 필터 및 선택 초기화
  React.useEffect(() => {
    setStatusFilter('all');
    setSelectionMode(false);
    setSelectedDrafts(new Set());
  }, [nicheId]);

  const allNicheDrafts = drafts.filter(d => d.nicheId === nicheId).sort((a, b) => b.createdAt - a.createdAt);

  // 필터 적용
  const nicheDrafts = statusFilter === 'all'
    ? allNicheDrafts
    : allNicheDrafts.filter(d => d.status === statusFilter);

  const statusCounts = {
    idle: allNicheDrafts.filter(d => d.status === 'idle').length,
    generating: allNicheDrafts.filter(d => d.status === 'generating').length,
    generated: allNicheDrafts.filter(d => d.status === 'generated').length,
    published: allNicheDrafts.filter(d => d.status === 'published').length,
    error: allNicheDrafts.filter(d => d.status === 'error').length,
  };

  const handleAddTopics = () => {
    const topics = topicsText
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (topics.length > 0) {
      onAddTopics(topics);
      setTopicsText('');
      setShowAddTopics(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${month}/${day} ${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedDrafts(new Set());
  };

  const toggleDraftSelection = (draftId: string) => {
    const newSelected = new Set(selectedDrafts);
    if (newSelected.has(draftId)) {
      newSelected.delete(draftId);
    } else {
      newSelected.add(draftId);
    }
    setSelectedDrafts(newSelected);
  };

  const selectAll = () => {
    const allIds = new Set(nicheDrafts.map(d => d.id));
    setSelectedDrafts(allIds);
  };

  const deselectAll = () => {
    setSelectedDrafts(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedDrafts.size === 0) return;

    const confirmed = confirm(`${selectedDrafts.size}개의 항목을 삭제하시겠습니까?`);
    if (!confirmed) return;

    selectedDrafts.forEach(draftId => {
      onDeleteDraft(draftId);
    });

    setSelectedDrafts(new Set());
    setSelectionMode(false);
  };

  const handleApplySchedule = () => {
    if (!scheduleStartDate) {
      alert('시작 날짜를 선택해주세요.');
      return;
    }

    if (!scheduleStartTime) {
      alert('시작 시간을 입력해주세요.');
      return;
    }

    const intervalDays = parseInt(scheduleInterval);
    if (isNaN(intervalDays) || intervalDays < 0) {
      alert('올바른 간격을 입력해주세요.');
      return;
    }

    // 날짜와 시간을 합쳐서 Date 객체 생성
    const startDateTime = new Date(`${scheduleStartDate}T${scheduleStartTime}`);
    onBatchScheduleDates(startDateTime, intervalDays);
    setShowScheduleDate(false);
    alert(`날짜와 시간이 ${intervalDays}일 간격으로 설정되었습니다.`);
  };

  return (
    <div className="w-[380px] bg-[#0D1014] border-r border-slate-800/50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-800/50">
        <div className="flex items-center gap-2 mb-3">
          <Icon name={niche?.icon || 'FileText'} size={20} className={niche?.color} />
          <h2 className="text-base font-bold text-white">{niche?.label}</h2>
        </div>
        <p className="text-xs text-slate-500">{niche?.description}</p>
      </div>

      {/* Topic Input Section */}
      {showAddTopics ? (
        <div className="p-4 border-b border-slate-800/50 bg-[#111418]">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-300">주제 리스트 입력 (한 줄에 하나씩)</label>
            <button
              onClick={() => setShowAddTopics(false)}
              className="text-slate-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <textarea
            value={topicsText}
            onChange={(e) => setTopicsText(e.target.value)}
            placeholder="예시:&#10;챗봇 아이폰 사용 분석&#10;컴퓨터 시각 분석 툴&#10;2024년 생형 AI 총결산"
            className="w-full h-32 bg-[#1C2128] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] outline-none mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddTopics}
              className="flex-1 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-bold rounded-lg transition-colors"
            >
              리스트 대기열에 추가
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 border-b border-slate-800/50 space-y-2">
          <button
            onClick={onOpenKeywordAnalysis}
            className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 border border-purple-600/30"
          >
            <Icon name="Search" size={14} />
            키워드 분석
          </button>
          <button
            onClick={() => setShowAddTopics(true)}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="Plus" size={16} />
            리스트 대기열에 추가
          </button>
        </div>
      )}

      {/* Status Summary */}
      <div className="px-4 py-3 border-b border-slate-800/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-400">작업 대기열</span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectionMode}
              className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                selectionMode
                  ? 'bg-[#0EA5E9] text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {selectionMode ? '선택 취소' : '선택'}
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                statusFilter === 'all'
                  ? 'bg-[#0EA5E9] text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              전체 ({allNicheDrafts.length})
            </button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1 text-center">
          {(Object.entries(statusCounts) as [DraftStatus, number][]).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`text-xs p-2 rounded transition-all ${
                statusFilter === status
                  ? 'bg-slate-700 ring-2 ring-[#0EA5E9] ring-opacity-50'
                  : 'hover:bg-slate-800/50'
              }`}
            >
              <div className={`${STATUS_CONFIG[status].color} font-bold`}>{count}</div>
              <div className="text-[10px] text-slate-600">{STATUS_CONFIG[status].label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Buttons */}
      <div className="px-4 py-3 border-b border-slate-800/50 space-y-2">
        {selectionMode ? (
          <>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="flex-1 py-2 rounded-lg font-medium text-slate-300 text-xs bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                전체 선택
              </button>
              <button
                onClick={deselectAll}
                className="flex-1 py-2 rounded-lg font-medium text-slate-300 text-xs bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                선택 해제
              </button>
            </div>
            <button
              onClick={handleBulkDelete}
              disabled={selectedDrafts.size === 0}
              className={`w-full py-2.5 rounded-lg font-bold text-white text-sm flex items-center justify-center gap-2 transition-all ${
                selectedDrafts.size === 0
                  ? 'bg-slate-800 cursor-not-allowed opacity-50'
                  : 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20'
              }`}
            >
              <Icon name="Trash2" size={16} />
              선택 삭제 ({selectedDrafts.size}개)
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onBulkGenerate}
              disabled={statusCounts.idle === 0}
              className={`w-full py-2.5 rounded-lg font-bold text-white text-sm flex items-center justify-center gap-2 transition-all ${
                statusCounts.idle === 0
                  ? 'bg-slate-800 cursor-not-allowed opacity-50'
                  : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20'
              }`}
            >
              <Icon name="Play" size={16} />
              일괄 생성 시작 (대기 {statusCounts.idle}개)
            </button>
            <button
              onClick={onBulkNotionUpload}
              disabled={statusCounts.generated === 0}
              className={`w-full py-2.5 rounded-lg font-bold text-white text-sm flex items-center justify-center gap-2 transition-all ${
                statusCounts.generated === 0
                  ? 'bg-slate-800 cursor-not-allowed opacity-50'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20'
              }`}
            >
              <Icon name="Upload" size={16} />
              Notion 일괄 저장 (진행중 {statusCounts.generated}개)
            </button>
          </>
        )}
      </div>

      {/* Schedule Date Section */}
      {showScheduleDate ? (
        <div className="px-4 py-3 border-b border-slate-800/50 bg-[#111418]">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-slate-300">📅 포스팅 날짜 일괄 설정</label>
            <button
              onClick={() => setShowScheduleDate(false)}
              className="text-slate-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">시작 날짜</label>
              <input
                type="date"
                value={scheduleStartDate}
                onChange={(e) => setScheduleStartDate(e.target.value)}
                className="w-full bg-[#1C2128] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">시작 시간</label>
              <input
                type="time"
                value={scheduleStartTime}
                onChange={(e) => setScheduleStartTime(e.target.value)}
                className="w-full bg-[#1C2128] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">간격 (일)</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setScheduleInterval('1')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                    scheduleInterval === '1'
                      ? 'bg-[#0EA5E9] text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  1일
                </button>
                <button
                  onClick={() => setScheduleInterval('2')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                    scheduleInterval === '2'
                      ? 'bg-[#0EA5E9] text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  2일
                </button>
                <button
                  onClick={() => setScheduleInterval('3')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                    scheduleInterval === '3'
                      ? 'bg-[#0EA5E9] text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  3일
                </button>
              </div>
              <input
                type="number"
                min="0"
                value={scheduleInterval}
                onChange={(e) => setScheduleInterval(e.target.value)}
                placeholder="직접 입력 (일)"
                className="w-full mt-2 bg-[#1C2128] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] outline-none"
              />
            </div>
            <button
              onClick={handleApplySchedule}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="Calendar" size={16} />
              날짜 일괄 적용 ({allNicheDrafts.length}개)
            </button>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              생성 순서대로 {scheduleInterval}일 간격, {scheduleStartTime} 시간으로 날짜가 설정됩니다.
            </p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 border-b border-slate-800/50">
          <button
            onClick={() => setShowScheduleDate(true)}
            disabled={allNicheDrafts.length === 0}
            className={`w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
              allNicheDrafts.length === 0
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-600/50'
            }`}
          >
            <Icon name="Calendar" size={16} />
            포스팅 날짜 일괄 설정
          </button>
        </div>
      )}

      {/* Draft List */}
      <div className="flex-1 overflow-y-auto">
        {nicheDrafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 px-4">
            <Icon name="FileText" size={32} className="mb-2 text-slate-800" />
            {allNicheDrafts.length === 0 ? (
              <p className="text-sm text-center">작업 대기열이 비어있습니다.<br />주제를 추가해보세요.</p>
            ) : (
              <p className="text-sm text-center">
                {STATUS_CONFIG[statusFilter as DraftStatus]?.label} 상태의<br />항목이 없습니다.
              </p>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {nicheDrafts.map((draft) => {
              const statusConfig = STATUS_CONFIG[draft.status];
              const isActive = draft.id === currentDraftId;

              return (
                <div
                  key={draft.id}
                  className={`relative group w-full rounded-lg transition-all ${
                    isActive
                      ? 'bg-[#0EA5E9] text-white shadow-lg'
                      : 'bg-[#1C2128] hover:bg-[#161B22] text-slate-300'
                  }`}
                >
                  <div className="flex items-center">
                    {/* 선택 모드 체크박스 */}
                    {selectionMode && (
                      <div className="px-3">
                        <input
                          type="checkbox"
                          checked={selectedDrafts.has(draft.id)}
                          onChange={() => toggleDraftSelection(draft.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 checked:bg-[#0EA5E9] checked:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-0"
                        />
                      </div>
                    )}

                    <button
                      onClick={() => !selectionMode && onDraftSelect(draft.id)}
                      className="flex-1 text-left px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <Icon
                          name={statusConfig.icon}
                          size={14}
                          className={`mt-0.5 flex-shrink-0 ${
                            isActive ? 'text-white' : statusConfig.color
                          } ${draft.status === 'generating' ? 'animate-spin' : ''}`}
                        />
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="text-sm font-medium truncate">
                            {draft.title || '(제목 없음)'}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              isActive ? 'bg-white/20 text-white' : `${statusConfig.bgColor} ${statusConfig.color}`
                            }`}>
                              {statusConfig.label}
                            </span>
                            <span className={`text-[10px] ${isActive ? 'text-white/70' : 'text-slate-600'}`}>
                              {formatDate(draft.createdAt)}
                            </span>
                            {draft.scheduledDate && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                isActive ? 'bg-purple-400/20 text-white' : 'bg-purple-900/30 text-purple-400'
                              }`}>
                                <Icon name="Calendar" size={10} />
                                {new Date(draft.scheduledDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                {' '}
                                {new Date(draft.scheduledDate).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                              </span>
                            )}
                          </div>
                          {draft.error && (
                            <div className="text-[10px] text-red-400 mt-1 truncate">
                              {draft.error}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* 개별 삭제 버튼 (선택 모드가 아닐 때만 표시) */}
                    {!selectionMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`"${draft.title || '(제목 없음)'}" 항목을 삭제하시겠습니까?`)) {
                            onDeleteDraft(draft.id);
                          }
                        }}
                        className={`absolute top-1/2 right-2 -translate-y-1/2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                          isActive
                            ? 'hover:bg-white/20 text-white'
                            : 'hover:bg-red-900/50 text-red-400 hover:text-red-300'
                        }`}
                        title="삭제"
                      >
                        <Icon name="Trash2" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
