import * as XLSX from 'xlsx';
import { RegionalData, RegionalDataStore, RequiredFieldMapping } from '../types';
import { autoMatchColumns } from './columnMapping';

/**
 * 엑셀 파일의 헤더만 읽기 (매핑 확인용)
 */
export async function readFileHeaders(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 1) {
          throw new Error('파일에 데이터가 없습니다.');
        }

        const headers = (jsonData[0] as string[]).map(h => String(h || '').trim());
        resolve(headers);
      } catch (error: any) {
        reject(new Error(`헤더 읽기 실패: ${error.message}`));
      }
    };

    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 엑셀/CSV 파일을 파싱하여 RegionalDataStore로 변환 (대용량 파일 지원)
 *
 * @param file - 파싱할 파일
 * @param mapping - 컬럼 매핑 (옵션)
 * @param maxRows - 최대 로드 행 수 (기본: 100000)
 * @param onProgress - 진행률 콜백
 */
export async function parseRegionalDataFile(
  file: File,
  mapping?: RequiredFieldMapping,
  maxRows: number = 100000,
  onProgress?: (progress: number, message: string) => void
): Promise<RegionalDataStore> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        onProgress?.(10, '파일 읽기 중...');

        const data = e.target?.result;
        const workbook = XLSX.read(data, {
          type: 'array',
          codepage: 65001,
          sheetRows: maxRows + 1 // 헤더 + 최대 행수
        });

        onProgress?.(30, '시트 파싱 중...');

        // 첫 번째 시트 읽기
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // JSON으로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          throw new Error('파일에 데이터가 없습니다.');
        }

        onProgress?.(50, '데이터 처리 중...');

        // 첫 번째 행: 컬럼명 (trim 처리)
        const headers = (jsonData[0] as string[]).map(h => String(h || '').trim());

        console.log('파일의 컬럼명:', headers);

        // 매핑이 제공되지 않았으면 자동 매칭 시도
        let finalMapping = mapping;
        if (!finalMapping) {
          finalMapping = autoMatchColumns(headers);
          console.log('자동 매칭 결과:', finalMapping);
        }

        // 필수 컬럼 인덱스 찾기
        const sidoIndex = finalMapping.sido ? headers.indexOf(finalMapping.sido) : -1;
        const sigunguIndex = finalMapping.sigungu ? headers.indexOf(finalMapping.sigungu) : -1;
        const dongIndex = finalMapping.dong ? headers.indexOf(finalMapping.dong) : -1;

        // 부동산 데이터: 읍면과 동리
        const eupMyeonIndex = finalMapping.eupMyeon ? headers.indexOf(finalMapping.eupMyeon) : -1;
        const dongRiIndex = finalMapping.dongRi ? headers.indexOf(finalMapping.dongRi) : -1;

        // 필수 필드 검증: sido, sigungu는 필수, dong 또는 (eupMyeon + dongRi) 중 하나는 있어야 함
        if (sidoIndex === -1 || sigunguIndex === -1) {
          const error = new Error('MAPPING_REQUIRED') as any;
          error.headers = headers;
          error.currentMapping = finalMapping;
          throw error;
        }

        // dong이 없고 eupMyeon/dongRi도 없으면 에러
        if (dongIndex === -1 && (eupMyeonIndex === -1 || dongRiIndex === -1)) {
          const error = new Error('MAPPING_REQUIRED') as any;
          error.headers = headers;
          error.currentMapping = finalMapping;
          throw error;
        }

        // 데이터 파싱 (청크 단위)
        const regions: RegionalData[] = [];
        const totalRows = jsonData.length - 1; // 헤더 제외
        const chunkSize = 1000; // 1000행씩 처리

        let processedRows = 0;

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];

          const sido = String(row[sidoIndex] || '').trim();
          const sigungu = String(row[sigunguIndex] || '').trim();

          // dong 처리: 일반 데이터는 dongIndex, 부동산 데이터는 eupMyeon + dongRi
          let dong = '';
          if (dongIndex !== -1) {
            dong = String(row[dongIndex] || '').trim();
          } else if (eupMyeonIndex !== -1 && dongRiIndex !== -1) {
            const eupMyeon = String(row[eupMyeonIndex] || '').trim();
            const dongRi = String(row[dongRiIndex] || '').trim();
            dong = `${eupMyeon} ${dongRi}`.trim();
          }

          // 빈 행 건너뛰기
          if (!sido && !sigungu && !dong) continue;

          // 나머지 데이터 수집
          const data: Record<string, string | number> = {};
          headers.forEach((header, index) => {
            // 지역 컬럼은 제외 (sido, sigungu, dong 또는 eupMyeon, dongRi)
            if (index === sidoIndex || index === sigunguIndex || index === dongIndex) return;
            if (index === eupMyeonIndex || index === dongRiIndex) return;

            const value = row[index];
            if (value !== undefined && value !== null && value !== '') {
              // 숫자로 변환 가능하면 숫자로, 아니면 문자열로
              data[header] = typeof value === 'number' ? value : String(value);
            }
          });

          regions.push({
            sido,
            sigungu,
            dong,
            data
          });

          // 진행률 업데이트
          processedRows++;
          if (processedRows % chunkSize === 0) {
            const progress = 50 + Math.floor((processedRows / totalRows) * 40);
            onProgress?.(progress, `${processedRows.toLocaleString()}개 처리 중...`);
          }
        }

        if (regions.length === 0) {
          throw new Error('파싱된 데이터가 없습니다.');
        }

        onProgress?.(90, '최종 처리 중...');

        const result: RegionalDataStore = {
          fileName: file.name,
          uploadDate: new Date().toISOString(),
          columns: headers.filter((_, i) =>
            i !== sidoIndex &&
            i !== sigunguIndex &&
            i !== dongIndex &&
            i !== eupMyeonIndex &&
            i !== dongRiIndex
          ),
          regions
        };

        onProgress?.(100, '완료!');

        // 대용량 파일 경고
        if (regions.length >= maxRows) {
          console.warn(`⚠️ 파일이 너무 큽니다. 처음 ${maxRows.toLocaleString()}개 행만 로드되었습니다.`);
        }

        resolve(result);
      } catch (error: any) {
        reject(new Error(`파일 파싱 실패: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };

    reader.readAsArrayBuffer(file); // ArrayBuffer로 읽기 (한글 인코딩 지원)
  });
}

/**
 * 지역별로 그룹화된 데이터 구조 생성
 */
export function getRegionalHierarchy(regions: RegionalData[]) {
  const hierarchy: Record<string, Record<string, string[]>> = {};

  regions.forEach(region => {
    if (!hierarchy[region.sido]) {
      hierarchy[region.sido] = {};
    }
    if (!hierarchy[region.sido][region.sigungu]) {
      hierarchy[region.sido][region.sigungu] = [];
    }
    if (!hierarchy[region.sido][region.sigungu].includes(region.dong)) {
      hierarchy[region.sido][region.sigungu].push(region.dong);
    }
  });

  return hierarchy;
}

/**
 * 특정 지역의 데이터 찾기
 */
export function findRegionalData(
  regions: RegionalData[],
  sido: string,
  sigungu: string,
  dong: string
): RegionalData | undefined {
  return regions.find(
    r => r.sido === sido && r.sigungu === sigungu && r.dong === dong
  );
}

/**
 * 지역 데이터를 텍스트로 포맷팅 (context에 추가하기 위해)
 */
export function formatRegionalDataAsText(region: RegionalData, columns: string[]): string {
  const lines = [
    `[지역 데이터]`,
    `지역: ${region.sido} ${region.sigungu} ${region.dong}`,
    ``,
  ];

  columns.forEach(col => {
    const value = region.data[col];
    if (value !== undefined) {
      lines.push(`${col}: ${value}`);
    }
  });

  return lines.join('\n');
}

/**
 * 상가업소 데이터를 텍스트로 포맷팅 (여러 업소를 요약)
 */
export function formatCommercialDataAsText(region: RegionalData, columns: string[]): string {
  const lines = [
    `[지역 데이터]`,
    `지역: ${region.sido} ${region.sigungu} ${region.dong}`,
    ``,
    `[상가업소 정보]`,
  ];

  // 주요 필드만 선택적으로 출력
  const importantFields = [
    '상호명',
    '지점명',
    '상권업종대분류명',
    '상권업종중분류명',
    '상권업종소분류명',
    '표준산업분류명',
    '도로명주소',
    '지번주소'
  ];

  importantFields.forEach(field => {
    const value = region.data[field];
    if (value !== undefined && value !== '') {
      lines.push(`${field}: ${value}`);
    }
  });

  // 나머지 데이터 추가
  const otherFields = columns.filter(col => !importantFields.includes(col));
  if (otherFields.length > 0) {
    lines.push('');
    lines.push('[기타 정보]');
    otherFields.forEach(col => {
      const value = region.data[col];
      if (value !== undefined && value !== '') {
        lines.push(`${col}: ${value}`);
      }
    });
  }

  return lines.join('\n');
}

/**
 * 같은 지역의 여러 업소 데이터를 하나로 통합
 */
export function groupRegionsByLocation(regions: RegionalData[]): Map<string, RegionalData[]> {
  const grouped = new Map<string, RegionalData[]>();

  regions.forEach(region => {
    const key = `${region.sido}|${region.sigungu}|${region.dong}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(region);
  });

  return grouped;
}

