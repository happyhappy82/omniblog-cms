import React, { useState, useEffect } from 'react';
import { ProductInfo, NicheType } from '../types';
import { Icon } from './Icon';

interface ProductInfoManagerProps {
  nicheId: NicheType;
  currentProducts: ProductInfo[];
  onSaveProducts: (products: ProductInfo[]) => void;
}

const LIBRARY_KEY = 'omni_product_library';

export const ProductInfoManager: React.FC<ProductInfoManagerProps> = ({
  nicheId,
  currentProducts,
  onSaveProducts
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [library, setLibrary] = useState<ProductInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'name' | 'price'>('latest');
  const [editingProduct, setEditingProduct] = useState<ProductInfo | null>(null);

  // 제품 등록 폼 상태
  const [formData, setFormData] = useState<Omit<ProductInfo, 'id' | 'createdAt'>>({
    name: '',
    price: '',
    coupangLink: '',
    specs: '',
    features: ''
  });

  // 라이브러리 로드
  useEffect(() => {
    const stored = localStorage.getItem(LIBRARY_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const nicheLibrary = parsed[nicheId] || [];
        setLibrary(nicheLibrary);
      } catch (error) {
        console.error('Failed to load product library:', error);
      }
    }
  }, [nicheId, isOpen]);

  // 현재 Draft의 제품 ID를 선택 상태로 초기화
  useEffect(() => {
    if (isOpen) {
      const ids = new Set(currentProducts.map(p => p.id));
      setSelectedIds(ids);
    }
  }, [isOpen, currentProducts]);

  // 라이브러리 저장
  const saveLibrary = (updatedLibrary: ProductInfo[]) => {
    const stored = localStorage.getItem(LIBRARY_KEY);
    const allLibraries = stored ? JSON.parse(stored) : {};
    allLibraries[nicheId] = updatedLibrary;
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(allLibraries));
    setLibrary(updatedLibrary);
  };

  // 제품 추가
  const handleAddProduct = () => {
    if (!formData.name.trim()) {
      alert('제품명을 입력해주세요.');
      return;
    }

    const newProduct: ProductInfo = {
      ...formData,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    };

    const updatedLibrary = [newProduct, ...library];
    saveLibrary(updatedLibrary);

    // 폼 초기화
    setFormData({
      name: '',
      price: '',
      coupangLink: '',
      specs: '',
      features: ''
    });

    alert('제품이 라이브러리에 추가되었습니다!');
  };

  // 제품 수정 시작
  const handleStartEdit = (product: ProductInfo) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price,
      coupangLink: product.coupangLink,
      specs: product.specs,
      features: product.features
    });
  };

  // 제품 수정 저장
  const handleUpdateProduct = () => {
    if (!editingProduct || !formData.name.trim()) {
      alert('제품명을 입력해주세요.');
      return;
    }

    const updatedLibrary = library.map(p =>
      p.id === editingProduct.id
        ? { ...p, ...formData }
        : p
    );

    saveLibrary(updatedLibrary);
    setEditingProduct(null);
    setFormData({
      name: '',
      price: '',
      coupangLink: '',
      specs: '',
      features: ''
    });

    alert('제품이 수정되었습니다!');
  };

  // 제품 삭제
  const handleDeleteProduct = (id: string) => {
    if (!confirm('이 제품을 라이브러리에서 삭제하시겠습니까?')) return;

    const updatedLibrary = library.filter(p => p.id !== id);
    saveLibrary(updatedLibrary);

    // 선택 상태에서도 제거
    const newSelectedIds = new Set(selectedIds);
    newSelectedIds.delete(id);
    setSelectedIds(newSelectedIds);
  };

  // 제품 선택 토글
  const handleToggleSelect = (id: string) => {
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
    } else {
      newSelectedIds.add(id);
    }
    setSelectedIds(newSelectedIds);
  };

  // Draft에 적용
  const handleApplyToDraft = () => {
    const selectedProducts = library.filter(p => selectedIds.has(p.id));

    if (selectedProducts.length === 0) {
      alert('선택된 제품이 없습니다.');
      return;
    }

    onSaveProducts(selectedProducts);
    setIsOpen(false);
    alert(`${selectedProducts.length}개 제품이 현재 Draft에 적용되었습니다!`);
  };

  // 필터링 및 정렬
  const getFilteredAndSortedLibrary = () => {
    let filtered = library;

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.specs.toLowerCase().includes(query)
      );
    }

    // 정렬
    const sorted = [...filtered];
    if (sortBy === 'latest') {
      sorted.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'price') {
      sorted.sort((a, b) => {
        const priceA = parseInt(a.price.replace(/[^0-9]/g, '')) || 0;
        const priceB = parseInt(b.price.replace(/[^0-9]/g, '')) || 0;
        return priceB - priceA;
      });
    }

    return sorted;
  };

  const filteredLibrary = getFilteredAndSortedLibrary();

  return (
    <>
      {/* 버튼 */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-bold hover:from-blue-600 hover:to-purple-600 transition-all flex items-center justify-center gap-2 shadow-lg"
      >
        <Icon name="Package" size={18} />
        💻 제품 관리 ({currentProducts.length}개 선택됨)
      </button>
      <p className="text-xs text-slate-400 mt-2 text-center">
        💡 제품 라이브러리에서 선택하여 사용합니다
      </p>

      {/* 다이얼로그 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1C2128] border border-slate-700 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#161B22]">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Icon name="Package" size={18} className="text-blue-500" />
                  제품 라이브러리 관리
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  등록: {library.length}개 | 선택: {selectedIds.size}개
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-5 gap-6">
                {/* 왼쪽: 제품 등록/수정 폼 */}
                <div className="col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">
                      {editingProduct ? '제품 수정' : '새 제품 등록'}
                    </h3>
                    {editingProduct && (
                      <button
                        onClick={() => {
                          setEditingProduct(null);
                          setFormData({
                            name: '',
                            price: '',
                            coupangLink: '',
                            specs: '',
                            features: ''
                          });
                        }}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        취소
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">제품명 *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="예: LG 그램 17인치 (2024년형)"
                      className="w-full bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">가격</label>
                    <input
                      type="text"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="예: 2,190,000원"
                      className="w-full bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">쿠팡 링크</label>
                    <input
                      type="text"
                      value={formData.coupangLink}
                      onChange={(e) => setFormData({ ...formData, coupangLink: e.target.value })}
                      placeholder="https://coupa.ng/xxxxx"
                      className="w-full bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">주요 스펙</label>
                    <textarea
                      value={formData.specs}
                      onChange={(e) => setFormData({ ...formData, specs: e.target.value })}
                      placeholder="예: Intel i7-13세대, 32GB RAM, 1TB SSD, 17인치"
                      className="w-full h-20 bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">특징/장점</label>
                    <textarea
                      value={formData.features}
                      onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                      placeholder="예: 초경량 1.35kg, 배터리 20시간"
                      className="w-full h-20 bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none resize-none"
                    />
                  </div>

                  {editingProduct ? (
                    <button
                      onClick={handleUpdateProduct}
                      className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Icon name="Check" size={16} />
                      수정 완료
                    </button>
                  ) : (
                    <button
                      onClick={handleAddProduct}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Icon name="Plus" size={16} />
                      라이브러리에 추가
                    </button>
                  )}
                </div>

                {/* 오른쪽: 제품 라이브러리 목록 */}
                <div className="col-span-3 flex flex-col">
                  {/* 검색 및 정렬 */}
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 relative">
                      <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="제품명 또는 스펙 검색..."
                        className="w-full bg-[#0D1117] border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                    >
                      <option value="latest">최신순</option>
                      <option value="name">이름순</option>
                      <option value="price">가격순</option>
                    </select>
                  </div>

                  {/* 제품 목록 */}
                  <div className="flex-1 space-y-2 overflow-y-auto max-h-[550px]">
                    {filteredLibrary.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <Icon name="Package" size={48} className="mx-auto mb-3 opacity-50" />
                        <p className="text-sm">
                          {searchQuery ? '검색 결과가 없습니다' : '등록된 제품이 없습니다'}
                        </p>
                        <p className="text-xs mt-1">왼쪽 폼에서 제품을 추가해보세요</p>
                      </div>
                    ) : (
                      filteredLibrary.map((product) => (
                        <div
                          key={product.id}
                          className={`bg-[#0D1117] border rounded-lg p-3 transition-all ${
                            selectedIds.has(product.id)
                              ? 'border-blue-500 bg-blue-500/5'
                              : 'border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* 체크박스 */}
                            <input
                              type="checkbox"
                              checked={selectedIds.has(product.id)}
                              onChange={() => handleToggleSelect(product.id)}
                              className="mt-1 w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
                            />

                            {/* 제품 정보 */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-white mb-1 truncate">
                                {product.name}
                              </h4>
                              {product.price && (
                                <p className="text-xs text-green-400 mb-1">💰 {product.price}</p>
                              )}
                              {product.specs && (
                                <p className="text-xs text-slate-400 line-clamp-1">🔧 {product.specs}</p>
                              )}
                            </div>

                            {/* 액션 버튼 */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(product)}
                                className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
                                title="수정"
                              >
                                <Icon name="Edit" size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                                title="삭제"
                              >
                                <Icon name="Trash2" size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div className="px-6 py-4 bg-[#161B22] border-t border-slate-800 flex justify-between items-center">
              <p className="text-xs text-slate-500">
                {selectedIds.size}개 제품 선택됨
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleApplyToDraft}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-all"
                >
                  Draft에 적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
