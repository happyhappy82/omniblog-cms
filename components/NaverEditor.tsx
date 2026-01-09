import React, { useRef } from 'react';
import { Icon } from './Icon';

interface NaverEditorProps {
  content: string;
  onChange: (value: string) => void;
}

export const NaverEditor: React.FC<NaverEditorProps> = ({ content, onChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
         <ToolbarButton icon="ImageIcon" label="사진" onClick={() => insertFormat('[사진]')} />
         <ToolbarButton icon="Smile" label="스티커" onClick={() => insertFormat('[스티커]')} />
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-6 overflow-auto">
        <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder="내용을 입력하세요..."
            className="w-full h-full bg-transparent text-slate-200 outline-none resize-none font-sans text-sm leading-7 placeholder:text-slate-600"
            spellCheck={false}
          />
      </div>
    </div>
  );
};