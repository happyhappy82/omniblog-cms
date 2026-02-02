import React, { useState, useCallback, useEffect } from 'react';
import { Icon } from './Icon';
import { NotionGamingLaptop } from '../types';
import { CONFIG } from '../config';

const API_BASE = 'http://localhost:4000';
const MAX_PRODUCTS = CONFIG.PRODUCT.MAX_IMPORT;

interface NotionProductImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (products: NotionGamingLaptop[]) => void;
}

interface ProductListItem {
  id: string;
  name: string;
  price: string;
  coupangLink: string;
  order: number;
  rocketDelivery: boolean;
}

type PriceFilter = 'all' | 'range';

const parsePrice = (priceStr: string): number => {
  if (!priceStr) return 0;
  return parseInt(priceStr.replace(/[^0-9]/g, ''), 10) || 0;
};

export const NotionProductImporter: React.FC<NotionProductImporterProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 제품 목록
  const [productList, setProductList] = useState<ProductListItem[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // 가격 필터
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');

  // 모달 열릴 때 제품 목록 가져오기
  useEffect(() => {
    if (isOpen) {
      fetchProductList();
    }
  }, [isOpen]);

  const resetState = useCallback(() => {
    setLoading(false);
    setFetchingDetails(false);
    setError(null);
    setProductList([]);
    setSelectedProductIds(new Set());
    setSearchQuery('');
    setPriceFilter('all');
    setPriceMin('');
    setPriceMax('');
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  // 노션에서 제품 목록 가져오기
  const fetchProductList = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/notion/products`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '제품 목록을 가져올 수 없습니다');
      }

      // order 순으로 정렬
      const sorted = data.products.sort((a: ProductListItem, b: ProductListItem) => a.order - b.order);
      setProductList(sorted);
    } catch (err: any) {
      setError(err.message || '서버에 연결할 수 없습니다. npm run server를 실행했는지 확인하세요.');
    } finally {
      setLoading(false);
    }
  };

  // 제품 선택 토글
  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        // 최대 5개까지만 선택 가능
        if (newSet.size >= MAX_PRODUCTS) {
          return prev;
        }
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // 검색 + 가격 필터링
  const filteredProducts = productList.filter(p => {
    // 검색어 필터
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // 가격 범위 필터
    if (priceFilter === 'range') {
      const price = parsePrice(p.price);
      const min = priceMin ? parseInt(priceMin, 10) * 10000 : 0;
      const max = priceMax ? parseInt(priceMax, 10) * 10000 : Infinity;
      if (price < min || price > max) return false;
    }
    return true;
  });

  // 선택된 제품들의 상세 정보 가져와서 문맥에 저장
  const handleSaveToContext = async () => {
    const selectedIds = Array.from(selectedProductIds);

    if (selectedIds.length === 0) {
      setError('제품을 선택해주세요');
      return;
    }

    setFetchingDetails(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/notion/products/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedIds }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '상세 정보를 가져올 수 없습니다');
      }

      // NotionGamingLaptop 형식으로 변환
      const products: NotionGamingLaptop[] = data.products.map((p: any, idx: number) => ({
        id: p.id,
        name: p.name || '',
        price: p.price || '',
        coupangLink: p.coupangLink || '',
        order: p.order || idx + 1,
        rocketDelivery: p.rocketDelivery || false,
        fullContent: p.fullContent || '',
      }));

      onImportComplete(products);
      handleClose();
    } catch (err: any) {
      setError(err.message || '상세 정보를 가져오는 중 오류가 발생했습니다');
    } finally {
      setFetchingDetails(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1C2128] border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#161B22]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Icon name="Download" size={18} className="text-[#0EA5E9]" />
            노션에서 제품 가져오기
          </h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 로딩 상태 */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0EA5E9] mb-4"></div>
              <p className="text-slate-400">제품 목록을 불러오는 중...</p>
            </div>
          )}

          {/* 에러 상태 */}
          {error && !loading && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
              <p className="text-red-400 flex items-center gap-2">
                <Icon name="AlertCircle" size={16} />
                {error}
              </p>
              <button
                onClick={fetchProductList}
                className="mt-2 text-sm text-[#0EA5E9] hover:underline"
              >
                다시 시도
              </button>
            </div>
          )}

          {/* 제품 목록 */}
          {!loading && productList.length > 0 && (
            <div className="space-y-4">
              {/* 검색 및 통계 */}
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="제품명으로 검색..."
                    className="w-full pl-10 pr-4 py-2 bg-[#0D1117] border border-slate-700 rounded-lg text-sm text-white focus:border-[#0EA5E9] outline-none"
                  />
                </div>
                <div className="text-sm text-slate-400 whitespace-nowrap">
                  선택: <span className={`font-bold ${selectedProductIds.size >= MAX_PRODUCTS ? 'text-orange-400' : 'text-[#0EA5E9]'}`}>
                    {selectedProductIds.size}
                  </span> / {MAX_PRODUCTS}
                </div>
              </div>

              {/* 가격 필터 */}
              <div className="bg-[#161B22] border border-slate-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="Filter" size={14} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-300">가격 필터</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPriceFilter('all')}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                      priceFilter === 'all'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/10 text-white font-bold'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setPriceFilter('range')}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                      priceFilter === 'range'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/10 text-white font-bold'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    가격 범위
                  </button>
                  {priceFilter === 'range' && (
                    <div className="flex items-center gap-2 ml-2">
                      <input
                        type="number"
                        value={priceMin}
                        onChange={(e) => setPriceMin(e.target.value)}
                        placeholder="최소"
                        className="w-20 px-2 py-1.5 bg-[#0D1117] border border-slate-700 rounded-lg text-xs text-white focus:border-[#0EA5E9] outline-none text-center"
                      />
                      <span className="text-xs text-slate-500">~</span>
                      <input
                        type="number"
                        value={priceMax}
                        onChange={(e) => setPriceMax(e.target.value)}
                        placeholder="최대"
                        className="w-20 px-2 py-1.5 bg-[#0D1117] border border-slate-700 rounded-lg text-xs text-white focus:border-[#0EA5E9] outline-none text-center"
                      />
                      <span className="text-[10px] text-slate-500">만원</span>
                    </div>
                  )}
                </div>
                {priceFilter === 'range' && (
                  <div className="flex gap-1.5 mt-2">
                    {[
                      { label: '~50만', min: '', max: '50' },
                      { label: '50~100만', min: '50', max: '100' },
                      { label: '100~200만', min: '100', max: '200' },
                      { label: '200~300만', min: '200', max: '300' },
                      { label: '300만~', min: '300', max: '' },
                    ].map(preset => (
                      <button
                        key={preset.label}
                        onClick={() => { setPriceMin(preset.min); setPriceMax(preset.max); }}
                        className={`px-2 py-1 text-[10px] rounded border transition-all ${
                          priceMin === preset.min && priceMax === preset.max
                            ? 'border-green-600 bg-green-900/30 text-green-400'
                            : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 안내 메시지 */}
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg px-4 py-3">
                <p className="text-sm text-blue-300 flex items-center gap-2">
                  <Icon name="Info" size={16} />
                  최대 {MAX_PRODUCTS}개 제품을 선택하세요. 선택한 제품의 전체 상세 정보가 문맥에 저장됩니다.
                </p>
              </div>

              {/* 제품 목록 */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredProducts.map((product) => {
                  const isSelected = selectedProductIds.has(product.id);
                  const isDisabled = !isSelected && selectedProductIds.size >= MAX_PRODUCTS;

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isDisabled && toggleProductSelection(product.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#0EA5E9] bg-[#0EA5E9]/10'
                          : isDisabled
                          ? 'border-slate-800 bg-slate-900/50 opacity-50 cursor-not-allowed'
                          : 'border-slate-700 hover:border-slate-600 bg-[#0D1117]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'border-[#0EA5E9] bg-[#0EA5E9]'
                            : 'border-slate-600'
                        }`}>
                          {isSelected && (
                            <Icon name="Check" size={12} className="text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white truncate">{product.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            {product.price && (
                              <span className="text-xs text-green-400">{product.price}</span>
                            )}
                            {product.rocketDelivery && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded">
                                🚀 로켓배송
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#161B22]">
          <div className="text-sm text-slate-500">
            {filteredProducts.length !== productList.length
              ? `필터: ${filteredProducts.length}개 / 전체 ${productList.length}개`
              : `전체 ${productList.length}개 제품`
            }
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSaveToContext}
              disabled={selectedProductIds.size === 0 || fetchingDetails}
              className="px-6 py-2 bg-[#0EA5E9] text-white rounded-lg font-bold text-sm hover:bg-[#0284C7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {fetchingDetails ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  가져오는 중...
                </>
              ) : (
                <>
                  <Icon name="Save" size={16} />
                  문맥에 저장 ({selectedProductIds.size}개)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
