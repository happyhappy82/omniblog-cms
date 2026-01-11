import React, { useRef, useState, useEffect } from 'react';
import { Icon } from './Icon';
import { useImageUpload } from '../hooks/useImageUpload';

interface NotionEditorProps {
  content: string;
  onChange: (value: string) => void;
  onGenerateNotion: () => void;
  readOnly?: boolean;
  isUploading?: boolean;
  uploadSuccess?: boolean;
  imgbbApiKey: string;
}

export const NotionEditor: React.FC<NotionEditorProps> = ({ content, onChange, onGenerateNotion, readOnly = false, isUploading = false, uploadSuccess = false, imgbbApiKey }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const floatingMenuRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkSelection, setLinkSelection] = useState({ start: 0, end: 0 });
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [floatingMenuPosition, setFloatingMenuPosition] = useState({ top: 0, left: 0 });

  // Image upload hook
  const { uploadState, handleFileSelect, handleDrop, handlePaste, clearError } = useImageUpload({
    apiKey: imgbbApiKey,
    onImageUploaded: (imageUrl) => {
      insertImage(imageUrl);
    }
  });

  // Insert image URL at cursor position
  const insertImage = (imageUrl: string) => {
    if (!textareaRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = textareaRef.current.value;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText = `${before}![](${imageUrl})${after}`;
    onChange(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPosition = start + imageUrl.length + 5;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  // Handle clipboard paste
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pasteHandler = (e: ClipboardEvent) => {
      handlePaste(e);
    };

    textarea.addEventListener('paste', pasteHandler);
    return () => textarea.removeEventListener('paste', pasteHandler);
  }, [handlePaste]);

  // Hide floating menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showFloatingMenu) {
        const target = e.target as Node;
        const isTextarea = textareaRef.current?.contains(target);
        const isFloatingMenu = floatingMenuRef.current?.contains(target);

        if (!isTextarea && !isFloatingMenu) {
          setShowFloatingMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFloatingMenu]);

  // Helper to insert markdown syntax at cursor
  const insertFormat = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = textareaRef.current.value;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const newText = `${before}${prefix}${selection}${suffix}${after}`;
    onChange(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + prefix.length, end + prefix.length);
      }
    }, 0);
  };

  // Handle text selection for floating menu
  const handleTextSelection = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!textareaRef.current || showPreview) return;

    // setTimeout으로 선택이 완료된 후 확인
    setTimeout(() => {
      if (!textareaRef.current) return;

      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;

      // 텍스트가 선택되었는지 확인
      if (end - start > 0) {
        // 화면 경계 확인
        const menuWidth = 100; // 메뉴 예상 너비
        const menuHeight = 50; // 메뉴 예상 높이

        let top = e.clientY - 60; // 선택 영역 위쪽에 표시
        let left = e.clientX - 30; // 마우스 중앙 근처

        // 화면 오른쪽 경계 체크
        if (left + menuWidth > window.innerWidth) {
          left = window.innerWidth - menuWidth - 10;
        }

        // 화면 왼쪽 경계 체크
        if (left < 10) {
          left = 10;
        }

        // 화면 위쪽 경계 체크
        if (top < 10) {
          top = e.clientY + 20; // 선택 영역 아래쪽에 표시
        }

        setFloatingMenuPosition({ top, left });
        setShowFloatingMenu(true);
      } else {
        setShowFloatingMenu(false);
      }
    }, 10);
  };

  // Open link dialog
  const openLinkDialog = () => {
    if (!textareaRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = textareaRef.current.value;
    const selection = text.substring(start, end);

    setLinkSelection({ start, end });
    setLinkText(selection);
    setLinkUrl('');
    setShowLinkDialog(true);
    setShowFloatingMenu(false); // floating menu 숨김
  };

  // Insert link
  const insertLink = () => {
    if (!textareaRef.current || !linkUrl) return;

    // 현재 스크롤 위치 저장
    const scrollTop = textareaRef.current.scrollTop;

    const text = textareaRef.current.value;
    const before = text.substring(0, linkSelection.start);
    const after = text.substring(linkSelection.end);

    const displayText = linkText || linkUrl;
    const newText = `${before}[${displayText}](${linkUrl})${after}`;
    onChange(newText);

    setShowLinkDialog(false);
    setLinkText('');
    setLinkUrl('');

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPosition = linkSelection.start + displayText.length + linkUrl.length + 4;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        // 스크롤 위치 복원
        textareaRef.current.scrollTop = scrollTop;
      }
    }, 0);
  };

  const ToolbarButton = ({ icon, onClick, tooltip, label }: { icon?: string, label?: string, onClick: () => void, tooltip: string }) => (
    <button 
      onClick={onClick}
      className={`p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors relative group flex items-center gap-1 ${label ? 'px-2' : ''}`}
      title={tooltip}
    >
      {icon && <Icon name={icon} size={18} />}
      {label && <span className="text-xs font-semibold">{label}</span>}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-[#15191E] relative">
      {/* Main Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#15191E]">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-slate-900 font-bold font-serif text-lg shadow-sm">N</div>
           <h2 className="text-lg font-bold text-white tracking-tight">Notion 에디터</h2>
        </div>

        <div className="flex items-center gap-3">
           <button 
             onClick={() => onChange('')}
             className="px-4 py-2 bg-[#3A2828] text-red-400 text-xs font-medium rounded hover:bg-red-900/30 hover:text-red-300 transition-colors flex items-center gap-2 border border-red-900/20"
           >
             <Icon name="Trash2" size={14} />
             전체 삭제
           </button>
           <button
             onClick={onGenerateNotion}
             disabled={isUploading}
             className={`px-4 py-2 text-xs font-bold rounded transition-all flex items-center gap-2 shadow-lg ${
               uploadSuccess
                 ? 'bg-emerald-500 text-white'
                 : isUploading
                 ? 'bg-slate-600 text-slate-300 cursor-not-allowed'
                 : 'bg-white text-slate-900 hover:bg-slate-200 shadow-white/5'
             }`}
           >
             {uploadSuccess ? (
               <>
                 <Icon name="CheckCircle" size={14} />
                 생성 완료
               </>
             ) : isUploading ? (
               <>
                 <Icon name="Loader2" size={14} className="animate-spin" />
                 생성중...
               </>
             ) : (
               <>
                 <Icon name="RotateCcw" size={14} />
                 Notion 페이지 생성
               </>
             )}
           </button>
        </div>
      </div>

      {/* Toolbar & Mode Switch */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-slate-800 bg-[#15191E]">
        <div className="flex items-center gap-1">
          <button 
             onClick={() => setShowPreview(false)}
             className={`text-xs font-bold px-2 py-1 ${!showPreview ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            MARKDOWN
          </button>
          <div className="w-px h-3 bg-slate-700 mx-2"></div>
          
          <ToolbarButton label="B" onClick={() => insertFormat('**', '**')} tooltip="굵게" />
          <ToolbarButton label="H1" onClick={() => insertFormat('# ')} tooltip="제목 1" />
          <ToolbarButton label="H2" onClick={() => insertFormat('## ')} tooltip="제목 2" />
          
          <div className="w-px h-3 bg-slate-700 mx-2"></div>
          
          <ToolbarButton icon="List" onClick={() => insertFormat('- ')} tooltip="글머리 기호 목록" />
          <ToolbarButton icon="ListOrdered" onClick={() => insertFormat('1. ')} tooltip="번호 목록" />
          <ToolbarButton icon="CheckSquare" onClick={() => insertFormat('- [ ] ')} tooltip="체크리스트" />
          
          <div className="w-px h-3 bg-slate-700 mx-2"></div>
          
          <ToolbarButton icon="Table" onClick={() => {}} tooltip="표 (미지원)" />
          <ToolbarButton icon="Code" onClick={() => insertFormat('```\n', '\n```')} tooltip="코드 블록" />
          <ToolbarButton icon="Link" onClick={openLinkDialog} tooltip="링크" />
          
          <div className="w-px h-3 bg-slate-700 mx-2"></div>

          <ToolbarButton icon="ImageIcon" label="이미지" onClick={() => fileInputRef.current?.click()} tooltip="이미지 업로드 (Ctrl+V로 붙여넣기 가능)" />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <div>
           <button 
             onClick={() => setShowPreview(!showPreview)}
             className="text-slate-500 hover:text-white transition-colors"
             title={showPreview ? "편집 모드로 전환" : "미리보기 모드로 전환"}
           >
             <Icon name={showPreview ? "PenLine" : "Eye"} size={18} />
           </button>
        </div>
      </div>

      {/* Floating Menu */}
      {showFloatingMenu && !showPreview && (
        <div
          ref={floatingMenuRef}
          className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-xl flex items-center gap-1 p-1 z-40"
          style={{
            top: `${floatingMenuPosition.top}px`,
            left: `${floatingMenuPosition.left}px`,
          }}
        >
          <button
            onClick={openLinkDialog}
            className="p-2 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1"
            title="링크 추가"
          >
            <Icon name="Link" size={16} />
          </button>
          <button
            onClick={() => {
              insertFormat('**', '**');
              setShowFloatingMenu(false);
            }}
            className="p-2 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors font-bold text-sm"
            title="굵게"
          >
            B
          </button>
        </div>
      )}

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-96 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Icon name="Link" size={18} />
                링크 추가
              </h3>
              <button onClick={() => setShowLinkDialog(false)} className="text-slate-400 hover:text-white">
                <Icon name="X" size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">URL</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && linkUrl) {
                      insertLink();
                    }
                  }}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">표시 텍스트</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="링크로 표시할 텍스트"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowLinkDialog(false)}
                className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors text-sm font-medium"
              >
                취소
              </button>
              <button
                onClick={insertLink}
                disabled={!linkUrl}
                className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors text-sm font-medium disabled:bg-slate-600 disabled:cursor-not-allowed"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div
        className="flex-1 overflow-auto bg-[#15191E] p-8 relative"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => { setIsDragging(false); handleDrop(e); }}
      >
        {/* Upload overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-[#0EA5E9]/10 border-2 border-dashed border-[#0EA5E9] rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <Icon name="ImageIcon" size={48} className="text-[#0EA5E9] mx-auto mb-2" />
              <p className="text-[#0EA5E9] font-bold">이미지를 여기에 드롭하세요</p>
            </div>
          </div>
        )}

        {/* Upload progress */}
        {uploadState.isUploading && (
          <div className="absolute top-4 right-4 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg z-20">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Loader2" size={16} className="animate-spin text-[#0EA5E9]" />
              <span className="text-sm text-white font-medium">업로드 중...</span>
            </div>
            <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0EA5E9] transition-all duration-300"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {uploadState.error && (
          <div className="absolute top-4 right-4 bg-red-900/20 border border-red-700 rounded-lg p-3 shadow-lg z-20 max-w-sm">
            <div className="flex items-start gap-2">
              <Icon name="AlertCircle" size={16} className="text-red-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-300">{uploadState.error}</p>
              </div>
              <button onClick={clearError} className="text-red-400 hover:text-red-300">
                <Icon name="X" size={14} />
              </button>
            </div>
          </div>
        )}

        {showPreview ? (
          <div className="prose prose-invert prose-slate max-w-none notion-editor-content">
            {content ? (
               content.split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-bold mt-6 mb-4">{line.replace('# ', '')}</h1>;
                if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold mt-5 mb-3">{line.replace('## ', '')}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-bold mt-4 mb-2">{line.replace('### ', '')}</h3>;
                if (line.startsWith('- ')) return <div key={i} className="flex gap-2 mb-1"><span className="text-slate-400">•</span><span>{line.replace('- ', '')}</span></div>;
                if (line.startsWith('1. ')) return <div key={i} className="flex gap-2 mb-1"><span className="text-slate-400">1.</span><span>{line.replace(/^\d+\.\s/, '')}</span></div>;

                // Enhanced image rendering
                if (line.startsWith('![')) {
                  const match = line.match(/!\[(.*?)\]\((.*?)\)/);
                  if (match) {
                    const [, alt, url] = match;
                    return (
                      <div key={i} className="my-4">
                        <img
                          src={url}
                          alt={alt || '이미지'}
                          className="max-w-full rounded-lg border border-slate-700 shadow-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                        <div className="hidden p-6 bg-slate-800/50 rounded-lg border border-slate-700 text-center text-sm text-slate-400">
                          <Icon name="ImageIcon" />
                          <p>이미지 로드 실패: {url}</p>
                        </div>
                      </div>
                    );
                  }
                  return <div key={i} className="my-4 p-6 bg-slate-800/50 rounded-lg border border-slate-700 text-center text-sm text-slate-400 flex flex-col items-center gap-2"><Icon name="ImageIcon" />이미지 영역</div>;
                }

                if (line.startsWith('[사진:')) return <div key={i} className="my-4 p-6 bg-slate-800/50 rounded-lg border border-slate-700 text-center text-sm text-slate-400 flex flex-col items-center gap-2"><Icon name="ImageIcon" />{line.replace(/\[사진:|\]|\(|\)/g, '')}</div>;
                if (line.trim() === '') return <br key={i}/>;

                // Enhanced link rendering in preview
                const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                if (linkRegex.test(line)) {
                  const parts: React.ReactNode[] = [];
                  let lastIndex = 0;
                  const matches = line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);

                  for (const match of matches) {
                    const [fullMatch, text, url] = match;
                    const matchIndex = match.index || 0;

                    if (matchIndex > lastIndex) {
                      parts.push(line.substring(lastIndex, matchIndex));
                    }

                    parts.push(
                      <a
                        key={matchIndex}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 underline"
                      >
                        {text}
                      </a>
                    );

                    lastIndex = matchIndex + fullMatch.length;
                  }

                  if (lastIndex < line.length) {
                    parts.push(line.substring(lastIndex));
                  }

                  return <p key={i} className="text-slate-300 leading-relaxed mb-4">{parts}</p>;
                }

                return <p key={i} className="text-slate-300 leading-relaxed mb-4">{line}</p>;
              })
            ) : (
              <div className="text-slate-600 italic">미리보기 할 내용이 없습니다.</div>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onMouseUp={handleTextSelection}
            readOnly={readOnly}
            placeholder="여기에 내용을 작성하거나 AI로 초안을 생성하세요...

📎 이미지 업로드: 파일 선택 버튼 클릭 | 드래그 & 드롭 | Ctrl+V 붙여넣기"
            className="w-full h-full bg-transparent text-slate-200 outline-none resize-none font-sans text-base leading-relaxed placeholder:text-slate-700"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
};