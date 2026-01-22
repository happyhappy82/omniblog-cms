import React, { useState } from 'react';
import { ProductInfo } from '../types';
import { Icon } from './Icon';

interface ProductInfoManagerProps {
  onAddToContext: (text: string) => void;
}

export const ProductInfoManager: React.FC<ProductInfoManagerProps> = ({ onAddToContext }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [currentProduct, setCurrentProduct] = useState<ProductInfo>({
    id: '',
    name: '',
    price: '',
    coupangLink: '',
    specs: '',
    features: ''
  });

  const handleAddProduct = () => {
    if (!currentProduct.name.trim()) {
      alert('제품명을 입력해주세요.');
      return;
    }

    const newProduct: ProductInfo = {
      ...currentProduct,
      id: crypto.randomUUID()
    };

    setProducts([...products, newProduct]);

    // 폼 초기화
    setCurrentProduct({
      id: '',
      name: '',
      price: '',
      coupangLink: '',
      specs: '',
      features: ''
    });
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newProducts = [...products];
    [newProducts[index - 1], newProducts[index]] = [newProducts[index], newProducts[index - 1]];
    setProducts(newProducts);
  };

  const handleMoveDown = (index: number) => {
    if (index === products.length - 1) return;
    const newProducts = [...products];
    [newProducts[index], newProducts[index + 1]] = [newProducts[index + 1], newProducts[index]];
    setProducts(newProducts);
  };

  const handleAddToContext = () => {
    if (products.length === 0) {
      alert('추가할 제품이 없습니다.');
      return;
    }

    // 구조화된 포맷으로 변환
    let formattedText = `# 제품 추천 TOP ${products.length}\n\n`;

    products.forEach((product, index) => {
      formattedText += `## ${index + 1}. ${product.name}\n`;
      if (product.price) formattedText += `- 가격: ${product.price}\n`;
      if (product.coupangLink) formattedText += `- 쿠팡 링크: ${product.coupangLink}\n`;
      if (product.specs) formattedText += `- 주요 스펙: ${product.specs}\n`;
      if (product.features) formattedText += `- 특징: ${product.features}\n`;
      formattedText += '\n';
    });

    onAddToContext(formattedText);
    setProducts([]);
    setIsOpen(false);
    alert('제품 정보가 Context에 추가되었습니다!');
  };

  return (
    <>
      {/* 버튼 */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-bold hover:from-blue-600 hover:to-purple-600 transition-all flex items-center justify-center gap-2 shadow-lg"
      >
        <Icon name="Package" size={18} />
        💻 제품 정보 추가
      </button>
      <p className="text-xs text-slate-400 mt-2 text-center">
        💡 여러 제품을 추가하고 Context에 구조화된 형식으로 삽입합니다
      </p>

      {/* 다이얼로그 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1C2128] border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#161B22]">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Icon name="Package" size={18} className="text-blue-500" />
                제품 정보 관리자
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* 왼쪽: 입력 폼 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white mb-3">제품 정보 입력</h3>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">제품명 *</label>
                    <input
                      type="text"
                      value={currentProduct.name}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                      placeholder="예: LG 그램 17인치 (2024년형)"
                      className="w-full bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">가격</label>
                    <input
                      type="text"
                      value={currentProduct.price}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, price: e.target.value })}
                      placeholder="예: 2,190,000원"
                      className="w-full bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">쿠팡 링크</label>
                    <input
                      type="text"
                      value={currentProduct.coupangLink}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, coupangLink: e.target.value })}
                      placeholder="https://coupa.ng/xxxxx"
                      className="w-full bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">주요 스펙</label>
                    <textarea
                      value={currentProduct.specs}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, specs: e.target.value })}
                      placeholder="예: Intel i7-13세대, 32GB RAM, 1TB SSD, 17인치"
                      className="w-full h-20 bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">특징/장점</label>
                    <textarea
                      value={currentProduct.features}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, features: e.target.value })}
                      placeholder="예: 초경량 1.35kg, 배터리 20시간"
                      className="w-full h-20 bg-[#0D1117] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none resize-none"
                    />
                  </div>

                  <button
                    onClick={handleAddProduct}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Icon name="Plus" size={16} />
                    리스트에 추가
                  </button>
                </div>

                {/* 오른쪽: 제품 리스트 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white">
                      제품 리스트 ({products.length})
                    </h3>
                    {products.length > 0 && (
                      <button
                        onClick={() => setProducts([])}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        전체 삭제
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {products.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Icon name="Package" size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">추가된 제품이 없습니다</p>
                      </div>
                    ) : (
                      products.map((product, index) => (
                        <div
                          key={product.id}
                          className="bg-[#0D1117] border border-slate-700 rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-blue-400">#{index + 1}</span>
                                <h4 className="text-sm font-bold text-white">{product.name}</h4>
                              </div>
                              {product.price && (
                                <p className="text-xs text-slate-400">💰 {product.price}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleMoveUp(index)}
                                disabled={index === 0}
                                className="p-1 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Icon name="ChevronUp" size={16} />
                              </button>
                              <button
                                onClick={() => handleMoveDown(index)}
                                disabled={index === products.length - 1}
                                className="p-1 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Icon name="ChevronDown" size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                className="p-1 text-red-400 hover:text-red-300"
                              >
                                <Icon name="Trash2" size={16} />
                              </button>
                            </div>
                          </div>
                          {product.specs && (
                            <p className="text-xs text-slate-500 line-clamp-1">🔧 {product.specs}</p>
                          )}
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
                {products.length}개의 제품이 추가되었습니다
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleAddToContext}
                  disabled={products.length === 0}
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-all"
                >
                  Context에 추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
