'use client';

import { Header } from '@/components/Header';
import { useState } from 'react';

interface PropertyDetail {
  id: string;
  title: string;
  location: string;
  transactionType: string;
  deposit: string;
  monthly: string;
  maintenanceFee: string;
  keyMoney: string;
  area: {
    supply: string;
    exclusive: string;
  };
  floor: {
    current: string;
    total: string;
  };
  propertyType: string;
  themes: string[];
  images: string[];
  description: string[];
  transportation: {
    subway: Array<{
      line: string;
      color: string;
      station: string;
      distance: string;
    }>;
    bus: Array<{
      number: string;
      stop: string;
      distance: string;
    }>;
  };
  facilities: {
    convenience: string[];
    safety: string[];
    education: string[];
  };
}

const mockProperty: PropertyDetail = {
  id: 'HM-2024-001',
  title: '헤르만 망원동 역세권 유동인구 많은 1층 상가',
  location: '서울 마포구 망원동',
  transactionType: '월세',
  deposit: '2,500만원',
  monthly: '120만원',
  maintenanceFee: '90,000원',
  keyMoney: '협의가능',
  area: {
    supply: '40㎡',
    exclusive: '34.4㎡'
  },
  floor: {
    current: '1층(지하)',
    total: '4층'
  },
  propertyType: '상가',
  themes: ['휴게음식점', '미용관련업', '소매점'],
  images: [
    'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80',
    'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=200&q=80',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=200&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&q=80',
    'https://images.unsplash.com/photo-1534723452862-4c874956a9ba?w=200&q=80'
  ],
  description: [
    '망원동 중심 상권에 위치한 역세권 상가',
    '유동인구가 많아 상업적 잠재력이 높음',
    '1층 스트리트 상가로 가시성이 우수',
    '주변에 다양한 편의시설 및 주거단지 밀집',
    '교통이 편리한 입지 조건'
  ],
  transportation: {
    subway: [
      { line: '6호선', color: '#8B50A4', station: '망원역', distance: '350m' },
      { line: '2호선', color: '#00A84D', station: '홍대입구역', distance: '800m' }
    ],
    bus: [
      { number: '7016', stop: '망원역', distance: '200m' },
      { number: '7730', stop: '망원시장', distance: '150m' }
    ]
  },
  facilities: {
    convenience: ['망원시장', '카페거리', '편의점', '은행', '약국'],
    safety: ['경찰서', '소방서', '병원', '약국'],
    education: ['망원초등학교', '서울여상', '홍익대학교']
  }
};

const tabs = [
  { id: 'number', label: '매물번호' },
  { id: 'info', label: '매물 정보' },
  { id: 'description', label: '매물 설명' },
  { id: 'transport', label: '주변 교통정보' },
  { id: 'location', label: '위치 및 주변시설' },
  { id: 'others', label: '다른 매물' }
];

const facilityTabs = [
  { id: 'convenience', label: '편의시설' },
  { id: 'safety', label: '안전시설' },
  { id: 'education', label: '교육시설' }
];

