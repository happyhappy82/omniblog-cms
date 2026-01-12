import React, { useRef, useState, useEffect } from 'react';
import { Icon } from './Icon';
import { useImageUpload } from '../hooks/useImageUpload';

interface NaverEditorProps {
  content: string;
  onChange: (value: string) => void;
  imgbbApiKey: string;
}

export const NaverEditor: React.FC<NaverEditorProps> = ({ content, onChange, imgbbApiKey }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkSelection, setLinkSelection] = useState({ start: 0, end: 0 });

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

    const newText = `${before}\n![](${imageUrl})\n${after}`;
    onChange(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
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

  // Helper to insert format (simple wrapping for demo purposes)
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    alert('본문이 복사되었습니다.');
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

  // Remove all asterisks from content
  const removeAsterisks = () => {
    if (!textareaRef.current) return;

    const scrollTop = textareaRef.current.scrollTop;
    const cursorPosition = textareaRef.current.selectionStart;

    // 모든 * 제거
    const newText = content.replace(/\*/g, '');
    onChange(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // 커서 위치 조정 (제거된 * 개수만큼)
        const removedCount = (content.substring(0, cursorPosition).match(/\*/g) || []).length;
        const newPosition = Math.max(0, cursorPosition - removedCount);
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        textareaRef.current.scrollTop = scrollTop;
      }
    }, 0);
  };

  const ToolbarButton = ({ icon, onClick, label }: { icon?: string, label?: string, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
    >
      {icon && <Icon name={icon} size={16} />}
      {label && <span className="text-xs font-medium">{label}</span>}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-[#1e2329] border-r border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700/50 bg-[#1e2329]">
        <div className="flex items-center gap-2">
           <div className="w-6 h-6 bg-[#03C75A] rounded flex items-center justify-center text-white font-bold text-xs shadow-sm">N</div>
           <h2 className="text-sm font-bold text-white tracking-tight">네이버 블로그 에디터</h2>
        </div>

        <div className="flex items-center gap-2">
           <button
             onClick={removeAsterisks}
             className="px-3 py-1.5 bg-slate-700 text-amber-400 text-xs font-medium rounded hover:bg-slate-600 transition-colors flex items-center gap-1.5 border border-amber-900/20"
             title="모든 * 문자 제거"
           >
             <span className="font-bold">*</span>
             제거
           </button>
           <button
             onClick={copyToClipboard}
             className="px-3 py-1.5 border border-slate-600 text-slate-300 text-xs font-medium rounded hover:bg-slate-700 transition-colors flex items-center gap-1.5"
           >
             <Icon name="Copy" size={12} />
             본문 복사
           </button>
           <button
             onClick={() => onChange('')}
             className="px-3 py-1.5 bg-[#3A2828] text-red-400 text-xs font-medium rounded hover:bg-red-900/30 transition-colors flex items-center gap-1.5 border border-red-900/20"
           >
             <Icon name="Trash2" size={12} />
             전체 삭제
           </button>
        </div>
      </div>

      {/* Naver Style Toolbar */}
      <div className="flex items-center px-4 py-2 border-b border-slate-700/50 bg-[#1e2329] gap-1 overflow-x-auto">
         <ToolbarButton label="B" onClick={() => insertFormat('**', '**')} />
         <ToolbarButton label="I" onClick={() => insertFormat('*', '*')} />
         <ToolbarButton label="U" onClick={() => insertFormat('__', '__')} />
         <div className="w-px h-3 bg-slate-600 mx-2"></div>
         <ToolbarButton icon="AlignLeft" onClick={() => {}} />
         <ToolbarButton icon="List" onClick={() => insertFormat('- ')} />
         <div className="w-px h-3 bg-slate-600 mx-2"></div>
         <ToolbarButton icon="Link" label="링크" onClick={openLinkDialog} />
         <ToolbarButton icon="ImageIcon" label="사진" onClick={() => fileInputRef.current?.click()} />
         <ToolbarButton icon="Smile" label="스티커" onClick={() => insertFormat('[스티커]')} />

         {/* Hidden file input */}
         <input
           ref={fileInputRef}
           type="file"
           accept="image/*"
           onChange={handleFileSelect}
           className="hidden"
         />
      </div>

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
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-green-500"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-green-500"
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
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm font-medium disabled:bg-slate-600 disabled:cursor-not-allowed"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Area */}
      <div
        className="flex-1 p-6 overflow-auto relative"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => { setIsDragging(false); handleDrop(e); }}
      >
        {/* Upload overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-green-500/10 border-2 border-dashed border-green-500 rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <Icon name="ImageIcon" size={48} className="text-green-500 mx-auto mb-2" />
              <p className="text-green-500 font-bold">이미지를 여기에 드롭하세요</p>
            </div>
          </div>
        )}

        {/* Upload progress */}
        {uploadState.isUploading && (
          <div className="absolute top-4 right-4 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg z-20">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Loader2" size={16} className="animate-spin text-green-500" />
              <span className="text-sm text-white font-medium">업로드 중...</span>
            </div>
            <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
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

        <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder="내용을 입력하세요...

📎 이미지 업로드: 파일 선택 버튼 클릭 | 드래그 & 드롭 | Ctrl+V 붙여넣기"
            className="w-full h-full bg-transparent text-slate-200 outline-none resize-none font-sans text-sm leading-7 placeholder:text-slate-600"
            spellCheck={false}
          />
      </div>
    </div>
  );
};