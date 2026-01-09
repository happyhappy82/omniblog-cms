import React, { useRef, useState } from 'react';
import { Icon } from './Icon';

interface NotionEditorProps {
  content: string;
  onChange: (value: string) => void;
  onGenerateNotion: () => void;
  readOnly?: boolean;
  isUploading?: boolean;
  uploadSuccess?: boolean;
}

export const NotionEditor: React.FC<NotionEditorProps> = ({ content, onChange, onGenerateNotion, readOnly = false, isUploading = false, uploadSuccess = false }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

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
          <ToolbarButton icon="Link" onClick={() => insertFormat('[', '](url)')} tooltip="링크" />
          
          <div className="w-px h-3 bg-slate-700 mx-2"></div>
          
          <ToolbarButton icon="ImageIcon" label="이미지" onClick={() => insertFormat('![Alt Text](', ')')} tooltip="이미지 삽입" />
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

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-[#15191E] p-8">
        {showPreview ? (
          <div className="prose prose-invert prose-slate max-w-none notion-editor-content">
            {content ? (
               content.split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-bold mt-6 mb-4">{line.replace('# ', '')}</h1>;
                if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold mt-5 mb-3">{line.replace('## ', '')}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-bold mt-4 mb-2">{line.replace('### ', '')}</h3>;
                if (line.startsWith('- ')) return <div key={i} className="flex gap-2 mb-1"><span className="text-slate-400">•</span><span>{line.replace('- ', '')}</span></div>;
                if (line.startsWith('1. ')) return <div key={i} className="flex gap-2 mb-1"><span className="text-slate-400">1.</span><span>{line.replace(/^\d+\.\s/, '')}</span></div>;
                if (line.startsWith('![') || line.startsWith('[사진:')) return <div key={i} className="my-4 p-6 bg-slate-800/50 rounded-lg border border-slate-700 text-center text-sm text-slate-400 flex flex-col items-center gap-2"><Icon name="ImageIcon" />{line.replace(/!\[.*?\]|\[사진:|\]|\(|\)/g, '') || '이미지 영역'}</div>;
                if (line.trim() === '') return <br key={i}/>;
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
            readOnly={readOnly}
            placeholder="여기에 내용을 작성하거나 AI로 초안을 생성하세요..."
            className="w-full h-full bg-transparent text-slate-200 outline-none resize-none font-sans text-base leading-relaxed placeholder:text-slate-700"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
};