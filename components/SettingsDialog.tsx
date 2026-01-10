import React from 'react';
import { AppSettings, NicheType } from '../types';
import { Icon } from './Icon';
import { NICHES } from '../constants';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = React.useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = React.useState<NicheType>(NicheType.AI);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1C2128] border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#161B22]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Icon name="Settings" size={18} /> 환경 설정
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Gemini API Key (공통) */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-1.5">Gemini API Key (공통)</label>
            <input
              type="password"
              value={localSettings.geminiApiKey}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, geminiApiKey: e.target.value }))}
              placeholder="AIzaSy..."
              className="w-full bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] outline-none transition-all"
            />
            <p className="text-xs text-slate-500 mt-1.5">AI 초안 생성을 위해 필요합니다.</p>
          </div>

          {/* imgBB API Key (공통) */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-1.5">imgBB API Key (공통)</label>
            <input
              type="password"
              value={localSettings.imgbbApiKey || ''}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, imgbbApiKey: e.target.value }))}
              placeholder="imgBB API Key 입력..."
              className="w-full bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] outline-none transition-all"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              모든 에디터에서 이미지 업로드에 사용됩니다.
              <a
                href="https://api.imgbb.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0EA5E9] hover:underline ml-1"
              >
                API Key 발급받기
              </a>
            </p>
          </div>

          <div className="h-px bg-slate-800/50 w-full"></div>

          {/* 블로그 플랫폼별 Notion 설정 */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 mb-3">블로그 플랫폼별 Notion 데이터베이스 설정</h3>

            {/* 탭 버튼 */}
            <div className="flex gap-2 mb-4 overflow-x-auto">
              {NICHES.map(niche => (
                <button
                  key={niche.id}
                  onClick={() => setActiveTab(niche.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    activeTab === niche.id
                      ? 'bg-[#0EA5E9] text-white'
                      : 'bg-[#0D1117] text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon name={niche.icon} size={14} />
                  {niche.label}
                </button>
              ))}
            </div>

            {/* 선택된 탭의 설정 */}
            <div className="space-y-4 bg-[#0D1117] p-4 rounded-lg border border-slate-800">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Notion API Key</label>
                <input
                  type="password"
                  value={localSettings.nicheSettings[activeTab]?.notionApiKey || ''}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    nicheSettings: {
                      ...prev.nicheSettings,
                      [activeTab]: {
                        ...prev.nicheSettings[activeTab],
                        notionApiKey: e.target.value
                      }
                    }
                  }))}
                  placeholder="secret_..."
                  className="w-full bg-[#161B22] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Notion Database ID</label>
                <input
                  type="text"
                  value={localSettings.nicheSettings[activeTab]?.notionDatabaseId || ''}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    nicheSettings: {
                      ...prev.nicheSettings,
                      [activeTab]: {
                        ...prev.nicheSettings[activeTab],
                        notionDatabaseId: e.target.value
                      }
                    }
                  }))}
                  placeholder="데이터베이스 ID 입력"
                  className="w-full bg-[#161B22] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] outline-none transition-all"
                />
              </div>

              <p className="text-xs text-slate-500">
                {NICHES.find(n => n.id === activeTab)?.label} 블로그의 초안이 이 데이터베이스에 저장됩니다.
                {activeTab === NicheType.AI && ' (네이버 블로그는 수동 작업용으로 노션에 저장되지 않습니다)'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-[#161B22] border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => { onSave(localSettings); onClose(); }}
            className="px-4 py-2 text-sm font-bold text-white bg-[#0EA5E9] hover:bg-[#0284C7] rounded-lg shadow-lg shadow-blue-900/20 transition-all"
          >
            설정 저장
          </button>
        </div>
      </div>
    </div>
  );
};