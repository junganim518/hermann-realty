'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const formatAddress = (address: string) => {
  if (!address) return '';
  const match = address.match(/(.+동)/);
  return match ? match[1] : address;
};

const toPyeong = (sqm: number) => Math.round(sqm * 0.3025);

const formatPrice = (amount: number) => {
  if (!amount) return '-';
  const man = Math.floor(amount / 10000);
  return `${man.toLocaleString()}만원`;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState('상가');
  const [headerHeight, setHeaderHeight] = useState(200);
  const [heroIndex, setHeroIndex] = useState(0);

  const heroSlides = [
    {
      image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1600&q=80',
      sub: '상가 · 사무실 NO.1 전문 중개',
      title: '헤르만부동산',
      desc: '공인중개사사무소',
      body: '상가와 사무실 중개의 모든 것을 헤르만부동산이 책임집니다.\n고객의 이익을 최우선으로, 언제나 정직하게 임하겠습니다.',
    },
    {
      image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80',
      sub: '정직과 성실로 함께합니다',
      title: '믿을 수 있는 중개',
      desc: '헤르만부동산이 함께하겠습니다',
      body: '화려한 말보다 진심 어린 행동으로 증명합니다.\n헤르만부동산은 성실한 중개로 고객과 신뢰를 쌓아갑니다.',
    },
  ];

  const changeSlide = (next: number) => setHeroIndex(next);

  useEffect(() => {
    const header = document.querySelector('header');
    if (header) setHeaderHeight(header.offsetHeight);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((p) => (p + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchProperties() {
      const { data } = await supabase
        .from('properties')
        .select('*, property_images(*)')
        .eq('is_recommended', true)
        .limit(4);
      if (data && data.length > 0) {
        setRecentProperties(data.map((p: any) => ({
          id: p.property_number,
          title: p.title,
          location: p.address,
          area: p.supply_area,
          type: p.property_type,
          floor: p.current_floor,
          deposit: p.deposit,
          monthly: p.monthly_rent,
          image: p.property_images?.[0]?.image_url ?? 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400',
          badges: p.badges ?? [],
        })));
      }
    }
    fetchProperties();
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
    { name: '추천매물', desc: '헤르만 추천 베스트 매물', count: 234, image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&q=80' },
    { name: '사옥형 및 통임대', desc: '사옥형 건물 및 통임대 매물', count: 89, image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&q=80' },
    { name: '대형 상가', desc: '대형 상가 매물', count: 156, image: 'https://images.unsplash.com/photo-1519999482648-25049ddd37b1?w=400&q=80' },
    { name: '대형사무실', desc: '대형 사무실 매물', count: 78, image: 'https://images.unsplash.com/photo-1497366412874-3415097a27e7?w=400&q=80' },
    { name: '무권리 상가', desc: '권리금 없는 깔끔한 상가', count: 445, image: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=400&q=80' },
    { name: '프랜차이즈 양도양수', desc: '프랜차이즈 양도양수 매물', count: 123, image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80' },
    { name: '1층 상가', desc: '1층에 위치한 상가 매물', count: 678, image: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=400&q=80' },
    { name: '2층 이상 상가', desc: '2층 이상에 위치한 상가', count: 234, image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80' },
  ];

  const [recentProperties, setRecentProperties] = useState<any[]>([
    {
      id: 'SG-2024-001',
      title: '강남역 1층 코너상가',
      location: '강남구 역삼동',
      area: '165㎡',
      type: '상가',
      floor: '1층',
      deposit: 500000000,
      monthly: 5000000,
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
      deposit: 250000000,
      monthly: 2500000,
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
      deposit: 10000000,
      monthly: 600000,
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
      deposit: 250000000,
      monthly: 1200000,
      image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400',
      badges: ['넓은 평수', '가족주택']
    },
  ]);

  return (
    <main className="w-full text-[#1a1a1a] leading-7">

      {/* 히어로 배너 */}
      <section className="relative w-full min-h-[650px] overflow-hidden">

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .hero-text { animation: fadeIn 0.6s ease forwards; }
        `}</style>

        {/* 레이어 1: 배경 이미지 슬라이드 */}
        <div
          className="absolute inset-0"
          style={{
            display: 'flex',
            transform: `translateX(-${heroIndex * 100}%)`,
            transition: 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          {heroSlides.map((slide, i) => (
            <img
              key={i}
              src={slide.image}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', flexShrink: 0, minHeight: '650px' }}
            />
          ))}
        </div>

        {/* 어두운 오버레이 */}
        <div className="absolute inset-0 bg-black/65" style={{ zIndex: 1 }} />

        {/* 레이어 2: 텍스트 (슬라이드 변경 시 페이드인) */}
        <div
          key={heroIndex}
          className="hero-text absolute inset-0 flex flex-col items-center justify-center text-center text-white px-8"
          style={{ zIndex: 2, gap: '24px' }}
        >
          <p className="text-[20px] font-semibold text-[#e2a06e] tracking-[0.05em] m-0 p-0">
            {heroSlides[heroIndex].sub}
          </p>
          <h1 className="text-[40px] md:text-[56px] lg:text-[64px] font-extrabold text-white m-0 p-0">
            {heroSlides[heroIndex].title}
          </h1>
          <p className="text-[18px] md:text-[22px] font-light text-[rgba(255,255,255,0.9)] tracking-[0.05em] m-0 p-0">
            {heroSlides[heroIndex].desc}
          </p>
          <p className="text-[15px] text-[rgba(255,255,255,0.75)] leading-relaxed m-0 p-0 whitespace-pre-line">
            {heroSlides[heroIndex].body}
          </p>
          <div className="flex gap-4 justify-center mt-2">
            <button className="bg-[#e2a06e] hover:bg-[#A06828] text-white px-8 py-[14px] rounded-lg text-[16px] font-semibold transition">
              매물 검색하기
            </button>
            <button className="border-2 border-white text-white hover:bg-white hover:text-[#e2a06e] px-8 py-[14px] rounded-lg text-[16px] font-semibold transition">
              상담 신청하기
            </button>
          </div>
        </div>

        {/* 레이어 3: 화살표 + 인디케이터 */}
        <button
          onClick={() => changeSlide((heroIndex - 1 + heroSlides.length) % heroSlides.length)}
          className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center justify-center text-white text-3xl"
          style={{ background: 'rgba(0,0,0,0.35)', border: 'none', borderRadius: '50%', width: '48px', height: '48px', cursor: 'pointer', zIndex: 20 }}
        >‹</button>
        <button
          onClick={() => changeSlide((heroIndex + 1) % heroSlides.length)}
          className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center justify-center text-white text-3xl"
          style={{ background: 'rgba(0,0,0,0.35)', border: 'none', borderRadius: '50%', width: '48px', height: '48px', cursor: 'pointer', zIndex: 20 }}
        >›</button>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2" style={{ zIndex: 20 }}>
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => changeSlide(i)}
              style={{
                width: '10px', height: '10px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: i === heroIndex ? '#e2a06e' : 'rgba(255,255,255,0.5)',
                transition: 'background 0.3s',
              }}
            />
          ))}
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
            style={{ backgroundColor: '#e2a06e' }}
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
            <div style={{ fontSize: '17px', fontWeight: 700, padding: '10px 16px' }} className="bg-[#e2a06e] text-white">
              매물 종류
            </div>
            <ul>
              {propertyTypes.map((type) => (
                <li key={type.id}>
                  <a
                    href="#"
                    className="flex items-center justify-between text-[#333] border-b border-gray-100 hover:text-[#e2a06e] transition-colors"
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
            <div style={{ fontSize: '17px', fontWeight: 700, padding: '10px 16px' }} className="bg-[#e2a06e] text-white">
              테마 종류
            </div>
            <ul>
              {themeTypes.map((theme, index) => (
                <li key={index}>
                  <a
                    href="#"
                    className="flex items-center justify-between text-[#333] border-b border-gray-100 last:border-b-0 hover:text-[#e2a06e] transition-colors"
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
                    className="absolute top-2 right-2 bg-[#e2a06e] text-white font-bold rounded-full flex items-center justify-center"
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
            <h2 style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center', marginBottom: '24px', color: '#1a1a1a' }}>테마별 매물 검색</h2>
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
                    className="absolute top-2 right-2 bg-[#e2a06e] text-white font-bold rounded-full flex items-center justify-center"
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
                        ? 'bg-[#e2a06e] text-white border-[#e2a06e]'
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
                <Link
                  key={property.id}
                  href={`/item/view/${property.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: 'auto', transition: 'all 0.2s ease', cursor: 'pointer' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                  className="border border-gray-200 overflow-hidden"
                >
                  <div className="bg-[#e2a06e] text-white flex justify-between items-center" style={{ padding: '8px 12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{property.id}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600 }} className="truncate ml-2">{(property.title ?? '').replace('헤르만 ', '')}</span>
                  </div>
                  <div className="relative" style={{ height: '260px' }}>
                    <img src={property.image} alt={property.title} className="w-full h-full object-cover" />
                    <button className="absolute top-2 right-2 text-white text-xl hover:text-red-500 transition-colors" onClick={e => e.preventDefault()}>
                      ♡
                    </button>
                    <div className="absolute top-2 left-2 flex gap-1">
                      {(property.badges ?? []).map((badge: string, index: number) => (
                        <span key={index} className="bg-[#e2a06e] text-white rounded" style={{ fontSize: '11px', padding: '2px 6px' }}>
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-gray-500 mb-2" style={{ fontSize: '14px' }}>
                      <p>{formatAddress(property.location ?? '')} · {property.exclusive_area ? `전용 ${property.exclusive_area}㎡ (${toPyeong(parseFloat(property.exclusive_area))}평)` : property.area ? `전용 ${property.area}㎡` : ''} · {property.type} · {property.floor}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="bg-green-100 text-green-800 rounded" style={{ fontSize: '14px', padding: '4px 10px' }}>보증금</span>
                        <span style={{ fontSize: '18px', fontWeight: 700 }}>{typeof property.deposit === 'number' ? formatPrice(property.deposit) : property.deposit}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="bg-green-100 text-green-800 rounded" style={{ fontSize: '14px', padding: '4px 10px' }}>월세</span>
                        <span style={{ fontSize: '18px', fontWeight: 700 }}>{typeof property.monthly === 'number' ? formatPrice(property.monthly) : property.monthly}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* 더보기 버튼 */}
            <div className="text-center mt-6">
              <button className="border border-[#e2a06e] text-[#e2a06e] hover:bg-[#e2a06e] hover:text-white rounded-lg font-semibold transition" style={{ fontSize: '15px', padding: '8px 24px' }}>
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
          <div className="bg-[#e2a06e] text-white" style={{ padding: '8px 12px' }}>
            <p style={{ fontSize: '16px', fontWeight: 600 }}>대표전화 CALL CENTER</p>
          </div>

          <div style={{ padding: '16px' }}>
            <p style={{ fontSize: '26px', fontWeight: 700, color: '#e2a06e', marginBottom: '4px' }}>010-8680-8151</p>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px', lineHeight: 1.6 }}>평일 10:00 - 19:00<br />토요일 10:00 - 19:00</p>

            <p style={{ fontSize: '16px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>상담 신청</p>

            <form className="space-y-2">
              <input
                type="text"
                placeholder="이름"
                className="w-full border border-gray-300 rounded focus:outline-none focus:border-[#e2a06e]"
                style={{ fontSize: '15px', padding: '10px 12px' }}
              />
              <input
                type="tel"
                placeholder="연락처"
                className="w-full border border-gray-300 rounded focus:outline-none focus:border-[#e2a06e]"
                style={{ fontSize: '15px', padding: '10px 12px' }}
              />
              <textarea
                placeholder="문의 내용"
                rows={4}
                className="w-full border border-gray-300 rounded focus:outline-none focus:border-[#e2a06e] resize-none"
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
                className="w-full bg-[#e2a06e] hover:bg-[#A06828] text-white rounded font-semibold transition"
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
              <p className="text-3xl font-bold text-[#e2a06e]">010-8680-8151</p>
              <p className="text-[13px] text-gray-300 mt-2" style={{ lineHeight: 1.8 }}>평일 10:00 - 19:00 (토요일 10:00 - 19:00)</p>
            </div>
          </div>
          <div className="border-t border-gray-600 pt-6 text-center">
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-300 mb-4">
              <a href="#" className="hover:text-white transition">회사소개</a>
              <a href="#" className="hover:text-white transition">매물 의뢰하기</a>
              <a href="#" className="hover:text-white transition">부동산 소식</a>
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
