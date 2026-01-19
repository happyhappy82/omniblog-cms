import React, { useState } from 'react';
import { Icon } from './Icon';

interface Restaurant {
  title: string;
  link: string; // Naver: URL, Google: place_id
  address: string;
  category: string;
  rating?: string;
}

interface RestaurantSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRestaurant: (restaurantInfo: string) => void;
}

type SearchProvider = 'naver' | 'google';

export const RestaurantSearchDialog: React.FC<RestaurantSearchDialogProps> = ({
  isOpen,
  onClose,
  onSelectRestaurant
}) => {
  const [searchProvider, setSearchProvider] = useState<SearchProvider>('naver');
  const [searchQuery, setSearchQuery] = useState('');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert('검색어를 입력해주세요.');
      return;
    }

    setIsSearching(true);
    setRestaurants([]);

    try {
      const apiEndpoint = searchProvider === 'naver'
        ? '/api/search-restaurant'
        : '/api/search-google-places';

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.error || '검색 실패';
        alert(`오류: ${errorMsg}`);
        return;
      }

      // Google API 응답을 Restaurant 형식으로 변환
      const results = searchProvider === 'google'
        ? data.results.map((place: any) => ({
            title: place.title,
            link: place.placeId, // Google은 placeId 사용
            address: place.address,
            category: place.category,
            rating: place.rating
          }))
        : data.results;

      setRestaurants(results || []);
    } catch (error) {
      console.error('Search error:', error);
      alert('검색 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFetchDetails = async (restaurant: Restaurant) => {
    // 링크/placeId가 없으면 경고
    if (!restaurant.link || restaurant.link.trim() === '') {
      alert('이 맛집은 정보가 없습니다. 다른 맛집을 선택해주세요.');
      return;
    }

    setSelectedRestaurant(restaurant);
    setIsFetchingDetails(true);

    try {
      let data;
      let linkUrl = '';

      if (searchProvider === 'naver') {
        // 네이버 API 호출
        const response = await fetch('/api/fetch-restaurant-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: restaurant.link })
        });
        data = await response.json();
        linkUrl = restaurant.link;

        if (!response.ok || !data.success) {
          const errorMsg = data.error || '정보 가져오기 실패';
          console.error('API Error:', errorMsg);
          alert(`오류: ${errorMsg}`);
          return;
        }
      } else {
        // 구글 API 호출
        const response = await fetch('/api/fetch-google-place-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeId: restaurant.link })
        });
        data = await response.json();

        if (!response.ok || !data.success) {
          const errorMsg = data.error || '정보 가져오기 실패';
          console.error('API Error:', errorMsg);
          alert(`오류: ${errorMsg}`);
          return;
        }

        linkUrl = data.googleMapsUrl || '';
      }

      // 구조화된 정보 생성
      const platformName = searchProvider === 'naver' ? '네이버 플레이스' : '구글 지도';
      const restaurantInfo = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🍽️ 맛집 정보 (${platformName})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 가게명: ${data.name || restaurant.title}
🏠 주소: ${data.address || restaurant.address}
🏷️ 카테고리: ${data.category || restaurant.category}
📞 전화번호: ${data.phone || '정보 없음'}
${linkUrl ? `🔗 링크: ${linkUrl}` : ''}
⭐ 평점: ${data.rating || '정보 없음'}

📋 메뉴 및 가격:
${data.menu || '정보 없음'}

⏰ 영업시간:
${data.hours || '정보 없음'}
${data.website ? `\n🌐 웹사이트: ${data.website}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      onSelectRestaurant(restaurantInfo);
      onClose();
    } catch (error) {
      console.error('Fetch details error:', error);
      alert('상세 정보를 가져오는 중 오류가 발생했습니다.');
    } finally {
      setIsFetchingDetails(false);
      setSelectedRestaurant(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg w-[600px] max-h-[80vh] shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h3 className="text-white font-bold flex items-center gap-2 text-lg">
            <Icon name="Search" size={20} />
            맛집 검색
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Provider Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900/50">
          <button
            onClick={() => {
              setSearchProvider('naver');
              setRestaurants([]);
            }}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              searchProvider === 'naver'
                ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            네이버 플레이스
          </button>
          <button
            onClick={() => {
              setSearchProvider('google');
              setRestaurants([]);
            }}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              searchProvider === 'google'
                ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            구글 지도
          </button>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isSearching) {
                  handleSearch();
                }
              }}
              placeholder="예: 건대맛집, 홍대 떡볶이"
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-4 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-6 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors font-medium disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <Icon name="Loader2" size={16} className="animate-spin" />
                  검색 중...
                </>
              ) : (
                <>
                  <Icon name="Search" size={16} />
                  검색
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            💡 {searchProvider === 'naver' ? '네이버 플레이스' : '구글 지도'}에서 맛집을 검색합니다
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto p-6">
          {restaurants.length === 0 ? (
            <div className="text-center text-slate-500 py-12">
              <Icon name="Search" size={48} className="mx-auto mb-4 text-slate-600" />
              <p className="text-sm">검색 결과가 없습니다</p>
              <p className="text-xs mt-2">맛집 이름이나 지역을 검색해보세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {restaurants.map((restaurant, index) => (
                <div
                  key={index}
                  className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-cyan-500 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="text-white font-bold mb-1">{restaurant.title}</h4>
                      <p className="text-sm text-slate-400 mb-1">{restaurant.address}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-500">{restaurant.category}</p>
                        {restaurant.rating && (
                          <p className="text-xs text-yellow-400">⭐ {restaurant.rating}</p>
                        )}
                      </div>
                      {(!restaurant.link || restaurant.link.trim() === '') && (
                        <p className="text-xs text-red-400 mt-1">⚠️ 링크 없음</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleFetchDetails(restaurant)}
                      disabled={(isFetchingDetails && selectedRestaurant === restaurant) || !restaurant.link || restaurant.link.trim() === ''}
                      className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors text-sm font-medium disabled:bg-slate-600 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                    >
                      {isFetchingDetails && selectedRestaurant === restaurant ? (
                        <>
                          <Icon name="Loader2" size={14} className="animate-spin" />
                          가져오는 중...
                        </>
                      ) : (
                        <>
                          <Icon name="Download" size={14} />
                          정보 가져오기
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
