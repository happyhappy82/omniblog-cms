import React, { useState } from 'react';
import { LoginDialogProps } from '../types';
import { Icon } from './Icon';

export const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onLogin, isLoading, error }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    await onLogin(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1C2128] border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-8">
        {/* 로고/타이틀 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#0EA5E9]/10 rounded-2xl mb-3">
            <Icon name="Lock" size={32} className="text-[#0EA5E9]" />
          </div>
          <h1 className="text-2xl font-bold text-white">블로그 CMS</h1>
          <p className="text-slate-400 text-sm mt-2">비밀번호를 입력하세요</p>
        </div>

        {/* 비밀번호 입력 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">
              비밀번호
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full bg-[#0D1117] border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] outline-none transition-all placeholder:text-slate-600 pr-12"
                autoFocus
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                tabIndex={-1}
              >
                <Icon name={showPassword ? "EyeOff" : "Eye"} size={18} />
              </button>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-900/50 rounded-lg">
              <Icon name="AlertCircle" size={16} className="text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full mt-4 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Icon name="Loader2" className="animate-spin" size={18} />
                확인 중...
              </>
            ) : (
              <>
                <Icon name="LogIn" size={18} />
                로그인
              </>
            )}
          </button>
        </form>

        {/* 힌트 */}
        <p className="text-xs text-slate-500 text-center mt-6">
          .env 파일에 설정된 VITE_APP_PASSWORD를 입력하세요
        </p>
      </div>
    </div>
  );
};
