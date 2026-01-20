import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { RegionalDataStore, RegionalData, RequiredFieldMapping } from '../types';
import {
  parseRegionalDataFile,
  readFileHeaders,
  getRegionalHierarchy,
  findRegionalData,
  formatRegionalDataAsText,
  groupRegionsByLocation,
  formatGroupedRegionalData,
  formatApartmentDataAsText,
  formatGroupedApartmentData
} from '../utils/fileParser';
import { autoMatchColumns, getMissingMappings } from '../utils/columnMapping';
import { ColumnMappingDialog } from './ColumnMappingDialog';

interface RegionalDataManagerProps {
  onAddToContext: (text: string) => void;
  onBulkGenerate: (regions: RegionalData[], columns: string[]) => void;
  dataType?: 'commercial' | 'apartment'; // 데이터 유형 (상가업소 vs 아파트)
}

export const RegionalDataManager: React.FC<RegionalDataManagerProps> = ({
  onAddToContext,
  onBulkGenerate,
  dataType = 'commercial' // 기본값: 상가업소
}) => {
  const [dataStore, setDataStore] = useState<RegionalDataStore | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');

  // 컬럼 매핑 상태
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingHeaders, setPendingHeaders] = useState<string[]>([]);
  const [pendingMapping, setPendingMapping] = useState<RequiredFieldMapping | null>(null);
  const [showMappingDialog, setShowMappingDialog] = useState(false);

  // 지역 선택 상태
  const [selectedSido, setSelectedSido] = useState<string>('');
  const [selectedSigungu, setSelectedSigungu] = useState<string>('');
  const [selectedDong, setSelectedDong] = useState<string>('');

  // 일괄 선택 상태
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());

  // localStorage에서 메타데이터만 복원 (용량 문제로 전체 데이터는 저장하지 않음)
  useEffect(() => {
    const saved = localStorage.getItem('regional_data_metadata');
    if (saved) {
      try {
        const metadata = JSON.parse(saved);
        console.log('이전 업로드 정보:', metadata);
        // 메타데이터만 표시용으로 사용 (파일은 다시 업로드 필요)
      } catch (error) {
        console.error('Failed to load metadata:', error);
      }
    }
  }, []);

  // dataStore 변경 시 메타데이터만 저장 (용량 절약)
  useEffect(() => {
    if (dataStore) {
      const metadata = {
        fileName: dataStore.fileName,
        uploadDate: dataStore.uploadDate,
        regionCount: dataStore.regions.length,
        columnCount: dataStore.columns.length
      };
      localStorage.setItem('regional_data_metadata', JSON.stringify(metadata));
      console.log('메타데이터 저장 완료 (전체 데이터는 메모리에만 유지)');
    }
  }, [dataStore]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    setUploadMessage('파일 업로드 준비 중...');

    try {
      console.log('파일 업로드 시작:', file.name, file.size, 'bytes');

      // 1단계: 헤더 읽기
      const headers = await readFileHeaders(file);
      console.log('헤더 읽기 완료:', headers);

      // 2단계: 자동 매칭 시도
      const autoMapping = autoMatchColumns(headers);
      console.log('자동 매칭 시도:', autoMapping);

      // 3단계: 누락된 필드 확인
      const missing = getMissingMappings(autoMapping);

      if (missing.length > 0) {
        // 매핑 필요 → 다이얼로그 표시
        console.log('매핑 필요:', missing);
        setPendingFile(file);
        setPendingHeaders(headers);
        setPendingMapping(autoMapping);
        setShowMappingDialog(true);
        setIsUploading(false);
        return;
      }

      // 4단계: 자동 매칭 성공 → 바로 파싱
      console.log('자동 매칭 성공! 파싱 시작...');
      const parsed = await parseRegionalDataFile(
        file,
        autoMapping,
        100000, // 최대 100,000행
        (progress, message) => {
          setUploadProgress(progress);
          setUploadMessage(message);
        }
      );
      console.log('파싱 완료:', parsed.regions.length, '개 데이터');

      setDataStore(parsed);
      setSelectedSido('');
      setSelectedSigungu('');
      setSelectedDong('');
      setSelectedRegions(new Set());
      setUploadProgress(100);
      setUploadMessage('완료!');
      console.log('상태 업데이트 완료');

      // 대용량 파일 경고
      if (parsed.regions.length >= 100000) {
        alert(`⚠️ 파일이 너무 큽니다.\n\n처음 100,000개 행만 로드되었습니다.\n브라우저 성능을 위해 일부 데이터가 제한되었습니다.`);
      }

      // 진행률 표시 잠시 유지 후 초기화
      setTimeout(() => {
        setUploadProgress(0);
        setUploadMessage('');
      }, 1500);
    } catch (error: any) {
      console.error('파일 업로드 에러:', error);
      const errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
      setUploadError(errorMessage);
      setUploadProgress(0);
      setUploadMessage('');
      alert(`파일 업로드 실패:\n\n${errorMessage}\n\n브라우저 콘솔(F12)에서 자세한 내용을 확인하세요.`);
    } finally {
      setIsUploading(false);
    }

    // input 초기화
    event.target.value = '';
  };

  const handleMappingComplete = async (mapping: RequiredFieldMapping) => {
    if (!pendingFile) return;

    setShowMappingDialog(false);
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    setUploadMessage('파싱 시작...');

    try {
      console.log('사용자 매핑으로 파싱 시작:', mapping);
      const parsed = await parseRegionalDataFile(
        pendingFile,
        mapping,
        100000,
        (progress, message) => {
          setUploadProgress(progress);
          setUploadMessage(message);
        }
      );
      console.log('파싱 완료:', parsed.regions.length, '개 데이터');

      setDataStore(parsed);
      setSelectedSido('');
      setSelectedSigungu('');
      setSelectedDong('');
      setSelectedRegions(new Set());
      setUploadProgress(100);
      setUploadMessage('완료!');
      console.log('상태 업데이트 완료');

      if (parsed.regions.length >= 100000) {
        alert(`⚠️ 파일이 너무 큽니다.\n\n처음 100,000개 행만 로드되었습니다.\n브라우저 성능을 위해 일부 데이터가 제한되었습니다.`);
      }

      setTimeout(() => {
        setUploadProgress(0);
        setUploadMessage('');
      }, 1500);
    } catch (error: any) {
      console.error('파싱 에러:', error);
      const errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
      setUploadError(errorMessage);
      setUploadProgress(0);
      setUploadMessage('');
      alert(`파일 파싱 실패:\n\n${errorMessage}\n\n브라우저 콘솔(F12)에서 자세한 내용을 확인하세요.`);
    } finally {
      setIsUploading(false);
      setPendingFile(null);
      setPendingHeaders([]);
      setPendingMapping(null);
    }
  };

  const handleMappingCancel = () => {
    setShowMappingDialog(false);
    setPendingFile(null);
    setPendingHeaders([]);
    setPendingMapping(null);
  };

  const handleDeleteData = () => {
    if (confirm('업로드된 지역 데이터를 삭제하시겠습니까?')) {
      setDataStore(null);
      localStorage.removeItem('regional_data_metadata');
      setSelectedSido('');
      setSelectedSigungu('');
      setSelectedDong('');
      setSelectedRegions(new Set());
    }
  };

  const handleAddToContext = () => {
    if (!dataStore || !selectedSido || !selectedSigungu || !selectedDong) return;

    // 선택한 지역의 모든 데이터 찾기
    const regionDatas = dataStore.regions.filter(
      r => r.sido === selectedSido && r.sigungu === selectedSigungu && r.dong === selectedDong
    );

    if (regionDatas.length === 0) return;

    // 데이터 타입에 따라 적절한 포맷팅 함수 선택
    let text = '';
    if (dataType === 'apartment') {
      text = regionDatas.length > 1
        ? formatGroupedApartmentData(regionDatas, dataStore.columns)
        : formatApartmentDataAsText(regionDatas[0], dataStore.columns);
    } else {
      text = regionDatas.length > 1
        ? formatGroupedRegionalData(regionDatas, dataStore.columns)
        : formatRegionalDataAsText(regionDatas[0], dataStore.columns);
    }

    onAddToContext(text);
  };

  const handleToggleRegion = (sido: string, sigungu: string, dong: string) => {
    const key = `${sido}|${sigungu}|${dong}`;
    const newSet = new Set(selectedRegions);

    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }

    setSelectedRegions(newSet);
  };

  const handleBulkGenerate = () => {
    if (!dataStore || selectedRegions.size === 0) return;

    const regions: RegionalData[] = [];
    selectedRegions.forEach(key => {
      const [sido, sigungu, dong] = key.split('|');
      // 해당 지역의 모든 업소 데이터 찾기
      const regionDatas = dataStore.regions.filter(
        r => r.sido === sido && r.sigungu === sigungu && r.dong === dong
      );
      regions.push(...regionDatas);
    });

    onBulkGenerate(regions, dataStore.columns);
    setSelectedRegions(new Set());
    setBulkSelectMode(false);
  };

  if (!dataStore) {
    return (
      <div className="bg-[#161B22] border border-slate-700 rounded-lg p-6">
        <div className="flex items-start gap-3 mb-4">
          <Icon name="MapPin" className="text-green-500 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-white">지역 데이터 업로드</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              엑셀 파일을 업로드하여 지역별 콘텐츠를 자동 생성하세요
            </p>
          </div>
        </div>

        <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-green-500/50 transition-colors">
          <Icon name="Upload" size={32} className="mx-auto mb-3 text-slate-500" />
          <p className="text-sm text-slate-300 mb-2">엑셀 또는 CSV 파일을 선택하세요</p>
          <div className="space-y-1 mb-4">
            <p className="text-xs text-slate-500">
              필수 컬럼: 시도명, 시군구명, 행정동명 (또는 법정동명)
            </p>
            <p className="text-xs text-slate-400">
              💡 최대 100,000개 행 처리 (대용량 파일 지원)
            </p>
          </div>
          <label className="inline-block">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
            <span className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg cursor-pointer inline-block transition-colors">
              {isUploading ? '업로드 중...' : '파일 선택'}
            </span>
          </label>
        </div>

        {uploadError && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-sm text-red-400">
            {uploadError}
          </div>
        )}

        {isUploading && uploadProgress > 0 && (
          <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Icon name="Loader2" className="animate-spin text-blue-400" size={16} />
              <span className="text-sm text-blue-300">{uploadMessage}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-right">{uploadProgress}%</p>
          </div>
        )}
      </div>
    );
  }

  const hierarchy = getRegionalHierarchy(dataStore.regions);
  const sidoList = Object.keys(hierarchy).sort();
  const sigunguList = selectedSido ? Object.keys(hierarchy[selectedSido]).sort() : [];
  const dongList = selectedSido && selectedSigungu ? hierarchy[selectedSido][selectedSigungu].sort() : [];

  // 선택한 지역의 모든 데이터 찾기
  const selectedRegionDatas = selectedSido && selectedSigungu && selectedDong
    ? dataStore.regions.filter(
        r => r.sido === selectedSido && r.sigungu === selectedSigungu && r.dong === selectedDong
      )
    : [];

  return (
    <>
      {/* 컬럼 매핑 다이얼로그 */}
      {showMappingDialog && pendingMapping && (
        <ColumnMappingDialog
          headers={pendingHeaders}
          currentMapping={pendingMapping}
          missingFields={getMissingMappings(pendingMapping)}
          onComplete={handleMappingComplete}
          onCancel={handleMappingCancel}
        />
      )}

      <div className="space-y-4">
        {/* 업로드된 파일 정보 */}
      <div className="bg-[#161B22] border border-slate-700 rounded-lg p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <Icon name="FileSpreadsheet" className="text-green-500 mt-0.5" size={18} />
            <div>
              <h4 className="text-sm font-bold text-white">{dataStore.fileName}</h4>
              <p className="text-xs text-slate-400 mt-1">
                총 {dataStore.regions.length.toLocaleString()}개 데이터 | {new Date(dataStore.uploadDate).toLocaleDateString()}
                  {dataStore.regions.length >= 100000 && (
                    <span className="ml-2 text-yellow-400">⚠️ 제한됨</span>
                  )}
              </p>
            </div>
          </div>
          <button
            onClick={handleDeleteData}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 모드 전환 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={() => setBulkSelectMode(false)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            !bulkSelectMode
              ? 'bg-green-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          단일 선택
        </button>
        <button
          onClick={() => setBulkSelectMode(true)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            bulkSelectMode
              ? 'bg-green-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          일괄 선택 ({selectedRegions.size})
        </button>
      </div>

      {!bulkSelectMode ? (
        <>
          {/* 지역 선택 드롭다운 */}
          <div className="bg-[#161B22] border border-slate-700 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">시/도</label>
              <select
                value={selectedSido}
                onChange={(e) => {
                  setSelectedSido(e.target.value);
                  setSelectedSigungu('');
                  setSelectedDong('');
                }}
                className="w-full bg-[#0D1117] border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:border-green-500 outline-none"
              >
                <option value="">선택하세요</option>
                {sidoList.map(sido => (
                  <option key={sido} value={sido}>{sido}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">시/군/구</label>
              <select
                value={selectedSigungu}
                onChange={(e) => {
                  setSelectedSigungu(e.target.value);
                  setSelectedDong('');
                }}
                disabled={!selectedSido}
                className="w-full bg-[#0D1117] border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:border-green-500 outline-none disabled:opacity-50"
              >
                <option value="">선택하세요</option>
                {sigunguList.map(sigungu => (
                  <option key={sigungu} value={sigungu}>{sigungu}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">읍/면/동</label>
              <select
                value={selectedDong}
                onChange={(e) => setSelectedDong(e.target.value)}
                disabled={!selectedSigungu}
                className="w-full bg-[#0D1117] border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:border-green-500 outline-none disabled:opacity-50"
              >
                <option value="">선택하세요</option>
                {dongList.map(dong => (
                  <option key={dong} value={dong}>{dong}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 선택된 지역 데이터 미리보기 */}
          {selectedRegionDatas.length > 0 && (
            <div className="bg-[#161B22] border border-green-700/50 rounded-lg p-4">
              <h5 className="text-xs font-bold text-green-400 mb-3">
                선택된 지역 데이터
              </h5>
              <div className="space-y-2 text-xs mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">지역</span>
                  <span className="text-white font-medium">
                    {selectedSido} {selectedSigungu} {selectedDong}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{dataType === 'apartment' ? '단지 수' : '업소 수'}</span>
                  <span className="text-white font-medium">{selectedRegionDatas.length}개</span>
                </div>
              </div>

              {/* 상권 인사이트 미리보기 (상가업소만) */}
              {dataType === 'commercial' && selectedRegionDatas.length > 1 && (() => {
                // 업종 분석
                const industries = new Map<string, number>();
                selectedRegionDatas.forEach(r => {
                  const industry = r.data['상권업종중분류명'] || r.data['상권업종대분류명'];
                  if (industry) {
                    const name = String(industry);
                    industries.set(name, (industries.get(name) || 0) + 1);
                  }
                });

                const sorted = Array.from(industries.entries())
                  .sort((a, b) => b[1] - a[1]);

                // 특화 업종
                const specialized = sorted.filter(([_, count]) =>
                  (count / selectedRegionDatas.length) >= 0.3
                );

                // 프랜차이즈 vs 로컬
                let franchise = 0, local = 0;
                selectedRegionDatas.forEach(r => {
                  const branch = String(r.data['지점명'] || '').trim();
                  if (branch && branch !== '' && branch !== '-') {
                    franchise++;
                  } else {
                    local++;
                  }
                });

                return (
                  <div className="mb-3 space-y-3">
                    {/* 주요 업종 */}
                    <div>
                      <div className="text-xs font-bold text-green-400 mb-2">주요 업종 TOP 5</div>
                      <div className="space-y-1">
                        {sorted.slice(0, 5).map(([name, count]) => {
                          const pct = ((count / selectedRegionDatas.length) * 100).toFixed(1);
                          const isSpec = parseFloat(pct) >= 30;
                          return (
                            <div key={name} className="text-xs text-slate-300 flex justify-between">
                              <span>{name} {isSpec && '⭐'}</span>
                              <span className="text-green-400">{count}개 ({pct}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 특화 업종 */}
                    {specialized.length > 0 && (
                      <div className="p-2 bg-green-900/20 border border-green-700/50 rounded">
                        <div className="text-xs text-green-400 font-bold">
                          💡 {specialized.map(([name]) => name).join(', ')} 특화 상권
                        </div>
                      </div>
                    )}

                    {/* 프랜차이즈 vs 로컬 */}
                    <div>
                      <div className="text-xs font-bold text-slate-400 mb-1">상권 구성</div>
                      <div className="flex gap-2 text-xs">
                        <div className="flex-1 p-2 bg-slate-800 rounded">
                          <div className="text-slate-400">로컬</div>
                          <div className="text-white font-bold">
                            {((local / selectedRegionDatas.length) * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className="flex-1 p-2 bg-slate-800 rounded">
                          <div className="text-slate-400">프랜차이즈</div>
                          <div className="text-white font-bold">
                            {((franchise / selectedRegionDatas.length) * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 샘플 업소/단지 */}
              {selectedRegionDatas.length === 1 ? (
                <div className="space-y-2 text-xs">
                  {(dataType === 'apartment'
                    ? ['단지명', '단지분류', '세대수', '도로명주소']
                    : ['상호명', '상권업종중분류명', '도로명주소', '지번주소']
                  ).map(field => {
                    const value = selectedRegionDatas[0].data[field];
                    if (!value) return null;
                    return (
                      <div key={field} className="flex justify-between">
                        <span className="text-slate-400">{field}</span>
                        <span className="text-white truncate ml-2 max-w-[200px]" title={String(value)}>
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs">
                  <div className="text-slate-400 mb-2">
                    전체 {dataType === 'apartment' ? '단지' : '업소'} 목록 ({selectedRegionDatas.length}개)
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {selectedRegionDatas.map((region, idx) => {
                      if (dataType === 'apartment') {
                        return (
                          <div key={idx} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 hover:border-green-500/50 transition-colors">
                            <div className="font-bold text-white mb-2 text-sm">
                              {idx + 1}. {region.data['단지명'] || '이름없음'}
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-400">세대수:</span>
                                <span className="text-slate-200">{region.data['세대수'] || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">분양세대수:</span>
                                <span className="text-slate-200">{region.data['분양세대수'] || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">동수:</span>
                                <span className="text-slate-200">{region.data['동수'] || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">복도유형:</span>
                                <span className="text-slate-200">{region.data['복도유형'] || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">최고층수:</span>
                                <span className="text-slate-200">{region.data['최고층수'] || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">지하층수:</span>
                                <span className="text-slate-200">{region.data['지하층수'] || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">난방방식:</span>
                                <span className="text-slate-200">{region.data['난방방식'] || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">총주차대수:</span>
                                <span className="text-slate-200">{region.data['총주차대수'] || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">지상주차:</span>
                                <span className="text-slate-200">{region.data['지상주차대수'] || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">지하주차:</span>
                                <span className="text-slate-200">{region.data['지하주차대수'] || '-'}</span>
                              </div>
                              <div className="col-span-2 flex justify-between">
                                <span className="text-slate-400">시공사:</span>
                                <span className="text-slate-200">{region.data['시공사'] || '-'}</span>
                              </div>
                              <div className="col-span-2 flex justify-between">
                                <span className="text-slate-400">시행사:</span>
                                <span className="text-slate-200">{region.data['시행사'] || '-'}</span>
                              </div>
                              <div className="col-span-2 flex justify-between">
                                <span className="text-slate-400">주소:</span>
                                <span className="text-slate-200 text-right ml-2 break-all">
                                  {region.data['도로명주소'] || region.data['법정동주소'] || '-'}
                                </span>
                              </div>
                              {region.data['전기차충전시설(상세)'] && (
                                <div className="col-span-2 flex justify-between">
                                  <span className="text-slate-400">전기차충전:</span>
                                  <span className="text-slate-200 text-right ml-2">
                                    {region.data['전기차충전시설(상세)']}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div key={idx} className="text-slate-300 hover:bg-slate-800/30 p-1 rounded">
                            • {region.data['상호명'] || '이름없음'} ({region.data['상권업종중분류명'] || '분류없음'})
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={handleAddToContext}
                className="w-full mt-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                컨텍스트에 추가
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* 일괄 선택 모드 */}
          <div className="bg-[#161B22] border border-slate-700 rounded-lg p-4">
            <div className="max-h-96 overflow-y-auto space-y-1">
              {(() => {
                // 지역별로 그룹화
                const grouped = groupRegionsByLocation(dataStore.regions);
                const entries = Array.from(grouped.entries()).sort((a, b) => {
                  const [sidoA, sigunguA, dongA] = a[0].split('|');
                  const [sidoB, sigunguB, dongB] = b[0].split('|');
                  return (sidoA + sigunguA + dongA).localeCompare(sidoB + sigunguB + dongB);
                });

                return entries.map(([key, regions]) => {
                  const [sido, sigungu, dong] = key.split('|');
                  const isSelected = selectedRegions.has(key);

                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        isSelected ? 'bg-green-900/30' : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRegion(sido, sigungu, dong)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-white flex-1">
                        {sido} {sigungu} {dong}
                      </span>
                      <span className="text-xs text-slate-400">
                        {regions.length}개 {dataType === 'apartment' ? '단지' : '업소'}
                      </span>
                    </label>
                  );
                });
              })()}
            </div>

            {selectedRegions.size > 0 && (
              <button
                onClick={handleBulkGenerate}
                className="w-full mt-4 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="Sparkles" size={18} />
                선택한 {selectedRegions.size}개 지역 일괄 생성
              </button>
            )}
          </div>
        </>
      )}
      </div>
    </>
  );
};
