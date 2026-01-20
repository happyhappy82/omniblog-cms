import { ColumnMappingDictionary, RequiredFieldMapping } from '../types';

const MAPPING_STORAGE_KEY = 'column_mapping_dictionary';

/**
 * 컬럼 매핑 딕셔너리 가져오기
 */
export function getColumnMappingDictionary(): ColumnMappingDictionary {
  try {
    const saved = localStorage.getItem(MAPPING_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as ColumnMappingDictionary;
    }
  } catch (error) {
    console.error('Failed to load column mapping dictionary:', error);
  }
  return {};
}

/**
 * 컬럼 매핑 딕셔너리 저장
 */
export function saveColumnMappingDictionary(dictionary: ColumnMappingDictionary): void {
  try {
    localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(dictionary));
    console.log('컬럼 매핑 저장 완료:', dictionary);
  } catch (error) {
    console.error('Failed to save column mapping dictionary:', error);
  }
}

/**
 * 새로운 매핑 추가 (누적)
 */
export function addColumnMapping(
  columnName: string,
  fieldType: 'sido' | 'sigungu' | 'dong' | 'other'
): void {
  const dictionary = getColumnMappingDictionary();
  dictionary[columnName] = fieldType;
  saveColumnMappingDictionary(dictionary);
}

/**
 * 매핑 삭제
 */
export function removeColumnMapping(columnName: string): void {
  const dictionary = getColumnMappingDictionary();
  delete dictionary[columnName];
  saveColumnMappingDictionary(dictionary);
}

/**
 * 모든 매핑 초기화
 */
export function clearAllMappings(): void {
  localStorage.removeItem(MAPPING_STORAGE_KEY);
  console.log('모든 컬럼 매핑 삭제 완료');
}

/**
 * 헤더에서 필수 필드 자동 매칭 시도
 */
export function autoMatchColumns(headers: string[]): RequiredFieldMapping {
  const dictionary = getColumnMappingDictionary();
  const result: RequiredFieldMapping = {
    sido: null,
    sigungu: null,
    dong: null,
    eupMyeon: null,
    dongRi: null
  };

  // 1. 딕셔너리에서 먼저 찾기
  headers.forEach(header => {
    const normalized = header.trim();
    const fieldType = dictionary[normalized];

    if (fieldType === 'sido' && !result.sido) {
      result.sido = normalized;
    } else if (fieldType === 'sigungu' && !result.sigungu) {
      result.sigungu = normalized;
    } else if (fieldType === 'dong' && !result.dong) {
      result.dong = normalized;
    }
  });

  // 2. 딕셔너리에 없으면 패턴 매칭 (기본 규칙)
  if (!result.sido) {
    result.sido = headers.find(h => {
      const n = h.trim();
      return n === '시도명' || n === '시도' || n === '시/도' || n === '시·도' || n.includes('시도명');
    }) || null;
  }

  if (!result.sigungu) {
    result.sigungu = headers.find(h => {
      const n = h.trim();
      return n === '시군구명' || n === '시군구' || n === '시/군/구' || n === '시·군·구' || n === '구명' || n.includes('시군구명');
    }) || null;
  }

  // 3. 부동산 데이터: 읍면과 동리를 별도로 찾기
  const eupMyeonCol = headers.find(h => h.trim() === '읍면');
  const dongRiCol = headers.find(h => h.trim() === '동리');

  if (eupMyeonCol && dongRiCol) {
    // 부동산 데이터 (읍면 + 동리)
    result.eupMyeon = eupMyeonCol;
    result.dongRi = dongRiCol;
    result.dong = null; // dong은 파싱 시 eupMyeon + dongRi로 생성됨
  } else if (!result.dong) {
    // 일반 데이터 (행정동명 등)
    result.dong = headers.find(h => {
      const n = h.trim();
      return n === '행정동명' || n === '법정동명' || n === '읍면동명' || n === '읍면동' || n === '동명' || n.includes('행정동명') || n.includes('법정동명');
    }) || null;
  }

  return result;
}

/**
 * 필요한 매핑 확인 (부족한 필드 반환)
 */
export function getMissingMappings(mapping: RequiredFieldMapping): Array<'sido' | 'sigungu' | 'dong'> {
  const missing: Array<'sido' | 'sigungu' | 'dong'> = [];

  if (!mapping.sido) missing.push('sido');
  if (!mapping.sigungu) missing.push('sigungu');

  // dong 또는 (eupMyeon + dongRi) 중 하나는 있어야 함
  if (!mapping.dong && !(mapping.eupMyeon && mapping.dongRi)) {
    missing.push('dong');
  }

  return missing;
}

/**
 * 필드 이름을 한글로 변환
 */
export function getFieldLabel(fieldType: 'sido' | 'sigungu' | 'dong'): string {
  const labels = {
    sido: '시/도',
    sigungu: '시/군/구',
    dong: '읍/면/동'
  };
  return labels[fieldType];
}
