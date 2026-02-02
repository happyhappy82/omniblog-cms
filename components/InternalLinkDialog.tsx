import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from './Icon';
import { NicheType, NicheSettings, PublishedPost } from '../types';
import { CONFIG } from '../config';
import { NICHES } from '../constants';
import { titleToSlug, generateBlogUrl, formatAsInlineLink, formatAsRelatedPosts } from '../utils/slugUtils';

interface InternalLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (markdown: string, position: 'cursor' | 'bottom') => void;
  currentNicheId: NicheType;
  nicheSettings: { [key in NicheType]: NicheSettings };
}

type InsertPosition = 'cursor' | 'bottom';

export const InternalLinkDialog: React.FC<InternalLinkDialogProps> = ({
  isOpen,
  onClose,
  onInsert,
  currentNicheId,
  nicheSettings
}) => {
  // 상태
  const [selectedNicheId, setSelectedNicheId] = useState<NicheType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [insertPosition, setInsertPosition] = useState<InsertPosition>('cursor');
  const [blogBaseUrl, setBlogBaseUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 메모리 누수 방지를 위한 마운트 상태 추적
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 블로그 기본 URL localStorage에서 복원
  useEffect(() => {
    const saved = localStorage.getItem('omni_blogBaseUrl');
    if (saved) {
      setBlogBaseUrl(saved);
    }
  }, []);

  // 블로그 기본 URL 저장
  useEffect(() => {
    if (blogBaseUrl) {
      localStorage.setItem('omni_blogBaseUrl', blogBaseUrl);
    }
  }, [blogBaseUrl]);

  // 다이얼로그 열릴 때 현재 니치로 초기화
  useEffect(() => {
    if (isOpen) {
      setSelectedNicheId(currentNicheId);
      setSelectedPosts(new Set());
      setSearchQuery('');
      setError(null);
      // 현재 니치로 바로 글 목록 로드
      fetchPublishedPosts(currentNicheId);
    }
  }, [isOpen, currentNicheId]);

  // 니치 변경 시 글 목록 다시 로드
  const handleNicheChange = (nicheId: NicheType | 'ALL') => {
    setSelectedNicheId(nicheId);
    fetchPublishedPosts(nicheId);
  };

  // 발행된 글 목록 조회
  const fetchPublishedPosts = async (targetNicheId: NicheType | 'ALL') => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);
    setPosts([]);

    try {
      // 선택된 니치들 결정
      const nichesToFetch: NicheType[] = targetNicheId === 'ALL'
        ? Object.values(NicheType)
        : [targetNicheId];

      const allPosts: PublishedPost[] = [];

      for (const nicheId of nichesToFetch) {
        // 언마운트되었으면 중단
        if (!isMountedRef.current) return;

        const settings = nicheSettings[nicheId];
        if (!settings?.notionApiKey || !settings?.notionDatabaseId) {
          continue;
        }

        try {
          // API 엔드포인트 결정 (로컬 vs Vercel)
          const isLocal = window.location.hostname === 'localhost';
          const endpoint = isLocal
            ? 'http://localhost:4000/api/notion/published-posts'
            : '/api/notion-published-posts';

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: settings.notionApiKey,
              databaseId: settings.notionDatabaseId,
              limit: CONFIG.NOTION.FETCH_POSTS_LIMIT
            })
          });

          // 언마운트되었으면 중단
          if (!isMountedRef.current) return;

          const data = await response.json();

          if (data.success && data.posts) {
            const postsWithNiche = data.posts.map((post: any) => ({
              ...post,
              nicheId,
              slug: titleToSlug(post.title)
            }));
            allPosts.push(...postsWithNiche);
          }
        } catch (err) {
          console.error(`Error fetching posts for ${nicheId}:`, err);
        }
      }

      // 언마운트되었으면 상태 업데이트 하지 않음
      if (!isMountedRef.current) return;

      // 최신순 정렬
      allPosts.sort((a, b) =>
        new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
      );

      setPosts(allPosts);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setError(err.message || '글 목록을 불러오는 중 오류가 발생했습니다');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // 검색 필터링된 글 목록
  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;

    const query = searchQuery.toLowerCase();
    return posts.filter(post =>
      post.title.toLowerCase().includes(query) ||
      post.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }, [posts, searchQuery]);

  // 글 선택 토글
  const togglePostSelection = (pageId: string) => {
    setSelectedPosts(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedPosts.size === filteredPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredPosts.map(p => p.pageId)));
    }
  };

  // 삽입 처리
  const handleInsert = () => {
    if (selectedPosts.size === 0 || !blogBaseUrl.trim()) {
      return;
    }

    const selectedPostsList = filteredPosts
      .filter(p => selectedPosts.has(p.pageId))
      .map(p => ({
        title: p.title,
        url: generateBlogUrl(blogBaseUrl, p.slug)
      }));

    let markdown: string;

    if (insertPosition === 'cursor' && selectedPostsList.length === 1) {
      // 단일 선택 + 커서 위치: 인라인 링크
      markdown = formatAsInlineLink(selectedPostsList[0].title, selectedPostsList[0].url);
    } else {
      // 다중 선택 또는 하단 삽입: 관련 글 섹션
      markdown = formatAsRelatedPosts(selectedPostsList);
    }

    onInsert(markdown, insertPosition);
    onClose();
  };

  // 니치 라벨 가져오기
  const getNicheLabel = (nicheId: NicheType) => {
    return NICHES.find(n => n.id === nicheId)?.label || nicheId;
  };

  // 니치 아이콘 가져오기
  const getNicheIcon = (nicheId: NicheType) => {
    return NICHES.find(n => n.id === nicheId)?.icon || 'FileText';
  };

  // 날짜 포맷
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Icon name="Link2" size={20} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">내부 링크 삽입</h2>
              <p className="text-xs text-slate-400">기존 발행 글을 검색하여 링크로 삽입</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* 블로그 기본 URL 입력 */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-800/30">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            블로그 기본 URL
          </label>
          <input
            type="url"
            value={blogBaseUrl}
            onChange={(e) => setBlogBaseUrl(e.target.value)}
            placeholder="https://your-blog.com"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            예: https://your-blog.vercel.app → URL: https://your-blog.vercel.app/제목-슬러그
          </p>
        </div>

        {/* 필터 & 검색 */}
        <div className="px-6 py-3 border-b border-slate-800 flex gap-3">
          {/* 니치 필터 */}
          <select
            value={selectedNicheId}
            onChange={(e) => handleNicheChange(e.target.value as NicheType | 'ALL')}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">전체 플랫폼</option>
            {Object.values(NicheType).map(nicheId => (
              <option key={nicheId} value={nicheId}>
                {getNicheLabel(nicheId)}
              </option>
            ))}
          </select>

          {/* 검색 입력 */}
          <div className="flex-1 relative">
            <Icon
              name="Search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목 또는 태그로 검색..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* 글 목록 */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="Loader2" size={24} className="animate-spin text-cyan-400" />
              <span className="ml-2 text-slate-400">글 목록 불러오는 중...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Icon name="AlertCircle" size={32} className="text-red-400 mx-auto mb-2" />
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchPublishedPosts}
                className="mt-3 text-sm text-cyan-400 hover:underline"
              >
                다시 시도
              </button>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="FileText" size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400">
                {posts.length === 0
                  ? '발행된 글이 없습니다'
                  : '검색 결과가 없습니다'}
              </p>
            </div>
          ) : (
            <>
              {/* 전체 선택 헤더 */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedPosts.size === filteredPosts.length && filteredPosts.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-600 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-slate-400 group-hover:text-white transition-colors">
                    전체 선택 ({filteredPosts.length}개)
                  </span>
                </label>
                <span className="text-sm text-cyan-400 font-medium">
                  {selectedPosts.size}개 선택됨
                </span>
              </div>

              {/* 글 목록 */}
              <div className="space-y-2">
                {filteredPosts.map(post => (
                  <label
                    key={post.pageId}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedPosts.has(post.pageId)
                        ? 'bg-cyan-500/10 border-cyan-500/50'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPosts.has(post.pageId)}
                      onChange={() => togglePostSelection(post.pageId)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-600 text-cyan-600 focus:ring-cyan-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon
                          name={getNicheIcon(post.nicheId)}
                          size={14}
                          className="text-slate-500 flex-shrink-0"
                        />
                        <span className="text-xs text-slate-500">
                          {getNicheLabel(post.nicheId)}
                        </span>
                        <span className="text-xs text-slate-600">•</span>
                        <span className="text-xs text-slate-500">
                          {formatDate(post.createdTime)}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-white truncate">
                        {post.title}
                      </h4>
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {post.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {post.tags.length > 3 && (
                            <span className="text-xs text-slate-500">
                              +{post.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 삽입 옵션 & 버튼 */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/30">
          {/* 삽입 위치 선택 */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-slate-400">삽입 위치:</span>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="insertPosition"
                checked={insertPosition === 'cursor'}
                onChange={() => setInsertPosition('cursor')}
                className="w-4 h-4 border-slate-600 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                커서 위치
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="insertPosition"
                checked={insertPosition === 'bottom'}
                onChange={() => setInsertPosition('bottom')}
                className="w-4 h-4 border-slate-600 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                글 하단 (관련 글 섹션)
              </span>
            </label>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium"
            >
              취소
            </button>
            <button
              onClick={handleInsert}
              disabled={selectedPosts.size === 0 || !blogBaseUrl.trim()}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm font-medium disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Icon name="Link2" size={16} />
              {selectedPosts.size > 1
                ? `${selectedPosts.size}개 링크 삽입`
                : '링크 삽입'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
