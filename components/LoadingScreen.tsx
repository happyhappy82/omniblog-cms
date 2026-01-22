import React from 'react';
import { Icon } from './Icon';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="flex h-screen items-center justify-center bg-[#111418]">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-[#0EA5E9]/10 rounded-2xl mb-4">
          <Icon name="Loader2" className="animate-spin text-[#0EA5E9]" size={40} />
        </div>
        <p className="text-slate-400 mt-4 font-medium">로딩 중...</p>
        <p className="text-slate-600 text-sm mt-2">인증 확인 중입니다</p>
      </div>
    </div>
  );
};
