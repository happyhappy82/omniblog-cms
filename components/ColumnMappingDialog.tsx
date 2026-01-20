import React, { useState } from 'react';
import { Icon } from './Icon';
import { RequiredFieldMapping } from '../types';
import { getFieldLabel, addColumnMapping } from '../utils/columnMapping';

interface ColumnMappingDialogProps {
  headers: string[];
  currentMapping: RequiredFieldMapping;
  missingFields: Array<'sido' | 'sigungu' | 'dong'>;
  onComplete: (mapping: RequiredFieldMapping) => void;
  onCancel: () => void;
}

export const ColumnMappingDialog: React.FC<ColumnMappingDialogProps> = ({
  headers,
  currentMapping,
  missingFields,
  onComplete,
  onCancel
}) => {
  const [mapping, setMapping] = useState<RequiredFieldMapping>(currentMapping);

  const handleSubmit = () => {
    // 매핑 저장
    if (mapping.sido) addColumnMapping(mapping.sido, 'sido');
    if (mapping.sigungu) addColumnMapping(mapping.sigungu, 'sigungu');
    if (mapping.dong) addColumnMapping(mapping.dong, 'dong');

    onComplete(mapping);
  };

  const isValid = mapping.sido && mapping.sigungu && mapping.dong;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161B22] border border-slate-700 rounded-lg max-w-lg w-full p-6">
        <div className="flex items-start gap-3 mb-6">
          <Icon name="Settings" className="text-green-500 mt-0.5" size={24} />
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">컬럼 매핑 설정</h3>
            <p className="text-sm text-slate-400 mt-1">
              엑셀 파일의 컬럼을 필수 필드에 연결해주세요
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {/* 시/도 */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">
              시/도 {missingFields.includes('sido') && <span className="text-red-400">*</span>}
            </label>
            <select
              value={mapping.sido || ''}
              onChange={(e) => setMapping({ ...mapping, sido: e.target.value || null })}
              className={`w-full bg-[#0D1117] border rounded-md px-3 py-2 text-sm text-white focus:border-green-500 outline-none ${
                missingFields.includes('sido') ? 'border-red-500' : 'border-slate-800'
              }`}
            >
              <option value="">컬럼을 선택하세요</option>
              {headers.map(header => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </div>

          {/* 시/군/구 */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">
              시/군/구 {missingFields.includes('sigungu') && <span className="text-red-400">*</span>}
            </label>
            <select
              value={mapping.sigungu || ''}
              onChange={(e) => setMapping({ ...mapping, sigungu: e.target.value || null })}
              className={`w-full bg-[#0D1117] border rounded-md px-3 py-2 text-sm text-white focus:border-green-500 outline-none ${
                missingFields.includes('sigungu') ? 'border-red-500' : 'border-slate-800'
              }`}
            >
              <option value="">컬럼을 선택하세요</option>
              {headers.map(header => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </div>

          {/* 읍/면/동 */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">
              읍/면/동 {missingFields.includes('dong') && <span className="text-red-400">*</span>}
            </label>
            <select
              value={mapping.dong || ''}
              onChange={(e) => setMapping({ ...mapping, dong: e.target.value || null })}
              className={`w-full bg-[#0D1117] border rounded-md px-3 py-2 text-sm text-white focus:border-green-500 outline-none ${
                missingFields.includes('dong') ? 'border-red-500' : 'border-slate-800'
              }`}
            >
              <option value="">컬럼을 선택하세요</option>
              {headers.map(header => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <Icon name="Info" size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-300 leading-relaxed">
              이 매핑은 자동으로 저장되어 다음에 같은 컬럼명이 있는 파일을 업로드할 때 자동으로 인식됩니다.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
          >
            매핑 저장 및 계속
          </button>
        </div>
      </div>
    </div>
  );
};
