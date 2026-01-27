import { NotionGamingLaptop, ProductGroup } from '../types';

const GROUP_SIZE = 5;

/**
 * GPU별 그룹핑 (RTX 4060, RTX 5060 등)
 */
export function groupByGPU(products: NotionGamingLaptop[]): ProductGroup[] {
  // GPU 키워드 추출을 위한 패턴
  const gpuPatterns: { pattern: RegExp; name: string }[] = [
    { pattern: /RTX\s*5090/i, name: 'RTX 5090' },
    { pattern: /RTX\s*5080/i, name: 'RTX 5080' },
    { pattern: /RTX\s*5070(\s*Ti)?/i, name: 'RTX 5070' },
    { pattern: /RTX\s*5060(\s*Ti)?/i, name: 'RTX 5060' },
    { pattern: /RTX\s*4090/i, name: 'RTX 4090' },
    { pattern: /RTX\s*4080/i, name: 'RTX 4080' },
    { pattern: /RTX\s*4070(\s*Ti)?/i, name: 'RTX 4070' },
    { pattern: /RTX\s*4060(\s*Ti)?/i, name: 'RTX 4060' },
    { pattern: /RTX\s*4050/i, name: 'RTX 4050' },
    { pattern: /RTX\s*3080/i, name: 'RTX 3080' },
    { pattern: /RTX\s*3070(\s*Ti)?/i, name: 'RTX 3070' },
    { pattern: /RTX\s*3060(\s*Ti)?/i, name: 'RTX 3060' },
    { pattern: /RTX\s*3050(\s*Ti)?/i, name: 'RTX 3050' },
    { pattern: /GTX\s*1660(\s*Ti)?/i, name: 'GTX 1660' },
    { pattern: /GTX\s*1650(\s*Ti)?/i, name: 'GTX 1650' },
    { pattern: /Intel\s*(Arc|Iris)/i, name: 'Intel Graphics' },
    { pattern: /AMD\s*Radeon/i, name: 'AMD Radeon' },
  ];

  // 제품별 GPU 분류
  const gpuMap = new Map<string, NotionGamingLaptop[]>();

  products.forEach(product => {
    const graphics = product.graphics || '';
    let gpuName = '기타';

    for (const { pattern, name } of gpuPatterns) {
      if (pattern.test(graphics)) {
        gpuName = name;
        break;
      }
    }

    if (!gpuMap.has(gpuName)) {
      gpuMap.set(gpuName, []);
    }
    gpuMap.get(gpuName)!.push(product);
  });

  return createGroupsFromMap(gpuMap, 'gpu', (gpuName) => `${gpuName} 게이밍 노트북 추천 TOP${GROUP_SIZE}`);
}

/**
 * 가격대별 그룹핑 (100만원대, 150만원대 등)
 */
export function groupByPriceRange(products: NotionGamingLaptop[]): ProductGroup[] {
  const priceRanges: { min: number; max: number; name: string }[] = [
    { min: 0, max: 1000000, name: '100만원 미만' },
    { min: 1000000, max: 1500000, name: '100만원대' },
    { min: 1500000, max: 2000000, name: '150만원대' },
    { min: 2000000, max: 2500000, name: '200만원대' },
    { min: 2500000, max: 3000000, name: '250만원대' },
    { min: 3000000, max: 4000000, name: '300만원대' },
    { min: 4000000, max: 5000000, name: '400만원대' },
    { min: 5000000, max: Infinity, name: '500만원 이상' },
  ];

  const priceMap = new Map<string, NotionGamingLaptop[]>();

  products.forEach(product => {
    const price = parsePrice(product.price);
    let rangeName = '기타';

    for (const range of priceRanges) {
      if (price >= range.min && price < range.max) {
        rangeName = range.name;
        break;
      }
    }

    if (!priceMap.has(rangeName)) {
      priceMap.set(rangeName, []);
    }
    priceMap.get(rangeName)!.push(product);
  });

  return createGroupsFromMap(priceMap, 'price', (rangeName) => `${rangeName} 게이밍 노트북 추천 TOP${GROUP_SIZE}`);
}

/**
 * 브랜드별 그룹핑 (ASUS, Lenovo, HP 등)
 */