const otherProperties = [
  {
    id: 'HM-2024-002',
    title: '망원동 스트리트 1층 상가',
    location: '서울 마포구 망원동',
    price: '보증금 1억 / 월세 80만원',
    image: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=400&q=80'
  },
  {
    id: 'HM-2024-003',
    title: '망원동 유동인구 상가',
    location: '서울 마포구 망원동',
    price: '보증금 1억 2천 / 월세 85만원',
    image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&q=80'
  },
  {
    id: 'HM-2024-004',
    title: '망원동 코너 상가',
    location: '서울 마포구 망원동',
    price: '보증금 9,500만원 / 월세 78만원',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=80'
  }
];

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('info');
  const [activeFacilityTab, setActiveFacilityTab] = useState('convenience');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % mockProperty.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + mockProperty.images.length) % mockProperty.images.length);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* 상단 탭 네비게이션 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-2 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-[#C8843A] border-b-2 border-[#C8843A]'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex space-x-2">
              <button className="p-2 text-gray-400 hover:text-gray-600">‹ 이전</button>
              <button className="p-2 text-gray-400 hover:text-gray-600">다음 ›</button>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* 좌측 본문 */}
          <div className="flex-1">
            {/* 이미지 캐러셀 */}
            <div className="mb-8">
              <div className="relative h-[480px] rounded-lg overflow-hidden mb-4">
                <img
                  src={mockProperty.images[currentImageIndex]}
                  alt={mockProperty.title}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition"
                >
                  ‹
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition"
                >
                  ›
                </button>
                <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                  {currentImageIndex + 1}/{mockProperty.images.length}
                </div>
              </div>
              <div className="flex space-x-2">
                {mockProperty.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition ${
                      index === currentImageIndex ? 'border-[#C8843A]' : 'border-gray-200'
                    }`}
                  >
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* 매물 정보 테이블 */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-6">매물 정보</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">주소</span>
                    <span className="font-medium">{mockProperty.location}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">거래유형</span>
                    <span className="font-medium">{mockProperty.transactionType}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">매물종류</span>
                    <span className="font-medium">{mockProperty.propertyType}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">보증금</span>
                    <span className="font-medium text-[#C8843A]">{mockProperty.deposit}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">월세</span>
                    <span className="font-medium text-[#C8843A]">{mockProperty.monthly}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">관리비</span>
                    <span className="font-medium">{mockProperty.maintenanceFee}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">권리금</span>
                    <span className="font-medium text-red-600">{mockProperty.keyMoney}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">면적(공급/전용)</span>
                    <span className="font-medium">{mockProperty.area.supply} / {mockProperty.area.exclusive}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">층수(현재/전체)</span>
                    <span className="font-medium">{mockProperty.floor.current} / {mockProperty.floor.total}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">방향</span>
                    <span className="font-medium">남향</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">주차</span>
                    <span className="font-medium">가능</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">엘리베이터</span>
                    <span className="font-medium">있음</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">입주가능일</span>
                    <span className="font-medium">즉시입주</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">사용승인일</span>
                    <span className="font-medium">1995년</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">테마종류</span>
                    <span className="font-medium">{mockProperty.themes.join(', ')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 매물 설명 섹션 */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-6">매물 설명</h2>
              <div className="space-y-3">
                {mockProperty.description.map((item, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <span className="text-green-500 text-lg">✓</span>
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 주변 교통정보 섹션 */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-6">주변 교통정보</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-3">인근 지하철</h3>
                  <div className="space-y-2">
                    {mockProperty.transportation.subway.map((subway, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <span
                          className="px-2 py-1 rounded text-white text-xs font-bold"
                          style={{ backgroundColor: subway.color }}
                        >
                          {subway.line}
                        </span>
                        <span className="text-gray-700">{subway.station}</span>
                        <span className="text-gray-500">{subway.distance}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">인근 버스</h3>
                  <div className="space-y-2">
                    {mockProperty.transportation.bus.map((bus, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold">
                          {bus.number}
                        </span>
                        <span className="text-gray-700">{bus.stop}</span>
                        <span className="text-gray-500">{bus.distance}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 위치 및 주변시설 섹션 */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-6">위치 및 주변시설</h2>
              <div className="bg-gray-100 h-[300px] rounded-lg mb-6 flex items-center justify-center">
                <span className="text-gray-500">카카오맵 위치 표시 영역</span>
              </div>
              <div className="flex space-x-4 mb-4">
                {facilityTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFacilityTab(tab.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      activeFacilityTab === tab.id
                        ? 'bg-[#C8843A] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4">
                {mockProperty.facilities[activeFacilityTab as keyof typeof mockProperty.facilities].map((facility, index) => (
                  <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-400">🏢</span>
                    <span className="text-sm">{facility}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 다른 매물 섹션 */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-6">같은 구의 다른 매물</h2>
              <div className="flex space-x-4 overflow-x-auto">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="min-w-[300px] bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="h-48 bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500">매물 이미지</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold mb-2">망원동 상가 {item}</h3>
                      <p className="text-sm text-gray-600 mb-2">서울 마포구 망원동</p>
                      <p className="text-[#C8843A] font-bold">보증금 1억 / 월세 80만원</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 우측 고정 패널 */}
          <div className="w-[320px] sticky top-24 h-fit">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              {/* 추천 뱃지 */}
              <div className="flex items-center justify-between mb-4">
                <span className="bg-[#C8843A] text-white px-3 py-1 rounded-full text-sm font-bold">
                  추천
                </span>
                <span className="text-gray-500 text-sm">{mockProperty.id}</span>
              </div>

              {/* 제목 */}
              <h1 className="text-lg font-semibold mb-4 leading-tight">
                {mockProperty.title}
              </h1>

              {/* 가격 정보 */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">권리금</span>
                  <span className="text-red-600 font-bold">{mockProperty.keyMoney}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">보증금</span>
                  <span className="text-[#C8843A] font-bold">{mockProperty.deposit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">월세</span>
                  <span className="text-[#C8843A] font-bold">{mockProperty.monthly}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">관리비</span>
                  <span className="text-gray-500">{mockProperty.maintenanceFee}</span>
                </div>
              </div>

              {/* 위치 */}
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-gray-400">📍</span>
                <span className="text-sm">{mockProperty.location}</span>
              </div>

              {/* 면적 + 층수 */}
              <div className="space-y-2 mb-6">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">📐</span>
                  <span className="text-sm">면적 {mockProperty.area.exclusive}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">🏢</span>
                  <span className="text-sm">층수 {mockProperty.floor.current}</span>
                </div>
              </div>

              {/* 문의 버튼 */}
              <button className="w-full bg-[#C8843A] text-white py-3 rounded-lg font-semibold mb-4 hover:bg-[#A06828] transition">
                매물 문의하기
              </button>

              {/* 아이콘 버튼들 */}
              <div className="flex justify-center space-x-4 mb-6">
                <button className="p-2 text-gray-400 hover:text-red-500 transition">♡</button>
                <button className="p-2 text-gray-400 hover:text-gray-600 transition">🖨</button>
                <button className="p-2 text-gray-400 hover:text-blue-500 transition">📤</button>
                <button className="p-2 text-gray-400 hover:text-gray-600 transition">🔗</button>
              </div>

              <hr className="mb-6" />

              {/* 공인중개사 정보 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-gray-500">👤</span>
                </div>
                <h3 className="font-semibold mb-1">김헤르만</h3>
                <p className="text-sm text-gray-600 mb-3">(대표공인중개사)</p>
                <div className="space-y-1 text-sm text-gray-600 mb-4">
                  <p>📞 02-123-4567</p>
                  <p>📱 010-1234-5678</p>
                </div>
                <button className="w-full bg-yellow-400 text-black py-2 rounded-lg font-semibold hover:bg-yellow-500 transition mb-4">
                  카카오톡 문의
                </button>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>헤르만부동산</p>
                  <p>대표자: 김헤르만</p>
                  <p>서울 마포구 망원동 123-45</p>
                  <p>등록번호: 123-456-789012</p>
                  <p>대표번호: 02-123-4567</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}