/**
 * 지역별로 통합된 데이터를 텍스트로 포맷팅
 */
export function formatGroupedRegionalData(
  regions: RegionalData[],
  columns: string[]
): string {
  if (regions.length === 0) return '';

  const first = regions[0];
  const lines = [
    `[지역 상권 분석 데이터]`,
    `지역: ${first.sido} ${first.sigungu} ${first.dong}`,
    `총 업소 수: ${regions.length}개`,
    `분석 일자: ${new Date().toLocaleDateString()}`,
    ``,
  ];

  // 1. 업종별 통계 & 특화 업종 판단
  const industries = new Map<string, number>();
  regions.forEach(r => {
    const industry = r.data['상권업종중분류명'] || r.data['상권업종대분류명'];
    if (industry) {
      const name = String(industry);
      industries.set(name, (industries.get(name) || 0) + 1);
    }
  });

  if (industries.size > 0) {
    const sorted = Array.from(industries.entries())
      .sort((a, b) => b[1] - a[1]);

    lines.push('[업종별 분포 및 집중도]');
    sorted.slice(0, 10).forEach(([name, count]) => {
      const percentage = ((count / regions.length) * 100).toFixed(1);
      const isSpecialized = parseFloat(percentage) >= 30;
      const marker = isSpecialized ? ' ⭐ 특화업종' : '';
      lines.push(`- ${name}: ${count}개 (${percentage}%)${marker}`);
    });

    // 특화 업종 요약
    const specialized = sorted.filter(([_, count]) => (count / regions.length) >= 0.3);
    if (specialized.length > 0) {
      lines.push('');
      lines.push(`💡 상권 특성: ${specialized.map(([name]) => name).join(', ')} 특화 상권`);
    }
    lines.push('');
  }

  // 2. 층별 분포 분석
  const floors = new Map<string, number>();
  const floorIndustries = new Map<string, Map<string, number>>();

  regions.forEach(r => {
    const floorInfo = String(r.data['층정보'] || '').trim();
    const industry = String(r.data['상권업종중분류명'] || r.data['상권업종대분류명'] || '기타').trim();

    if (floorInfo) {
      // 층수 분류
      let floorCategory = '';
      if (floorInfo.includes('지하') || floorInfo.startsWith('B') || floorInfo === '-1') {
        floorCategory = '지하';
      } else if (floorInfo === '1' || floorInfo.includes('1층')) {
        floorCategory = '1층';
      } else if (/^[2-5]/.test(floorInfo)) {
        floorCategory = '2-5층';
      } else if (parseInt(floorInfo) >= 6 || /^[6-9]/.test(floorInfo)) {
        floorCategory = '6층 이상';
      } else {
        floorCategory = '기타';
      }

      if (floorCategory) {
        floors.set(floorCategory, (floors.get(floorCategory) || 0) + 1);

        // 층별 업종 수집
        if (!floorIndustries.has(floorCategory)) {
          floorIndustries.set(floorCategory, new Map());
        }
        const industryMap = floorIndustries.get(floorCategory)!;
        industryMap.set(industry, (industryMap.get(industry) || 0) + 1);
      }
    }
  });

  if (floors.size > 0) {
    lines.push('[층별 상권 분포]');
    const floorOrder = ['지하', '1층', '2-5층', '6층 이상', '기타'];
    floorOrder.forEach(floor => {
      if (floors.has(floor)) {
        const count = floors.get(floor)!;
        const percentage = ((count / regions.length) * 100).toFixed(1);

        // 해당 층의 주요 업종 (상위 2개)
        const topIndustries = floorIndustries.get(floor);
        let industryDesc = '';
        if (topIndustries && topIndustries.size > 0) {
          const sorted = Array.from(topIndustries.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([name]) => name);
          industryDesc = ` (주로: ${sorted.join(', ')})`;
        }

        lines.push(`- ${floor}: ${count}개 (${percentage}%)${industryDesc}`);
      }
    });
    lines.push('');
  }

  // 3. 주요 상권 거리/건물 분석
  const streets = new Map<string, number>();
  const buildings = new Map<string, number>();

  regions.forEach(r => {
    const street = String(r.data['도로명'] || '').trim();
    const building = String(r.data['건물명'] || '').trim();

    if (street && street !== '') {
      streets.set(street, (streets.get(street) || 0) + 1);
    }
    if (building && building !== '') {
      buildings.set(building, (buildings.get(building) || 0) + 1);
    }
  });

  if (streets.size > 0) {
    lines.push('[주요 상권 거리 TOP 5]');
    Array.from(streets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([street, count]) => {
        const percentage = ((count / regions.length) * 100).toFixed(1);
        lines.push(`- ${street}: ${count}개 업소 (${percentage}%)`);
      });
    lines.push('');
  }

  if (buildings.size > 3) {
    lines.push('[주요 상가 건물 TOP 3]');
    Array.from(buildings.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([building, count]) => {
        lines.push(`- ${building}: ${count}개 업소`);
      });
    lines.push('');
  }

  // 4. 경쟁 강도 분석
  if (industries.size > 0) {
    lines.push('[경쟁 강도 분석]');
    const sorted = Array.from(industries.entries())
      .sort((a, b) => b[1] - a[1]);

    // 레드오션 (10개 이상)
    const redOcean = sorted.filter(([_, count]) => count >= 10).slice(0, 5);
    if (redOcean.length > 0) {
      lines.push('🔴 레드오션 (경쟁 치열):');
      redOcean.forEach(([name, count]) => {
        lines.push(`   - ${name}: ${count}개 경쟁업체`);
      });
    }

    // 블루오션 (3개 이하)
    const blueOcean = sorted.filter(([_, count]) => count <= 3 && count > 0).slice(0, 5);
    if (blueOcean.length > 0) {
      lines.push('🔵 블루오션 (진입 기회):');
      blueOcean.forEach(([name, count]) => {
        lines.push(`   - ${name}: ${count}개만 존재`);
      });
    }
    lines.push('');
  }

  // 5. 프랜차이즈 vs 로컬 비율
  let franchiseCount = 0;
  let localCount = 0;

  regions.forEach(r => {
    const branch = String(r.data['지점명'] || '').trim();
    if (branch && branch !== '' && branch !== '-') {
      franchiseCount++;
    } else {
      localCount++;
    }
  });

  const total = franchiseCount + localCount;
  if (total > 0) {
    lines.push('[프랜차이즈 vs 로컬 업소]');
    lines.push(`- 로컬 업소: ${localCount}개 (${((localCount / total) * 100).toFixed(1)}%)`);
    lines.push(`- 프랜차이즈: ${franchiseCount}개 (${((franchiseCount / total) * 100).toFixed(1)}%)`);

    const dominantType = localCount > franchiseCount ? '로컬 중심 상권' : '프랜차이즈 중심 상권';
    lines.push(`💡 ${dominantType}`);
    lines.push('');
  }

  // 주요 업소 샘플 (최대 3개)
  lines.push('[주요 업소 샘플]');
  regions.slice(0, 3).forEach((region, index) => {
    const name = region.data['상호명'] || '이름없음';
    const type = region.data['상권업종중분류명'] || region.data['상권업종대분류명'] || '분류없음';
    const addr = region.data['도로명주소'] || region.data['지번주소'] || '주소없음';
    const floor = region.data['층정보'] ? `${region.data['층정보']}층` : '';

    lines.push(`${index + 1}. ${name} (${type}) ${floor}`);
    lines.push(`   ${addr}`);
  });

  if (regions.length > 3) {
    lines.push(`... 외 ${regions.length - 3}개 업소`);
  }

  return lines.join('\n');
}

