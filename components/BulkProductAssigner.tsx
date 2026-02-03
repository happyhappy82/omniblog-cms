import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Draft, NotionGamingLaptop, ProductInfo } from '../types';
import { CONFIG } from '../config';

const API_BASE = 'http://localhost:4000';

type ProductCategory = 'notebook' | 'monitor' | 'washer' | 'refrigerator';

const CATEGORY_CONFIG: { id: ProductCategory; label: string; icon: string }[] = [
  { id: 'notebook', label: '노트북', icon: 'Laptop' },
  { id: 'monitor', label: '모니터', icon: 'Monitor' },
  { id: 'washer', label: '세탁기', icon: 'WashingMachine' },
  { id: 'refrigerator', label: '냉장고', icon: 'Refrigerator' },
];

interface BulkProductAssignerProps {
  isOpen: boolean;
  onClose: () => void;
  drafts: Draft[];
  onAssignComplete: (updatedDrafts: Draft[]) => void;
}

interface ProductListItem {
  id: string;
  name: string;
  price: string;
  priceNumber: number;
  coupangLink: string;
  order: number;
  rocketDelivery: boolean;
}

type FilterType = 'all' | 'price_above' | 'price_below' | 'price_range';

export const BulkProductAssigner: React.FC<BulkProductAssignerProps> = ({
  isOpen,
  onClose,
  drafts,
  onAssignComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 카테고리 탭
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('notebook');

  // 제품 목록
  const [allProducts, setAllProducts] = useState<ProductListItem[]>([]);

  // 필터 조건
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [priceMin, setPriceMin] = useState<number>(0);
  const [priceMax, setPriceMax] = useState<number>(5000000);
  const [productsPerDraft, setProductsPerDraft] = useState<number>(5);

  // 할당 진행 상태
  const [assignProgress, setAssignProgress] = useState({ current: 0, total: 0 });

  // 모달 열릴 때 제품 목록 가져오기
  useEffect(() => {
    if (isOpen) {
      fetchProductList(activeCategory);
    }
  }, [isOpen]);

  // 카테고리 변경 핸들러
  const handleCategoryChange = (category: ProductCategory) => {
    if (category === activeCategory) return;
    setActiveCategory(category);
    setFilterType('all');
    setPriceMin(0);
    setPriceMax(5000000);
    fetchProductList(category);
  };

  // 가격 문자열을 숫자로 변환
  const parsePrice = (priceStr: string): number => {
    if (!priceStr) return 0;
    const numStr = priceStr.replace(/[^0-9]/g, '');
    return parseInt(numStr, 10) || 0;
  };

  // 제품 목록 가져오기
  const fetchProductList = async (category: ProductCategory) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/notion/products?category=${category}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '제품 목록을 가져올 수 없습니다');
      }

      const productsWithPrice: ProductListItem[] = data.products.map((p: any) => ({
        ...p,
        priceNumber: parsePrice(p.price),
      }));

      setAllProducts(productsWithPrice);
    } catch (err: any) {
      setError(err.message || '서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 필터 적용된 제품 목록
  const getFilteredProducts = (): ProductListItem[] => {
    return allProducts.filter(p => {
      switch (filterType) {
        case 'price_above':
          return p.priceNumber >= priceMin;
        case 'price_below':
          return p.priceNumber <= priceMax;
        case 'price_range':
          return p.priceNumber >= priceMin && p.priceNumber <= priceMax;
        default:
          return true;
      }
    });
  };

  // 배열에서 랜덤하게 n개 선택 (Fisher-Yates shuffle)
  const getRandomItems = <T,>(array: T[], n: number): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, n);
  };

  // 제품 상세 정보 가져오기
  const fetchProductDetails = async (productIds: string[]): Promise<NotionGamingLaptop[]> => {
    const response = await fetch(`${API_BASE}/api/notion/products/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error);
    }

    return data.products.map((p: any, idx: number) => ({
      id: p.id,
      name: p.name || '',
      price: p.price || '',
      coupangLink: p.coupangLink || '',
      order: p.order || idx + 1,
      rocketDelivery: p.rocketDelivery || false,
      fullContent: p.fullContent || '',
    }));
  };

  // 제품 정보를 Context 형식으로 포맷팅
  const formatProductsToContext = (products: NotionGamingLaptop[], draftTitle: string): string => {
    let context = `# ${draftTitle}\n\n`;
    context += `총 ${products.length}개 제품 비교\n\n`;
    context += `---\n\n`;

    products.forEach((product, index) => {
      context += `## ${index + 1}위: ${product.name}\n\n`;
      context += `**기본 정보**\n`;
      if (product.price) context += `- 가격: ${product.price}\n`;
      if (product.coupangLink) context += `- 쿠팡 링크: ${product.coupangLink}\n`;
      if (product.rocketDelivery) context += `- 로켓배송: 지원\n`;
      context += '\n';

      if (product.fullContent && product.fullContent.trim()) {
        context += `**상세 정보**\n\n`;
        context += product.fullContent;
        context += '\n\n';
      }

      context += `---\n\n`;
    });

    return context;
  };

  // 일괄 할당 실행
  const handleBulkAssign = async () => {
    const filteredProducts = getFilteredProducts();

    if (filteredProducts.length < productsPerDraft) {
      setError(`필터 조건에 맞는 제품이 ${filteredProducts.length}개뿐입니다. 최소 ${productsPerDraft}개가 필요합니다.`);
      return;
    }

    // 제품이 없는 Draft만 대상
    const targetDrafts = drafts.filter(d => !d.products || d.products.length === 0);

    if (targetDrafts.length === 0) {
      setError('제품을 할당할 Draft가 없습니다. (이미 모든 Draft에 제품이 있습니다)');
      return;
    }

    setAssigning(true);
    setAssignProgress({ current: 0, total: targetDrafts.length });
    setError(null);

    const updatedDrafts: Draft[] = [...drafts];

    try {
      // 각 Draft에 랜덤 제품 할당
      for (let i = 0; i < targetDrafts.length; i++) {
        const draft = targetDrafts[i];
        setAssignProgress({ current: i + 1, total: targetDrafts.length });

        // 랜덤 제품 선택
        const randomProducts = getRandomItems(filteredProducts, productsPerDraft);
        const productIds = randomProducts.map(p => p.id);

        // 상세 정보 가져오기
        const detailedProducts = await fetchProductDetails(productIds);

        // Context 생성
        const context = formatProductsToContext(detailedProducts, draft.title);

        // ProductInfo 형식으로 변환
        const productInfos: ProductInfo[] = detailedProducts.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          coupangLink: p.coupangLink,
          specs: '',
          features: '',
          createdAt: Date.now(),
        }));

        // Draft 업데이트
        const draftIndex = updatedDrafts.findIndex(d => d.id === draft.id);
        if (draftIndex !== -1) {
          updatedDrafts[draftIndex] = {
            ...updatedDrafts[draftIndex],
            context,
            products: productInfos,
            lastModified: Date.now(),
          };
        }

        // API 부하 방지를 위한 약간의 딜레이
        await new Promise(resolve => setTimeout(resolve, CONFIG.PRODUCT.FETCH_DELAY_MS));
      }

      onAssignComplete(updatedDrafts);
      onClose();
      alert(`${targetDrafts.length}개 Draft에 제품이 할당되었습니다.`);
    } catch (err: any) {
      setError(err.message || '할당 중 오류가 발생했습니다.');
    } finally {
      setAssigning(false);
    }
  };

  const filteredCount = getFilteredProducts().length;
  const targetDraftCount = drafts.filter(d => !d.products || d.products.length === 0).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1C2128] border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#161B22]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Icon name="Shuffle" size={18} className="text-[#0EA5E9]" />
            일괄 제품 할당
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* 카테고리 탭 */}
        <div className="flex border-b border-slate-800">
          {CATEGORY_CONFIG.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 ${
                activeCategory === cat.id
                  ? 'text-[#0EA5E9] border-[#0EA5E9] bg-[#0EA5E9]/5'
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <Icon name={cat.icon} size={16} />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* 로딩 */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0EA5E9]"></div>
            </div>
          )}

          {/* 에러 */}
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!loading && (
            <>
              {/* 통계 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0D1117] rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{allProducts.length}</div>
                  <div className="text-xs text-slate-400">전체 제품</div>
                </div>
                <div className="bg-[#0D1117] rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-[#0EA5E9]">{filteredCount}</div>
                  <div className="text-xs text-slate-400">필터 적용</div>
                </div>
                <div className="bg-[#0D1117] rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{targetDraftCount}</div>
                  <div className="text-xs text-slate-400">할당 대상</div>
                </div>
              </div>

              {/* 필터 조건 */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-300">필터 조건</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                      filterType === 'all'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/10 text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    전체 제품
                  </button>
                  <button
                    onClick={() => setFilterType('price_above')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                      filterType === 'price_above'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/10 text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    ~ 이상
                  </button>
                  <button
                    onClick={() => setFilterType('price_below')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                      filterType === 'price_below'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/10 text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    ~ 이하
                  </button>
                  <button
                    onClick={() => setFilterType('price_range')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                      filterType === 'price_range'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/10 text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    가격 범위
                  </button>
                </div>

                {/* 가격 입력 */}
                {filterType !== 'all' && (
                  <div className="flex items-center gap-3">
                    {(filterType === 'price_above' || filterType === 'price_range') && (
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">최소 가격</label>
                        <input
                          type="number"
                          value={priceMin}
                          onChange={(e) => setPriceMin(Number(e.target.value))}
                          step={100000}
                          className="w-full px-3 py-2 bg-[#0D1117] border border-slate-700 rounded-lg text-sm text-white"
                          placeholder="예: 2000000"
                        />
                      </div>
                    )}
                    {filterType === 'price_range' && (
                      <span className="text-slate-500 mt-5">~</span>
                    )}
                    {(filterType === 'price_below' || filterType === 'price_range') && (
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">최대 가격</label>
                        <input
                          type="number"
                          value={priceMax}
                          onChange={(e) => setPriceMax(Number(e.target.value))}
                          step={100000}
                          className="w-full px-3 py-2 bg-[#0D1117] border border-slate-700 rounded-lg text-sm text-white"
                          placeholder="예: 3000000"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Draft당 제품 수 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Draft당 제품 수</label>
                <div className="flex items-center gap-2">
                  {[3, 5, 7, 10].map(n => (
                    <button
                      key={n}
                      onClick={() => setProductsPerDraft(n)}
                      className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                        productsPerDraft === n
                          ? 'border-[#0EA5E9] bg-[#0EA5E9]/10 text-white'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {n}개
                    </button>
                  ))}
                </div>
              </div>

              {/* 미리보기 */}
              <div className="bg-[#0D1117] rounded-lg p-4 border border-slate-800">
                <h4 className="text-sm font-bold text-slate-300 mb-2">할당 미리보기</h4>
                <p className="text-sm text-slate-400">
                  {filteredCount >= productsPerDraft ? (
                    <>
                      <span className="text-green-400">{targetDraftCount}개</span> Draft에 각각{' '}
                      <span className="text-[#0EA5E9]">{productsPerDraft}개</span> 제품이 랜덤 할당됩니다.
                      <br />
                      <span className="text-xs text-slate-500">
                        (필터된 {filteredCount}개 제품 중에서 선택)
                      </span>
                    </>
                  ) : (
                    <span className="text-orange-400">
                      필터된 제품({filteredCount}개)이 부족합니다. 최소 {productsPerDraft}개 필요.
                    </span>
                  )}
                </p>
              </div>

              {/* 진행 상태 */}
              {assigning && (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0EA5E9]"></div>
                    <span className="text-sm text-blue-300">
                      할당 중... ({assignProgress.current}/{assignProgress.total})
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0EA5E9] transition-all duration-300"
                      style={{ width: `${(assignProgress.current / assignProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-[#161B22]">
          <button
            onClick={onClose}
            disabled={assigning}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleBulkAssign}
            disabled={loading || assigning || filteredCount < productsPerDraft || targetDraftCount === 0}
            className="px-6 py-2 bg-gradient-to-r from-[#0EA5E9] to-[#6366F1] text-white rounded-lg font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Icon name="Shuffle" size={16} />
            {targetDraftCount}개 Draft에 랜덤 할당
          </button>
        </div>
      </div>
    </div>
  );
};