export function groupByBrand(products: NotionGamingLaptop[]): ProductGroup[] {
  const brandPatterns: { pattern: RegExp; name: string }[] = [
    { pattern: /ASUS|에이수스|ROG/i, name: 'ASUS' },
    { pattern: /Lenovo|레노버|Legion/i, name: 'Lenovo' },
    { pattern: /HP|휴렛|Omen|Victus/i, name: 'HP' },
    { pattern: /Dell|델|Alienware|에일리언웨어/i, name: 'Dell' },
    { pattern: /MSI|엠에스아이/i, name: 'MSI' },
    { pattern: /Acer|에이서|Predator|Nitro/i, name: 'Acer' },
    { pattern: /Razer|레이저/i, name: 'Razer' },
    { pattern: /Gigabyte|기가바이트|AORUS/i, name: 'Gigabyte' },
    { pattern: /Samsung|삼성|갤럭시북/i, name: 'Samsung' },
    { pattern: /LG|엘지|그램/i, name: 'LG' },
    { pattern: /한성/i, name: '한성컴퓨터' },
  ];

  const brandMap = new Map<string, NotionGamingLaptop[]>();

  products.forEach(product => {
    const name = product.name || '';
    let brandName = '기타 브랜드';

    for (const { pattern, name: brand } of brandPatterns) {
      if (pattern.test(name)) {
        brandName = brand;
        break;
      }
    }

    if (!brandMap.has(brandName)) {
      brandMap.set(brandName, []);
    }
    brandMap.get(brandName)!.push(product);
  });

  return createGroupsFromMap(brandMap, 'brand', (brandName) => `${brandName} 게이밍 노트북 추천 TOP${GROUP_SIZE}`);
}

/**
 * Map에서 ProductGroup[] 생성 (5개씩 그룹핑)
 */
function createGroupsFromMap(
  map: Map<string, NotionGamingLaptop[]>,
  groupType: ProductGroup['groupType'],
  nameFormatter: (key: string) => string
): ProductGroup[] {
  const groups: ProductGroup[] = [];

  map.forEach((products, key) => {
    // 가격순 정렬
    products.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));

    // GROUP_SIZE개씩 나누기
    for (let i = 0; i < products.length; i += GROUP_SIZE) {
      const chunk = products.slice(i, i + GROUP_SIZE);
      if (chunk.length > 0) {
        const groupIndex = Math.floor(i / GROUP_SIZE) + 1;
        const suffix = groupIndex > 1 ? ` (${groupIndex})` : '';

        groups.push({
          id: crypto.randomUUID(),
          name: nameFormatter(key) + suffix,
          groupType,
          products: chunk.map((p, idx) => ({ ...p, order: idx + 1 })),
        });
      }
    }
  });

  return groups;
}

/**
 * 가격 문자열을 숫자로 파싱
 */
function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  // 숫자만 추출 (쉼표, 원, 공백 등 제거)
  const numStr = priceStr.replace(/[^0-9]/g, '');
  return parseInt(numStr, 10) || 0;
}

/**
 * 5개 제품 정보를 블로그 Context 형식으로 포맷
 * - fullContent가 있으면 전체 페이지 내용 사용 (마크다운 형식)
 * - 없으면 기본 정보만 출력
 */
export function formatGroupContext(group: ProductGroup): string {
  let context = `# ${group.name}\n\n`;
  context += `그룹 유형: ${getGroupTypeLabel(group.groupType)}\n`;
  context += `제품 수: ${group.products.length}개\n\n`;
  context += `---\n\n`;

  group.products.forEach((product, index) => {
    context += `## 📦 ${index + 1}위: ${product.name}\n\n`;

    // 기본 정보
    context += `**기본 정보**\n`;
    if (product.price) context += `- 💰 가격: ${product.price}\n`;
    if (product.coupangLink) context += `- 🔗 쿠팡 링크: ${product.coupangLink}\n`;
    if (product.rocketDelivery) context += `- 🚀 로켓배송: 지원\n`;
    context += '\n';

    // 전체 페이지 내용 (fullContent)이 있으면 출력
    if (product.fullContent && product.fullContent.trim()) {
      context += `**상세 정보 (노션 페이지 전체 내용)**\n\n`;
      context += product.fullContent;
      context += '\n\n';
    }

    context += `---\n\n`;
  });

  return context;
}

function getGroupTypeLabel(type: ProductGroup['groupType']): string {
  switch (type) {
    case 'gpu': return 'GPU별';
    case 'price': return '가격대별';
    case 'brand': return '브랜드별';
    default: return type;
  }
}
