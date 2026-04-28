'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const formatAddress = (address: string) => {
  if (!address) return '';
  const match = address.match(/(.+동)/);
  return match ? match[1] : address;
};

const toPyeong = (sqm: number) => (sqm * 0.3025).toFixed(1);

const formatPrice = (v: number) => {
  if (!v) return '-';
  const uk  = Math.floor(v / 10000);
  const man = v % 10000;
  if (uk > 0) {
    return man > 0 ? `${uk}억 ${man.toLocaleString()}만원` : `${uk}억`;
  }
  return `${v.toLocaleString()}만원`;
};

const buildPriceStr = (p: any) => {
  if (p.transaction_type === '매매') {
    const v = p.sale_price || p.deposit;
    return v ? `매매가 ${formatPrice(v)}` : '-';
  }
  const parts = [
    p.deposit      ? `보증금 ${formatPrice(p.deposit)}` : null,
    p.monthly_rent ? `월세 ${formatPrice(p.monthly_rent)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '-';
};

export default function Home() {
  const [activeTab, setActiveTab] = useState('상가');
  const [headerHeight, setHeaderHeight] = useState(200);
  const [heroIndex, setHeroIndex] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(8);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [recentProperties, setRecentProperties] = useState<any[]>([]);
  const contactRef = useRef<HTMLDivElement>(null);

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (q) window.location.href = `/properties?search=${encodeURIComponent(q)}`;
  };

  // 문의하기 드롭업: 외부 클릭 닫기 + 5초 자동 닫기
  useEffect(() => {
    if (!contactOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setContactOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    const timer = setTimeout(() => setContactOpen(false), 5000);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timer);
    };
  }, [contactOpen]);

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

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAdmin(!!data.user));
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);


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
        .select('*')
        .eq('property_type', activeTab)
        .order('is_sold', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(8);
      if (data && data.length > 0) {
        // 각 매물의 대표 이미지를 property_id로 조회
        const mapped = await Promise.all(
          data.map(async (p: any) => {
            const { data: imgs } = await supabase
              .from('property_images')
              .select('image_url')
              .eq('property_id', p.id)
              .order('order_index', { ascending: true })
              .limit(1);
            return {
              id: p.property_number,
              location: p.address,
              area: p.exclusive_area,
              exclusive_area: p.exclusive_area,
              type: p.property_type,
              floor: p.current_floor,
              deposit: p.deposit,
              monthly_rent: p.monthly_rent,
              sale_price: p.sale_price,
              transaction_type: p.transaction_type,
              premium: p.premium ?? null,
              maintenance_fee: p.maintenance_fee ?? null,
              is_sold: p.is_sold ?? false,
              created_at: p.created_at,
              property_number: p.property_number ?? p.id,
              image: imgs?.[0]?.image_url ?? null,
              badges: p.badges ?? [],
            };
          })
        );
        setRecentProperties(mapped);
      } else {
        setRecentProperties([]);
      }
    }
    fetchProperties();
  }, [activeTab]);

  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [themeCounts, setThemeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchCounts() {
      const types  = ['상가', '사무실', '오피스텔', '아파트', '건물', '기타'];
      const themes = ['추천매물', '사옥형및통임대', '대형상가', '대형사무실', '무권리상가', '프랜차이즈양도양수', '1층상가', '2층이상상가'];

      const tc: Record<string, number> = {};
      const hc: Record<string, number> = {};

      await Promise.all([
        ...types.map(async (t) => {
          const { count } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('property_type', t);
          tc[t] = count ?? 0;
        }),
        ...themes.map(async (t) => {
          const { count } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .ilike('theme_type', `%${t}%`);
          hc[t] = count ?? 0;
        }),
      ]);

      setTypeCounts(tc);
      setThemeCounts(hc);
    }
    fetchCounts();
  }, []);

  const propertyTypes = [
    { id: '상가', name: '상가', eng: 'STORE', icon: '🏪', image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&q=80' },
    { id: '사무실', name: '사무실', eng: 'OFFICE', icon: '🏢', image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=400&q=80' },
    { id: '오피스텔', name: '오피스텔', eng: 'OFFICETEL', icon: '🏠', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&q=80' },
    { id: '아파트', name: '아파트', eng: 'APT', icon: '🏙', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&q=80' },
    { id: '건물', name: '건물', eng: 'BUILDING', icon: '🏗', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&q=80' },
    { id: '기타', name: '기타', eng: 'ETC', icon: '🏘', image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400&q=80' },
  ];

  const themeTypes = [
    { id: '추천매물', name: '추천매물', desc: '헤르만 추천 베스트 매물', image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&q=80' },
    { id: '사옥형및통임대', name: '사옥형 및 통임대', desc: '사옥형 건물 및 통임대 매물', image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&q=80' },
    { id: '대형상가', name: '대형 상가', desc: '대형 상가 매물', image: 'https://images.unsplash.com/photo-1519999482648-25049ddd37b1?w=400&q=80' },
    { id: '대형사무실', name: '대형사무실', desc: '대형 사무실 매물', image: 'https://images.unsplash.com/photo-1497366412874-3415097a27e7?w=400&q=80' },
    { id: '무권리상가', name: '무권리 상가', desc: '권리금 없는 깔끔한 상가', image: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=400&q=80' },
    { id: '프랜차이즈양도양수', name: '프랜차이즈 양도양수', desc: '프랜차이즈 양도양수 매물', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80' },
    { id: '1층상가', name: '1층 상가', desc: '1층에 위치한 상가 매물', image: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=400&q=80' },
    { id: '2층이상상가', name: '2층 이상 상가', desc: '2층 이상에 위치한 상가', image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80' },
  ];

  return (
    <main className="w-full text-[#1a1a1a] leading-7">

      <style dangerouslySetInnerHTML={{ __html: `
        /* ── 기본: 그리드 ── */
        .grid-type  { display: grid; grid-template-columns: repeat(6, 1fr); }
        .grid-theme { display: grid; grid-template-columns: repeat(4, 1fr); }
        .grid-recent { display: grid; grid-template-columns: repeat(4, 1fr); }
        .sidebar-left  { display: block; }
        .sidebar-right { display: block; }

        /* ── PC 1200px 이상: 사이드바 유연 폭 ── */
        @media (min-width: 1200px) {
          .sidebar-left {
            min-width: clamp(160px, 15vw, 220px) !important;
            max-width: clamp(160px, 15vw, 220px) !important;
          }
          .sidebar-right {
            min-width: clamp(160px, 15vw, 220px) !important;
            max-width: clamp(160px, 15vw, 220px) !important;
          }
        }

        .main-card-mobile { display: block; }
        .main-card-content-row { display: block; }
        .card-header-text { font-size: 13px; }
        .card-addr-text { font-size: 13px; }
        .card-meta-text { font-size: 13px; }
        .card-badge-text { font-size: 11px; }
        .card-price-text { font-size: 14px; }
        .card-sub-text { font-size: 14px; }

        /* ── PC (1200px 이상): 기본값 사용 ── */

        /* ── 태블릿 (768px ~ 1199px) ── */
        @media (min-width: 768px) and (max-width: 1199px) {
          .sidebar-left { display: none !important; }
          .grid-type  { grid-template-columns: repeat(3, 1fr) !important; }
          .grid-theme { grid-template-columns: repeat(3, 1fr) !important; }
          .grid-recent { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
          .card-img { height: 200px !important; }
          .center-content { padding-bottom: 80px !important; }
          .sidebar-right {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            top: auto !important;
            min-width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow-y: visible !important;
            z-index: 200;
            border-top: 2px solid #e2a06e !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
          }
          .sidebar-right .bg-\\[\\#e2a06e\\] { display: none !important; }
          .sidebar-right > div { padding: 10px 16px !important; }
          .sidebar-right > div > p:first-child { display: none !important; }
          .sidebar-right > div > p:nth-child(2) { display: none !important; }
          .sidebar-right > div > div { flex-direction: row !important; gap: 8px !important; }
          .sidebar-right > div > div a { padding: 10px 12px !important; font-size: 13px !important; }
          .card-header-text { font-size: 14px !important; }
          .card-addr-text { font-size: 14px !important; }
          .card-meta-text { font-size: 14px !important; }
          .card-badge-text { font-size: 12px !important; }
          .card-price-text { font-size: 15px !important; }
          .card-sub-text { font-size: 14px !important; }
        }

        /* ── 모바일 (768px 미만) ── */
        @media (max-width: 767px) {
          .sidebar-left  { display: none !important; }
          .sidebar-right { display: none !important; }
          .grid-type  { grid-template-columns: repeat(2, 1fr) !important; }
          .grid-theme { grid-template-columns: repeat(2, 1fr) !important; }
          .grid-recent { grid-template-columns: 1fr !important; gap: 8px !important; }
          .main-card-mobile { display: flex !important; flex-direction: column !important; }
          .main-card-mobile .main-card-header { display: flex !important; padding: 6px 10px !important; }
          .main-card-mobile .main-card-header span { font-size: 11px !important; }
          .main-card-mobile .main-card-content-row { display: flex !important; flex-direction: row !important; }
          .main-card-mobile .main-card-img-wrap { width: 120px !important; min-width: 120px !important; height: 120px !important; flex-shrink: 0 !important; }
          .main-card-mobile .main-card-img { width: 100% !important; height: 120px !important; }
          .main-card-mobile .main-card-body { flex: 1 !important; padding: 6px 10px !important; display: flex !important; flex-direction: column !important; justify-content: center !important; line-height: 1.45 !important; }
          .main-card-mobile .main-card-body > div { margin-top: 1px !important; margin-bottom: 1px !important; }
          .main-card-mobile .main-card-body > p { margin: 1px 0 !important; line-height: 1.45 !important; }
          .main-card-mobile .main-card-body span { line-height: 1.45 !important; }
          .price-nowrap { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
          .main-layout { width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .center-content { padding-left: 0 !important; padding-right: 0 !important; }
          .section-title { font-size: 20px !important; margin-bottom: 16px !important; }
          .section-pad { padding: 8px !important; }
          .type-card { height: 140px !important; }
          .type-card h3 { font-size: 18px !important; }
          .theme-card { height: 180px !important; }
          .theme-card h3 { font-size: 18px !important; }
          .card-img { height: 120px !important; }
          .card-header { padding: 5px 8px !important; }
          .card-header span { font-size: 11px !important; }
          .card-body { padding: 6px 8px !important; }
          .card-body .card-addr { font-size: 11px !important; }
          .card-body .card-meta { font-size: 11px !important; }
          .card-body .card-price { font-size: 13px !important; }
          .card-body .card-badge { font-size: 9px !important; padding: 1px 5px !important; }
          .hero-sub { font-size: 14px !important; }
          .hero-title { font-size: 28px !important; }
          .hero-desc { font-size: 14px !important; }
          .hero-body { font-size: 11px !important; }
          .hero-text { padding-bottom: 100px !important; }
          .hero-btns { bottom: 80px !important; left: 0 !important; right: 0 !important; width: 100% !important; display: flex !important; justify-content: center !important; align-items: center !important; transform: none !important; }
          .search-section { padding-left: 8px !important; padding-right: 8px !important; }
          .search-input { font-size: 14px !important; }
          .search-btn { font-size: 14px !important; padding: 0 12px !important; }
        }
      ` }} />

      {/* 히어로 배너 */}
      <section className="relative w-full min-h-[400px] sm:min-h-[650px] overflow-hidden">

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .hero-text { animation: fadeIn 0.6s ease forwards; }
        ` }} />

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
              style={{ width: '100%', height: '100%', objectFit: 'cover', flexShrink: 0, minHeight: '400px' }}
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
          <p className="hero-sub text-[20px] font-semibold text-[#e2a06e] tracking-[0.05em] m-0 p-0">
            {heroSlides[heroIndex].sub}
          </p>
          <h1 className="hero-title text-[40px] md:text-[56px] lg:text-[64px] font-extrabold text-white m-0 p-0">
            {heroSlides[heroIndex].title}
          </h1>
          <p className="hero-desc text-[18px] md:text-[22px] font-light text-[rgba(255,255,255,0.9)] tracking-[0.05em] m-0 p-0">
            {heroSlides[heroIndex].desc}
          </p>
          <p className="hero-body text-[15px] text-[rgba(255,255,255,0.75)] leading-relaxed m-0 p-0 whitespace-pre-line">
            {heroSlides[heroIndex].body}
          </p>
        </div>

        {/* 레이어 3: 버튼 (슬라이드와 독립적으로 항상 표시) */}
        <div className="hero-btns" style={{ position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 3, display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '400px', padding: '0 20px' }}>
          <a href="/map" className="bg-[#e2a06e] hover:bg-[#A06828] text-white rounded-lg transition" style={{ textDecoration: 'none', width: '160px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '15px', fontWeight: 700 }}>
            매물 검색하기
          </a>
          <div ref={contactRef} style={{ position: 'relative', width: '160px' }}>
            <button
              onClick={() => setContactOpen(!contactOpen)}
              style={{ width: '100%', height: '44px', padding: 0, fontSize: '15px', fontWeight: 700, border: '2px solid #fff', color: '#fff', background: 'transparent', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#e2a06e'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#fff'; }}
            >
              문의하기
            </button>
            {contactOpen && (
                <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', overflow: 'hidden', minWidth: '180px', zIndex: 20 }}>
                  <a href="tel:010-8680-8151" onClick={() => setContactOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, color: '#333', textDecoration: 'none', borderBottom: '1px solid #f0f0f0' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fff8f2'; e.currentTarget.style.color = '#e2a06e'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#333'; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    전화 문의
                  </a>
                  <a href="sms:010-8680-8151" onClick={() => setContactOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, color: '#333', textDecoration: 'none', borderBottom: '1px solid #f0f0f0' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fff8f2'; e.currentTarget.style.color = '#e2a06e'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#333'; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    문자 문의
                  </a>
                  <a href="https://open.kakao.com/o/s3lwiwsh" target="_blank" rel="noopener noreferrer" onClick={() => setContactOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, color: '#333', textDecoration: 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FEF9E7'; e.currentTarget.style.color = '#3C1E1E'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#333'; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#3C1E1E"><path d="M12 3C6.48 3 2 6.58 2 10.94c0 2.8 1.86 5.27 4.68 6.67-.15.56-.97 3.6-.99 3.83 0 0-.02.17.09.24.11.06.24.01.24.01.32-.04 3.7-2.42 4.28-2.83.55.08 1.11.12 1.7.12 5.52 0 10-3.58 10-7.94S17.52 3 12 3z"/></svg>
                    카카오톡 문의
                  </a>
                </div>
            )}
          </div>
        </div>

        {/* 레이어 4: 화살표 + 인디케이터 */}
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
      <section className="search-section bg-white py-6 px-4 md:px-6">
        <div
          className="w-full max-w-full sm:max-w-md lg:max-w-lg mx-auto flex items-stretch"
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
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="지역, 매물종류, 키워드 검색"
            className="search-input flex-1 px-3 py-4 text-[16px] placeholder-gray-400 outline-none border-none bg-white"
            style={{ minWidth: 0, color: '#333' }}
          />
          <button
            onClick={handleSearch}
            className="search-btn px-8 py-4 text-white text-[18px] font-semibold whitespace-nowrap transition hover:opacity-90"
            style={{ backgroundColor: '#e2a06e' }}
          >
            매물검색
          </button>
        </div>
      </section>

      {/* 3열 레이아웃: 좌측 사이드바 + 중앙 콘텐츠 + 우측 패널 */}
      <div className="main-layout flex items-start" style={{ width: 'calc(100% - 32px)', margin: '0 16px' }}>

        {/* 좌측 사이드바 220px - lg 이상에서만 표시 */}
        <aside
          className="sidebar-left shrink-0 border border-gray-200 bg-white"
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
                    href={`/properties?type=${encodeURIComponent(type.id)}`}
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
                    href={`/properties?theme=${encodeURIComponent(theme.id)}`}
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
        <div className="center-content flex-1 min-w-0 px-4">

          {/* 매물 종류 섹션 */}
          <section className="section-pad" style={{ padding: '16px', backgroundColor: '#fff' }}>
            <h2 className="section-title" style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center', marginBottom: '24px', color: '#1a1a1a' }}>매물종류</h2>
            <div className="grid-type gap-2">
              {propertyTypes.map((type) => (
                <a
                  key={type.id}
                  href={`/properties?type=${encodeURIComponent(type.id)}`}
                  className="type-card relative rounded-[4px] overflow-hidden cursor-pointer group"
                  style={{
                    height: '220px',
                    backgroundImage: `url('${type.image}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'block', textDecoration: 'none',
                  }}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors"></div>
                  <div
                    className="absolute top-2 right-2 bg-[#e2a06e] text-white font-bold rounded-full flex items-center justify-center"
                    style={{ fontSize: '11px', width: '28px', height: '28px' }}
                  >
                    {(typeCounts[type.id] ?? 0).toLocaleString()}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <p style={{ fontSize: '12px', opacity: 0.8, marginBottom: '2px' }}>{type.eng}</p>
                    <h3 style={{ fontSize: '24px', fontWeight: 700 }}>{type.name}</h3>
                  </div>
                </a>
              ))}
            </div>
          </section>

          {/* 테마 종류 섹션 */}
          <section className="section-pad" style={{ padding: '16px', backgroundColor: '#f9f9f9' }}>
            <h2 className="section-title" style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center', marginBottom: '24px', color: '#1a1a1a' }}>테마별 매물 검색</h2>
            <div className="grid-theme gap-3">
              {themeTypes.map((theme, index) => (
                <a
                  key={index}
                  href={`/properties?theme=${encodeURIComponent(theme.id)}`}
                  className="theme-card relative rounded-[4px] overflow-hidden cursor-pointer group"
                  style={{
                    height: '280px',
                    backgroundImage: `url('${theme.image}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'block', textDecoration: 'none',
                  }}
                >
                  <div className="absolute inset-0 bg-black/45 group-hover:bg-black/30 transition-colors"></div>
                  <div
                    className="absolute top-2 right-2 bg-[#e2a06e] text-white font-bold rounded-full flex items-center justify-center"
                    style={{ fontSize: '11px', width: '28px', height: '28px' }}
                  >
                    {(themeCounts[theme.id] ?? 0).toLocaleString()}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '2px' }}>{theme.name}</h3>
                    <p style={{ fontSize: '13px', opacity: 0.85 }}>{theme.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>

          {/* 최신매물 섹션 */}
          <section className="section-pad" style={{ padding: '16px', backgroundColor: '#fff' }}>
            <h2 className="section-title" style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center', marginBottom: '24px', color: '#1a1a1a' }}>최신매물</h2>

            {/* 탭 */}
            <div style={{ marginBottom: '16px' }}>
              <div className="tab-grid" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px' }}>
                {['상가', '사무실', '오피스텔', '아파트', '건물', '기타'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setVisibleCount(8); }}
                    style={{
                      fontSize: '14px', padding: '0',
                      height: '44px', width: 'calc(33.33% - 4px)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                      borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: activeTab === tab ? '#e2a06e' : '#fff',
                      color: activeTab === tab ? '#fff' : '#555',
                      fontWeight: activeTab === tab ? 700 : 400,
                      borderColor: activeTab === tab ? '#e2a06e' : '#ddd',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* 매물 그리드 */}
            <div className="grid-recent gap-2">
              {recentProperties.slice(0, visibleCount).map((property) => (
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
                  className="main-card-mobile border border-gray-200 overflow-hidden bg-white"
                >
                  <div className="main-card-header" style={{ padding: isMobile ? '2px 8px' : '8px 10px', background: '#e2a06e' }} />
                  <div className="main-card-content-row">
                    <div className="main-card-img-wrap">
                      <div className="main-card-img relative" style={{ height: '260px', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'rgba(100,100,100,0.6)', color: '#fff', fontSize: isMobile ? '10px' : '12px', fontWeight: 600, padding: isMobile ? '1px 6px' : '3px 8px', borderRadius: '4px', zIndex: 2 }}>
                          {property.property_number ?? property.id}
                        </div>
                        {property.image ? (
                          <>
                            <img src={property.image} alt="매물 이미지" className="w-full h-full object-cover" />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', overflow: 'hidden' }}>
                              <span style={{ color: '#e2a06e', fontSize: isMobile ? '8px' : 'clamp(10px, 2vw, 18px)', fontWeight: 300, letterSpacing: isMobile ? '1px' : 'clamp(2px, 0.5vw, 6px)', fontFamily: 'Georgia, "Times New Roman", serif', opacity: 0.45, whiteSpace: 'nowrap' }}>HERMANN REALTY</span>
                              <span style={{ color: '#e2a06e', fontSize: isMobile ? '6px' : 'clamp(8px, 1.2vw, 10px)', letterSpacing: isMobile ? '0.5px' : 'clamp(1px, 0.3vw, 3px)', marginTop: isMobile ? '1px' : '4px', opacity: 0.45, whiteSpace: 'nowrap' }}>헤르만부동산</span>
                            </div>
                          </>
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', overflow: 'hidden' }}>
                            <span style={{ color: '#e2a06e', fontSize: isMobile ? '8px' : 'clamp(10px, 2vw, 18px)', fontWeight: 300, letterSpacing: isMobile ? '1px' : 'clamp(2px, 0.5vw, 6px)', fontFamily: 'Georgia, "Times New Roman", serif', opacity: 0.7, whiteSpace: 'nowrap' }}>HERMANN REALTY</span>
                            <span style={{ color: '#e2a06e', fontSize: isMobile ? '6px' : 'clamp(8px, 1.2vw, 10px)', letterSpacing: isMobile ? '0.5px' : 'clamp(1px, 0.3vw, 3px)', marginTop: isMobile ? '1px' : '4px', opacity: 0.5, whiteSpace: 'nowrap' }}>헤르만부동산</span>
                          </div>
                        )}
                        {property.is_sold && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#fff', fontSize: '16px', fontWeight: 800, border: '2px solid #fff', padding: '2px 10px', borderRadius: '4px', transform: 'rotate(-15deg)' }}>거래완료</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="main-card-body p-3">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        {property.transaction_type && (() => {
                          const colors: Record<string, { bg: string; border: string; text: string }> = {
                            '월세': { bg: '#fff8f2', border: '#e2a06e', text: '#e2a06e' },
                            '전세': { bg: '#eef4ff', border: '#4a80e8', text: '#4a80e8' },
                            '매매': { bg: '#fff0f0', border: '#e05050', text: '#e05050' },
                          };
                          const c = colors[property.transaction_type] ?? { bg: '#f5f5f5', border: '#999', text: '#999' };
                          return <span className="card-badge-text" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '11px', fontWeight: 700, padding: isMobile ? '0px 4px' : '2px 8px', borderRadius: '3px', flexShrink: 0 }}>{property.transaction_type}</span>;
                        })()}
                        <span className="card-price-text" style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: '#1a1a1a' }}>{buildPriceStr(property)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '2px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        {property.premium ? (
                          <span className="card-sub-text" style={{ fontSize: '14px', color: '#e05050', fontWeight: 600 }}>권리금 {isAdmin ? formatPrice(property.premium) : '협의'}</span>
                        ) : (
                          <span className="card-sub-text" style={{ fontSize: '14px', color: '#e05050', fontWeight: 600 }}>무권리</span>
                        )}
                        {property.maintenance_fee && property.maintenance_fee !== 0 ? (
                          <span className="card-sub-text" style={{ fontSize: '13px', color: '#888' }}>관리비 {formatPrice(property.maintenance_fee)}</span>
                        ) : (
                          <span className="card-sub-text" style={{ fontSize: '13px', color: '#888' }}>관리비 -</span>
                        )}
                      </div>
                      <p className="card-addr-text" style={{ fontSize: '13px', color: '#666', margin: isMobile ? '0' : '0 0 2px', whiteSpace: 'normal' }}>{formatAddress(property.location ?? '')}</p>
                      <p className="card-meta-text" style={{ fontSize: '13px', color: '#666', marginBottom: isMobile ? '0' : '4px' }}>
                        {[property.type, property.exclusive_area ? `전용 ${property.exclusive_area}㎡ (${toPyeong(parseFloat(property.exclusive_area))}평)` : null, property.floor ? `${String(property.floor).trim().endsWith('층') ? property.floor : property.floor + '층'}` : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* 더보기 버튼 */}
            {visibleCount < recentProperties.length && (
              <div className="text-center mt-6">
                <button
                  onClick={() => setVisibleCount(prev => prev + 8)}
                  className="border border-[#e2a06e] text-[#e2a06e] hover:bg-[#e2a06e] hover:text-white rounded-lg font-semibold transition"
                  style={{ fontSize: '15px', padding: '8px 24px' }}
                >
                  매물 더보기 ∨
                </button>
              </div>
            )}
          </section>

        </div>

        {/* 우측 패널 260px - xl 이상에서만 표시 */}
        <aside
          className="sidebar-right shrink-0 border border-gray-200 bg-white"
          style={{ minWidth: '260px', maxWidth: '260px', position: 'sticky', top: headerHeight, height: `calc(100vh - ${headerHeight}px)`, overflowY: 'auto', alignSelf: 'flex-start' }}
        >

          {/* 대표전화 헤더 */}
          <div className="bg-[#e2a06e] text-white" style={{ padding: '8px 12px' }}>
            <p style={{ fontSize: '16px', fontWeight: 600 }}>대표전화 CALL CENTER</p>
          </div>

          <div style={{ padding: '16px' }}>
            <p style={{ fontSize: 'clamp(18px, 1.7vw, 24px)', fontWeight: 700, color: '#e2a06e', marginBottom: '4px', whiteSpace: 'nowrap', letterSpacing: '-0.5px' }}>010-8680-8151</p>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px', lineHeight: 1.6 }}>평일 10:00 - 19:00<br />토요일 10:00 - 19:00</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* 전화 문의 */}
              <a
                href="tel:010-8680-8151"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: '#e2a06e', color: '#fff', fontSize: '15px', fontWeight: 700, borderRadius: '8px', textDecoration: 'none', border: 'none', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#c4884e')}
                onMouseLeave={e => (e.currentTarget.style.background = '#e2a06e')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                전화 문의하기
              </a>
              {/* 문자 문의 */}
              <a
                href="sms:010-8680-8151"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: '#fff', color: '#e2a06e', fontSize: '15px', fontWeight: 700, borderRadius: '8px', border: '1px solid #e2a06e', textDecoration: 'none', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e2a06e'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#e2a06e'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                문자 문의하기
              </a>
              {/* 카카오톡 문의 */}
              <a
                href="https://open.kakao.com/o/s3lwiwsh"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: '#FEE500', color: '#3C1E1E', fontSize: '15px', fontWeight: 700, borderRadius: '8px', border: 'none', textDecoration: 'none', transition: 'opacity 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#3C1E1E"><path d="M12 3C6.48 3 2 6.58 2 10.94c0 2.8 1.86 5.27 4.68 6.67-.15.56-.97 3.6-.99 3.83 0 0-.02.17.09.24.11.06.24.01.24.01.32-.04 3.7-2.42 4.28-2.83.55.08 1.11.12 1.7.12 5.52 0 10-3.58 10-7.94S17.52 3 12 3z"/></svg>
                카카오톡 문의
              </a>
            </div>
          </div>
        </aside>

      </div>

    </main>
  );
}