/**
 * 부동산 아파트 단지 데이터를 텍스트로 포맷팅
 */
export function formatApartmentDataAsText(region: RegionalData, columns: string[]): string {
  const lines = [
    `[아파트 단지 정보]`,
    `지역: ${region.sido} ${region.sigungu} ${region.dong}`,
    ``,
  ];

  // 주요 필드만 선택적으로 출력
  const importantFields = [
    '단지코드',
    '단지명',
    '단지분류',
    '법정동주소',
    '도로명주소',
    '사용승인일',
    '동수',
    '세대수',
    '분양세대수',
    '임대세대수',
    '관리방식',
    '난방방식',
    '시공사',
    '시행사',
    '총주차대수',
    '지상주차대수',
    '지하주차대수',
    'CCTV대수',
    '홈네트워크',
    '최고층수',
    '차량보유대수(전체)',
    '전기차충전시설(상세)'
  ];

  importantFields.forEach(field => {
    const value = region.data[field];
    if (value !== undefined && value !== '' && value !== null) {
      lines.push(`${field}: ${value}`);
    }
  });

  // 나머지 데이터는 간략하게 표시
  const otherFields = columns.filter(col => !importantFields.includes(col));
  if (otherFields.length > 0) {
    lines.push('');
    lines.push('[기타 세부 정보]');
    let count = 0;
    otherFields.forEach(col => {
      const value = region.data[col];
      if (value !== undefined && value !== '' && value !== null && count < 10) {
        lines.push(`${col}: ${value}`);
        count++;
      }
    });
    if (otherFields.length > 10) {
      lines.push(`... 외 ${otherFields.length - 10}개 항목`);
    }
  }

  return lines.join('\n');
}

