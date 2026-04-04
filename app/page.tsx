'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('상가');
  const [headerHeight, setHeaderHeight] = useState(200);

  useEffect(() => {
    const header = document.querySelector('header');
    if (header) {
      setHeaderHeight(header.offsetHeight);
    }
  }, []);

  const propertyTypes = [
    { id: '상가', name: '상가', eng: 'STORE', count: 1247, icon: '🏪', image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&q=80' },
    { id: '사무실', name: '사무실', eng: 'OFFICE', count: 892, icon: '🏢', image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=400&q=80' },
    { id: '원룸·투룸', name: '원룸·투룸', eng: '1·2 ROOM', count: 2156, icon: '🏠', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&q=80' },
    { id: '쓰리룸이상', name: '쓰리룸이상', eng: '3ROOM+', count: 1567, icon: '🏘', image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400&q=80' },
    { id: '아파트', name: '아파트', eng: 'APT', count: 1876, icon: '🏙', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&q=80' },
    { id: '건물매매', name: '건물매매', eng: 'BUILDING', count: 234, icon: '🏗', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&q=80' },
  ];

  const themeTypes = [
    { name: '인테리어 추천', desc: '인테리어 완성도 높은 매물', count: 234, image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80' },
    { name: '사옥형 및 통임대', desc: '사옥형 건물 및 통임대 매물', count: 89, image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&q=80' },
    { name: '주택형 사무실', desc: '주택을 개조한 사무실 매물', count: 156, image: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80' },
    { name: '지하 사무실', desc: '지하에 위치한 사무실 매물', count: 78, image: 'https://images.unsplash.com/photo-1600508774634-4e11d34730e2?w=400&q=80' },
    { name: '무권리 상가', desc: '권리금 없는 깔끔한 상가', count: 445, image: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=400&q=80' },
    { name: '지하 상가', desc: '지하에 위치한 상가 매물', count: 123, image: 'https://images.unsplash.com/photo-1567958451986-2de427a4a0be?w=400&q=80' },
    { name: '1층 상가', desc: '1층에 위치한 상가 매물', count: 678, image: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=400&q=80' },
    { name: '2층 이상 상가', desc: '2층 이상에 위치한 상가', count: 234, image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80' },
  ];

  const recentProperties = [
    {
      id: 'SG-2024-001',
      title: '강남역 1층 코너상가',
      location: '강남구 역삼동',
      area: '165㎡',
      type: '상가',
      floor: '1층',
      deposit: '5억',
      monthly: '500만원',
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400',
      badges: ['역세권', '코너상가']
    },
    {
      id: 'OF-2024-002',
      title: '선릉역 도보 3분 사무실',
      location: '강남구 삼성동',
      area: '120㎡',
      type: '사무실',
      floor: '5층',
      deposit: '2억 5천',
      monthly: '250만원',
      image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400',
      badges: ['역세권', '엘리베이터']
    },
    {
      id: 'ST-2024-003',
      title: '신촌역 원룸·투룸 풀옵션',
      location: '서대문구 창천동',
      area: '23㎡',
      type: '원룸·투룸',
      floor: '3층',
      deposit: '1천만원',
      monthly: '60만원',
      image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400',
      badges: ['풀옵션', '신축']
    },
    {
      id: 'TH-2024-005',
      title: '분당 쓰리룸 이상 넓은 집',
      location: '성남시 분당구',
      area: '120㎡',
      type: '쓰리룸이상',
      floor: '7층',
      deposit: '2억 5천',
      monthly: '120만원',
      image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400',
      badges: ['넓은 평수', '가족주택']
    },
  ];

  return (
    <main className="w-full text-[#1a1a1a] leading-7">

      {/* 히어로 배너 */}
      <section
        className="relative w-full min-h-[650px] overflow-hidden"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1600&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/65"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white px-8 flex flex-col items-center gap-8">
            <p className="text-[20px] font-semibold text-[#C8843A] tracking-[0.05em] m-0 p-0">
              상가·사무실 NO.1 전문 중개
            </p>
            <h1 className="text-[40px] md:text-[56px] lg:text-[64px] font-extrabold text-white m-0 p-0">헤르만부동산</h1>
            <p className="text-[18px] md:text-[22px] font-light text-[rgba(255,255,255,0.9)] tracking-[0.05em] m-0 p-0">공인중개사사무소</p>
            <div className="flex gap-4 justify-center mt-2">
              <button className="bg-[#C8843A] hover:bg-[#A06828] text-white px-8 py-[14px] rounded-lg text-[16px] font-semibold transition">
                매물 검색하기
              </button>
              <button className="border-2 border-white text-white hover:bg-white hover:text-[#C8843A] px-8 py-[14px] rounded-lg text-[16px] font-semibold transition">
                상담 신청하기
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 검색바 섹션 */}
      <section className="bg-white py-6 px-4 md:px-6">
        <div
          className="w-full max-w-sm md:max-w-md lg:max-w-lg mx-auto flex items-center"
          style={{
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div className="flex items-center justify-center pl-4 pr-2 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="원하는 지역명, 지하철역, 키워드를 입력해주세요"
            className="flex-1 px-3 py-4 text-[16px] text-gray-700 placeholder-gray-400 outline-none border-none bg-white"
          />
          <button
            className="px-8 py-4 text-white text-[18px] font-semibold whitespace-nowrap transition hover:opacity-90"
            style={{ backgroundColor: '#C8843A' }}
          >
            매물검색
          </button>
        </div>
      </section>

      {/* 3열 레이아웃: 좌측 사이드바 + 중앙 콘텐츠 + 우측 패널 */}
      <div className="flex items-start" style={{ width: 'calc(100% - 32px)', margin: '0 16px' }}>

        {/* 좌측 사이드바 220px - lg 이상에서만 표시 */}
        <aside
          className="hidden lg:block shrink-0 border border-gray-200 bg-white"
          style={{ minWidth: '220px', maxWidth: '220px', position: 'sticky', top: headerHeight, height: `calc(100vh - ${headerHeight}px)`, overflowY: 'auto', alignSelf: 'flex-start' }}
        >

          {/* 매물 종류 */}
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, padding: '10px 16px' }} className="bg-[#C8843A] text-white">
              매물 종류
            </div>
            <ul>
              {propertyTypes.map((type) => (
                <li key={type.id}>
                  <a
                    href="#"
                    className="flex items-center justify-between text-[#333] border-b border-gray-100 hover:text-[#C8843A] transition-colors"
                    style={{ fontSize: '16px', padding: '9px 16px' }}
                  >
                    <span>{type.name}</span>
                    <span className="text-gray-400 text-[11px]">›</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* 테마 종류 */}
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, padding: '10px 16px' }} className="bg-[#C8843A] text-white">
              테마 종류
            </div>
            <ul>
              {themeTypes.map((theme, index) => (
                <li key={index}>
                  <a
                    href="#"
                    className="flex items-center justify-between text-[#333] border-b border-gray-100 last:border-b-0 hover:text-[#C8843A] transition-colors"
                    style={{ fontSize: '16px', padding: '9px 16px' }}
                  >
                    <span>{theme.name}</span>
                    <span className="text-gray-400 text-[11px]">›</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* 중앙 콘텐츠 flex-1 */}
        <div className="flex-1 min-w-0 px-4">

          {/* 매물 종류 섹션 */}
          <section style={{ padding: '16px', backgroundColor: '#fff' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center', marginBottom: '24px', color: '#1a1a1a' }}>매물종류</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
              {propertyTypes.map((type) => (
                <div
                  key={type.id}
                  className="relative rounded-[4px] overflow-hidden cursor-pointer group"
                  style={{
                    height: '220px',
                    backgroundImage: `url('${type.image}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors"></div>
                  <div
                    className="absolute top-2 right-2 bg-[#C8843A] text-white font-bold rounded-full flex items-center justify-center"
                    style={{ fontSize: '11px', width: '28px', height: '28px' }}
                  >
                    {type.count.toLocaleString()}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <p style={{ fontSize: '12px', opacity: 0.8, marginBottom: '2px' }}>{type.eng}</p>
                    <h3 style={{ fontSize: '24px', fontWeight: 700 }}>{type.name}</h3>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 테마 종류 섹션 */}
          <section style={{ padding: '16px', backgroundColor: '#f9f9f9' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center', marginBottom: '24px', color: '#1a1a1a' }}>다양한 조건별 매물 검색</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {themeTypes.map((theme, index) => (
                <div
                  key={index}
                  className="relative rounded-[4px] overflow-hidden cursor-pointer group"
                  style={{
                    height: '280px',
                    backgroundImage: `url('${theme.image}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="absolute inset-0 bg-black/45 group-hover:bg-black/30 transition-colors"></div>
                  <div
                    className="absolute top-2 right-2 bg-[#C8843A] text-white font-bold rounded-full flex items-center justify-center"
                    style={{ fontSize: '11px', width: '28px', height: '28px' }}
                  >
                    {theme.count}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '2px' }}>{theme.name}</h3>
                    <p style={{ fontSize: '13px', opacity: 0.85 }}>{theme.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 최신매물 섹션 */}
          <section style={{ padding: '16px', backgroundColor: '#fff' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center', marginBottom: '24px', color: '#1a1a1a' }}>최신매물</h2>

            {/* 탭 */}
            <div className="flex justify-center" style={{ marginBottom: '16px' }}>
              <div className="flex border rounded-lg overflow-hidden overflow-x-auto max-w-full">
                {['상가', '사무실', '원룸·투룸', '쓰리룸이상', '아파트', '건물매매'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`border-r last:border-r-0 transition-colors ${
                      activeTab === tab
                        ? 'bg-[#C8843A] text-white border-[#C8843A]'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    style={{ fontSize: '16px', padding: '6px 16px' }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* 매물 그리드 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {recentProperties.map((property) => (
                <div key={property.id} className="border border-gray-200 overflow-hidden" style={{ height: 'auto' }}>
                  <div className="bg-[#C8843A] text-white flex justify-between items-center" style={{ padding: '8px 12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{property.id}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600 }} className="truncate ml-2">{property.title}</span>
                  </div>
                  <div className="relative" style={{ height: '260px' }}>
                    <img src={property.image} alt={property.title} className="w-full h-full object-cover" />
                    <button className="absolute top-2 right-2 text-white text-xl hover:text-red-500 transition-colors">
                      ♡
                    </button>
                    <div className="absolute top-2 left-2 flex gap-1">
                      {property.badges.map((badge, index) => (
                        <span key={index} className="bg-[#C8843A] text-white rounded" style={{ fontSize: '11px', padding: '2px 6px' }}>
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-gray-500 mb-2" style={{ fontSize: '14px' }}>
                      <p>{property.location} · {property.area} · {property.type} · {property.floor}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="bg-green-100 text-green-800 rounded" style={{ fontSize: '14px', padding: '4px 10px' }}>보증금</span>
                        <span style={{ fontSize: '18px', fontWeight: 700 }}>{property.deposit}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="bg-green-100 text-green-800 rounded" style={{ fontSize: '14px', padding: '4px 10px' }}>월세</span>
                        <span style={{ fontSize: '18px', fontWeight: 700 }}>{property.monthly}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 더보기 버튼 */}
            <div className="text-center mt-6">
              <button className="border border-[#C8843A] text-[#C8843A] hover:bg-[#C8843A] hover:text-white rounded-lg font-semibold transition" style={{ fontSize: '15px', padding: '8px 24px' }}>
                매물 더보기 ∨
              </button>
            </div>
          </section>

        </div>

        {/* 우측 패널 260px - xl 이상에서만 표시 */}
        <aside
          className="hidden xl:block shrink-0 border border-gray-200 bg-white"
          style={{ minWidth: '260px', maxWidth: '260px', position: 'sticky', top: headerHeight, height: `calc(100vh - ${headerHeight}px)`, overflowY: 'auto', alignSelf: 'flex-start' }}
        >

          {/* 대표전화 헤더 */}
          <div className="bg-[#C8843A] text-white" style={{ padding: '8px 12px' }}>
            <p style={{ fontSize: '16px', fontWeight: 600 }}>대표전화 CALL CENTER</p>
          </div>

          <div style={{ padding: '16px' }}>
            <p style={{ fontSize: '26px', fontWeight: 700, color: '#C8843A', marginBottom: '4px' }}>010-8680-8151</p>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px', lineHeight: 1.6 }}>평일 10:00 - 19:00<br />토요일 10:00 - 19:00</p>

            <p style={{ fontSize: '16px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>상담 신청</p>

            <form className="space-y-2">
              <input
                type="text"
                placeholder="이름"
                className="w-full border border-gray-300 rounded focus:outline-none focus:border-[#C8843A]"
                style={{ fontSize: '15px', padding: '10px 12px' }}
              />
              <input
                type="tel"
                placeholder="연락처"
                className="w-full border border-gray-300 rounded focus:outline-none focus:border-[#C8843A]"
                style={{ fontSize: '15px', padding: '10px 12px' }}
              />
              <textarea
                placeholder="문의 내용"
                rows={4}
                className="w-full border border-gray-300 rounded focus:outline-none focus:border-[#C8843A] resize-none"
                style={{ fontSize: '15px', padding: '10px 12px' }}
              />
              <div className="flex items-start gap-2">
                <input type="checkbox" id="privacy-side" className="w-4 h-4 mt-0.5 shrink-0" />
                <label htmlFor="privacy-side" style={{ fontSize: '12px', color: '#666', lineHeight: '1.5' }}>
                  개인정보 수집 및 이용에 동의합니다.
                </label>
              </div>
              <button
                type="submit"
                className="w-full bg-[#C8843A] hover:bg-[#A06828] text-white rounded font-semibold transition"
                style={{ fontSize: '18px', padding: '12px' }}
              >
                상담 신청하기
              </button>
            </form>
          </div>
        </aside>

      </div>

      

      {/* 푸터 */}
      <footer className="bg-[#111111] text-white py-12 px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo.png" alt="헤르만부동산 로고" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                <h3 className="text-xl font-bold">헤르만부동산</h3>
              </div>
              <div className="text-[13px] text-gray-300" style={{ lineHeight: 1.8 }}>
                <p>상호: 헤르만공인중개사사무소</p>
                <p>대표자: 황정아</p>
                <p>주소: 경기도 부천시 신흥로 223 신중동역 랜드마크 푸르지오시티 101동 712호</p>
                <p>등록번호: 제41192-2024-00113호</p>
                <p>전화: 010-8680-8151</p>
                <p>이메일: hermann2024@naver.com</p>
              </div>
            </div>
            <div className="lg:text-right">
              <h4 className="text-lg font-bold mb-4">대표전화 CALL CENTER</h4>
              <p className="text-3xl font-bold text-[#C8843A]">010-8680-8151</p>
              <p className="text-[13px] text-gray-300 mt-2" style={{ lineHeight: 1.8 }}>평일 10:00 - 19:00 (토요일 10:00 - 19:00)</p>
            </div>
          </div>
          <div className="border-t border-gray-600 pt-6 text-center">
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-300 mb-4">
              <a href="#" className="hover:text-white transition">회사소개</a>
              <a href="#" className="hover:text-white transition">매물 의뢰하기</a>
              <a href="#" className="hover:text-white transition">부동산 소식</a>
              <a href="#" className="hover:text-white transition">질문과 답변</a>
              <a href="#" className="hover:text-white transition">공지사항</a>
            </div>
            <p className="text-xs text-gray-400">
              Powered by HERMANN © 2026 헤르만부동산. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