/**
 * 지역별로 통합된 아파트 데이터를 텍스트로 포맷팅
 */
export function formatGroupedApartmentData(
  regions: RegionalData[],
  columns: string[]
): string {
  if (regions.length === 0) return '';

  const first = regions[0];
  const lines = [
    `[지역 아파트 단지 분석]`,
    `지역: ${first.sido} ${first.sigungu} ${first.dong}`,
    `총 단지 수: ${regions.length}개`,
    `분석 일자: ${new Date().toLocaleDateString()}`,
    ``,
  ];

  // 1. 전체 세대수 및 평균 통계
  let totalHouseholds = 0;
  let totalBuildings = 0;
  let totalParking = 0;
  let validCount = 0;

  regions.forEach(r => {
    const households = parseInt(String(r.data['세대수'] || '0').replace(/,/g, ''));
    const buildings = parseInt(String(r.data['동수'] || '0').replace(/,/g, ''));
    const parking = parseInt(String(r.data['총주차대수'] || '0').replace(/,/g, ''));

    if (!isNaN(households) && households > 0) {
      totalHouseholds += households;
      validCount++;
    }
    if (!isNaN(buildings)) totalBuildings += buildings;
    if (!isNaN(parking)) totalParking += parking;
  });

  if (validCount > 0) {
    lines.push('[지역 전체 통계]');
    lines.push(`- 총 세대수: ${totalHouseholds.toLocaleString()}세대`);
    lines.push(`- 평균 세대수: ${Math.round(totalHouseholds / validCount).toLocaleString()}세대/단지`);
    lines.push(`- 총 동수: ${totalBuildings}동`);
    lines.push(`- 총 주차대수: ${totalParking.toLocaleString()}대`);
    if (totalHouseholds > 0) {
      lines.push(`- 세대당 주차면수: ${(totalParking / totalHouseholds).toFixed(2)}대/세대`);
    }
    lines.push('');
  }

  // 2. 단지 규모별 분포
  const sizeCategories = new Map<string, number>();
  regions.forEach(r => {
    const households = parseInt(String(r.data['세대수'] || '0').replace(/,/g, ''));
    if (!isNaN(households) && households > 0) {
      let category = '';
      if (households < 100) category = '소형 단지 (100세대 미만)';
      else if (households < 300) category = '중형 단지 (100-300세대)';
      else if (households < 500) category = '대형 단지 (300-500세대)';
      else if (households < 1000) category = '대단지 (500-1000세대)';
      else category = '초대단지 (1000세대 이상)';

      sizeCategories.set(category, (sizeCategories.get(category) || 0) + 1);
    }
  });

  if (sizeCategories.size > 0) {
    lines.push('[단지 규모별 분포]');
    const sizeOrder = [
      '소형 단지 (100세대 미만)',
      '중형 단지 (100-300세대)',
      '대형 단지 (300-500세대)',
      '대단지 (500-1000세대)',
      '초대단지 (1000세대 이상)'
    ];
    sizeOrder.forEach(cat => {
      if (sizeCategories.has(cat)) {
        const count = sizeCategories.get(cat)!;
        const pct = ((count / regions.length) * 100).toFixed(1);
        lines.push(`- ${cat}: ${count}개 (${pct}%)`);
      }
    });
    lines.push('');
  }

  // 3. 난방 방식 분석
  const heatingTypes = new Map<string, number>();
  regions.forEach(r => {
    const heating = String(r.data['난방방식'] || '').trim();
    if (heating && heating !== '') {
      heatingTypes.set(heating, (heatingTypes.get(heating) || 0) + 1);
    }
  });

  if (heatingTypes.size > 0) {
    lines.push('[난방 방식]');
    Array.from(heatingTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const pct = ((count / regions.length) * 100).toFixed(1);
        lines.push(`- ${type}: ${count}개 단지 (${pct}%)`);
      });
    lines.push('');
  }

  // 4. 시공사 분석 (TOP 5)
  const builders = new Map<string, number>();
  regions.forEach(r => {
    const builder = String(r.data['시공사'] || '').trim();
    if (builder && builder !== '') {
      builders.set(builder, (builders.get(builder) || 0) + 1);
    }
  });

  if (builders.size > 0) {
    lines.push('[주요 시공사 TOP 5]');
    Array.from(builders.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([builder, count]) => {
        lines.push(`- ${builder}: ${count}개 단지`);
      });
    lines.push('');
  }

  // 5. 편의시설 및 인프라
  let homeNetworkCount = 0;
  let evChargingCount = 0;
  let cctvCount = 0;

  regions.forEach(r => {
    const homeNet = String(r.data['홈네트워크'] || '').trim().toLowerCase();
    const evCharging = String(r.data['전기충전기설치여부(지상)'] || r.data['전기충전기설치여부(지하)'] || '').trim();
    const cctv = parseInt(String(r.data['CCTV대수'] || '0').replace(/,/g, ''));

    if (homeNet.includes('있') || homeNet.includes('yes') || homeNet === 'y') homeNetworkCount++;
    if (evCharging && evCharging !== '없음' && evCharging !== 'N' && evCharging !== 'n') evChargingCount++;
    if (!isNaN(cctv) && cctv > 0) cctvCount++;
  });

  lines.push('[편의시설 및 인프라]');
  lines.push(`- 홈네트워크 설치: ${homeNetworkCount}개 단지 (${((homeNetworkCount / regions.length) * 100).toFixed(1)}%)`);
  lines.push(`- 전기차 충전시설: ${evChargingCount}개 단지 (${((evChargingCount / regions.length) * 100).toFixed(1)}%)`);
  lines.push(`- CCTV 설치: ${cctvCount}개 단지`);
  lines.push('');

  // 6. 전체 단지 상세 정보 (세대수 기준 정렬)
  lines.push('[전체 단지 상세 정보]');
  lines.push('');

  const sortedBySize = [...regions]
    .map(r => ({
      name: r.data['단지명'] || '이름없음',
      households: parseInt(String(r.data['세대수'] || '0').replace(/,/g, '')),
      salesHouseholds: r.data['분양세대수'] || '-',
      address: r.data['도로명주소'] || r.data['법정동주소'] || '주소없음',
      buildings: r.data['동수'] || '-',
      corridorType: r.data['복도유형'] || '-',
      builder: r.data['시공사'] || '-',
      developer: r.data['시행사'] || '-',
      heating: r.data['난방방식'] || '-',
      totalParking: r.data['총주차대수'] || '-',
      groundParking: r.data['지상주차대수'] || '-',
      undergroundParking: r.data['지하주차대수'] || '-',
      maxFloor: r.data['최고층수'] || '-',
      undergroundFloor: r.data['지하층수'] || '-',
      evCharging: r.data['전기차충전시설(상세)'] || '-'
    }))
    .sort((a, b) => b.households - a.households);

  sortedBySize.forEach((apt, index) => {
    lines.push(`${index + 1}. ${apt.name}`);
    lines.push(`   - 세대수: ${typeof apt.households === 'number' ? apt.households.toLocaleString() : apt.households}세대`);
    lines.push(`   - 분양세대수: ${apt.salesHouseholds}`);
    lines.push(`   - 동수: ${apt.buildings}`);
    lines.push(`   - 복도유형: ${apt.corridorType}`);
    lines.push(`   - 최고층수: ${apt.maxFloor} / 지하층수: ${apt.undergroundFloor}`);
    lines.push(`   - 난방방식: ${apt.heating}`);
    lines.push(`   - 총주차대수: ${apt.totalParking} (지상: ${apt.groundParking}, 지하: ${apt.undergroundParking})`);
    lines.push(`   - 시공사: ${apt.builder}`);
    lines.push(`   - 시행사: ${apt.developer}`);
    lines.push(`   - 주소: ${apt.address}`);
    if (apt.evCharging !== '-' && apt.evCharging !== '') {
      lines.push(`   - 전기차충전시설: ${apt.evCharging}`);
    }
    lines.push('');
  });

  // columns 파라미터 사용 (경고 제거)
  console.log('사용 가능한 컬럼:', columns.length, '개');

  return lines.join('\n');
}
