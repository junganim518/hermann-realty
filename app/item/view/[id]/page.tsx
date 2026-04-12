'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

declare global {
  interface Window { kakao: any; }
}

const navTabs = [
  { label: '매물 정보', id: 'section-info' },
  { label: '매물 설명', id: 'section-desc' },
  { label: '위치', id: 'section-location' },
  { label: '주변 교통정보', id: 'section-transport' },
  { label: '비슷한 매물', id: 'section-similar' },
];


const calcDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const formatDist = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;

/* ── 평수 계산 함수 ── */
const toPyeong = (sqm: number) => (sqm * 0.3025).toFixed(1);

/* ── 호수 포맷: 숫자만이면 "호" 붙이기 ── */
const formatUnit = (v?: string) => {
  if (!v) return '';
  return /^\d+$/.test(v.trim()) ? `${v.trim()}호` : v;
};

/* ── 층수 포맷: 숫자만이면 "층" 붙이기 ── */
const formatFloor = (v: any) => {
  if (!v) return '';
  const s = String(v).trim();
  return /^\d+$/.test(s) ? `${s}층` : s;
};

/* ── 주소 정규화 ── */
const normalizeAddr = (addr: string) =>
  addr.replace(/^경기\s/, '경기도 ').replace(/^서울\s/, '서울특별시 ');

/* ── 주소 2줄 분리: { line1: "경기도 부천시", line2: "신흥로" } ── */
const splitAddress = (address: string): { line1: string; line2: string } => {
  if (!address) return { line1: '', line2: '' };
  const n = normalizeAddr(address);
  // 도로명: ~로/길 까지
  const road = n.match(/^(.*?(?:시|군))\s+(.*?(?:구)\s+)?(\S+(?:로|길))/);
  if (road) {
    const city = road[1];
    return { line1: city, line2: ((road[2] ?? '') + road[3]).trim() };
  }
  // 지번: 한글동 까지
  const dong = n.match(/^(.*?(?:시|군))\s+((?:\S+구\s+)?\S*[가-힣]동)/);
  if (dong) {
    return { line1: dong[1], line2: dong[2] };
  }
  return { line1: n, line2: '' };
};

/* ── 짧은 버전: 로/길명 또는 동명만 ── */
const formatAddress = (address: string) => {
  const { line2, line1 } = splitAddress(address);
  return line2 || line1;
};

/* ── 긴 버전: 전체 (줄바꿈 없이) ── */
const formatAddressLong = (address: string) => {
  const { line1, line2 } = splitAddress(address);
  return [line1, line2].filter(Boolean).join(' ');
};

/* ── 금액 포맷 함수 ── */
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

/* ── 섹션 헤더 컴포넌트 ── */
function SectionHeader({ icon, title, open, onToggle }: { icon: string; title: string; open: boolean; onToggle: () => void }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f8f8', padding: '10px 16px', borderLeft: '3px solid #e2a06e', marginBottom: open ? '12px' : 0, cursor: 'pointer' }}
      onClick={onToggle}
    >
      <span style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>{icon} {title}</span>
      <span style={{ fontSize: '13px', color: '#888', userSelect: 'none' }}>{open ? '∧' : '∨'}</span>
    </div>
  );
}

interface Property {
  id?: string;
  property_number?: string;
  title?: string;
  address?: string;
  unit_number?: string;
  transaction_type?: string;
  property_type?: string;
  deposit?: number;
  monthly_rent?: number;
  maintenance_fee?: number;
  premium?: number;
  supply_area?: string;
  exclusive_area?: string;
  current_floor?: string;
  total_floor?: string;
  direction?: string;
  parking?: boolean | string;
  elevator?: boolean | string;
  theme_type?: string;
  available_date?: string;
  approval_date?: string;
  usage_type?: string;
  theme_types?: string;
  description?: string;
  admin_memo?: string;
  landlord_name?: string;
  landlord_phone?: string;
  tenant_name?: string;
  tenant_phone?: string;
  extra_contacts?: { name: string; phone: string; role: string }[];
  is_sold?: boolean;
  latitude?: number | string;
  longitude?: number | string;
  sale_price?: number;
  property_images?: { image_url: string; thumbnail_url?: string }[];
}

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [similarProperties, setSimilarProperties] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [currentImage, setCurrentImage] = useState(0);
  const [activeTab, setActiveTab] = useState('section-info');
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [openInfo,     setOpenInfo]     = useState(true);
  const [openDesc,     setOpenDesc]     = useState(true);
  const [openSubway,   setOpenSubway]   = useState(true);
  const [openLocation, setOpenLocation] = useState(true);
  const [nearbySubway, setNearbySubway] = useState<any[]>([]);

  useEffect(() => {
    const header = document.querySelector('header') as HTMLElement;
    if (header) setHeaderHeight(header.offsetHeight);
  }, []);

  // 스크롤 감지 → 위로이동 버튼
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── 스크롤 시 탭 활성화 자동 변경
  useEffect(() => {
    const sectionIds = navTabs.map(t => t.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveTab(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [property]);

  // 관리자 여부 확인 (로그인된 유저 = 관리자)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdmin(!!data.user);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    async function fetchProperty() {
      setLoading(true);

      // 1) 매물 조회
      const { data } = await supabase
        .from('properties')
        .select('*')
        .eq('property_number', id)
        .single();

      if (data) {
        // 2) property_id(uuid)로 이미지 조회
        const { data: imgs } = await supabase
          .from('property_images')
          .select('*')
          .eq('property_id', data.id)
          .order('order_index', { ascending: true });

        data.property_images = imgs ?? [];
      }

      setProperty(data);
      setLoading(false);

      if (data?.property_type) {
        // 1차: 같은 property_type + transaction_type + 면적 ±50%
        const area = parseFloat(data.exclusive_area);
        let query1 = supabase
          .from('properties')
          .select('*')
          .eq('property_type', data.property_type)
          .neq('property_number', data.property_number)
          .order('created_at', { ascending: false })
          .limit(10);

        if (data.transaction_type) {
          query1 = query1.eq('transaction_type', data.transaction_type);
        }

        const { data: raw1 } = await query1;
        let results = (raw1 ?? []).filter((p: any) => {
          if (!area || isNaN(area)) return true;
          const pArea = parseFloat(p.exclusive_area);
          if (isNaN(pArea)) return true;
          return pArea >= area * 0.5 && pArea <= area * 1.5;
        }).slice(0, 3);

        // 2차: 3개 못 채우면 같은 property_type만으로 보충
        if (results.length < 3) {
          const existIds = new Set(results.map((r: any) => r.property_number));
          existIds.add(data.property_number);
          const { data: raw2 } = await supabase
            .from('properties')
            .select('*')
            .eq('property_type', data.property_type)
            .order('created_at', { ascending: false })
            .limit(10);
          const extra = (raw2 ?? []).filter((p: any) => !existIds.has(p.property_number));
          results = [...results, ...extra].slice(0, 3);
        }

        // 이미지 조회
        const withImages = await Promise.all(
          results.map(async (p: any) => {
            const { data: imgs } = await supabase
              .from('property_images')
              .select('image_url')
              .eq('property_id', p.id)
              .order('order_index', { ascending: true })
              .limit(1);
            return { ...p, image: imgs?.[0]?.image_url ?? null };
          })
        );
        setSimilarProperties(withImages);
      }
    }
    fetchProperty();
  }, [id]);

  const images: string[] = property?.property_images?.length
    ? property.property_images.map((img: any) => img.image_url)
    : [];

  const thumbnails: string[] = property?.property_images?.length
    ? property.property_images.map((img: any) => img.thumbnail_url ?? img.image_url)
    : [];

  const hasImages = images.length > 0;

  // ── 위치 지도 ref + 초기화
  const locationMapRef = useRef<HTMLDivElement>(null);
  const locationMapObjRef = useRef<any>(null);

  useEffect(() => {
    if (!property || !openLocation || locationMapObjRef.current) return;
    let cancelled = false;

    console.log('[지도] 초기화 시작 — latitude:', property.latitude, 'longitude:', property.longitude, 'address:', property.address);

    // 지도 생성 + 원 표시 + 주변 교통 검색
    const buildMap = (lat: number, lng: number) => {
      if (cancelled || !locationMapRef.current || locationMapObjRef.current) return;
      console.log('[지도] buildMap 실행 — lat:', lat, 'lng:', lng);

      const pos = new window.kakao.maps.LatLng(lat, lng);
      const map = new window.kakao.maps.Map(locationMapRef.current, { center: pos, level: 4, minLevel: 3 });
      locationMapObjRef.current = map;

      // 반경 200m 원으로 근방 표시
      new window.kakao.maps.Circle({
        map,
        center: pos,
        radius: 200,
        strokeWeight: 1.5,
        strokeColor: '#e2a06e',
        strokeOpacity: 0.8,
        fillColor: '#e2a06e',
        fillOpacity: 0.2,
      });
      console.log('[지도] 지도 + 원 생성 완료');

      // services 라이브러리 확인
      if (!window.kakao?.maps?.services) {
        console.error('[지도] services 라이브러리 없음 — 지하철 검색 불가');
        return;
      }

      // 주변 지하철역 검색
      console.log('[지하철] cancelled 상태:', cancelled);
      console.log('[지하철] 검색 시작', lat, lng);
      console.log('[지하철] services.Places 존재:', !!window.kakao?.maps?.services?.Places);
      const ps = new window.kakao.maps.services.Places();
      ps.keywordSearch('지하철역', (data: any, status: any) => {
        console.log('[지하철] 콜백 실행:', status, data?.length);
        if (status === window.kakao.maps.services.Status.OK) {
          const items = data.map((d: any) => ({
            name: d.place_name, dist: calcDistance(lat, lng, parseFloat(d.y), parseFloat(d.x)),
          })).sort((a: any, b: any) => a.dist - b.dist).slice(0, 5);
          setNearbySubway(items);
        }
      }, { x: lng, y: lat, radius: 2000, sort: window.kakao.maps.services.SortBy?.DISTANCE });
      console.log('[지하철] keywordSearch 호출 완료');

    };

    // 좌표 결정 후 지도 생성
    const initWithSdk = () => {
      if (cancelled) return;
      console.log('[지도] SDK 준비 완료, Geocoder 사용 가능:', typeof window.kakao.maps.services?.Geocoder);

      const lat = property.latitude ? parseFloat(String(property.latitude)) : NaN;
      const lng = property.longitude ? parseFloat(String(property.longitude)) : NaN;

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        console.log('[지도] 좌표 있음 → 바로 지도 생성');
        buildMap(lat, lng);
      } else if (property.address) {
        console.log('[지도] 좌표 없음 → Geocoder로 주소 변환:', property.address);
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.addressSearch(property.address, (result: any, status: any) => {
          console.log('[지도] Geocoder 결과:', status, result?.[0]);
          if (!cancelled && status === window.kakao.maps.services.Status.OK && result.length > 0) {
            buildMap(parseFloat(result[0].y), parseFloat(result[0].x));
          } else {
            console.warn('[지도] Geocoder 실패 — status:', status);
          }
        });
      } else {
        console.warn('[지도] 좌표도 주소도 없음 — 지도 표시 불가');
      }
    };

    // SDK 로드
    const loadSdk = () => {
      const script = document.createElement('script');
      script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=8a478b4b6ea5e02722a33f6ac2fa34b6&autoload=false&libraries=services,clusterer';
      script.async = true;
      script.onload = () => {
        console.log('[지도] SDK 스크립트 로드 완료');
        window.kakao.maps.load(() => {
          console.log('[지도] kakao.maps.load() 콜백 실행');
          if (!cancelled) initWithSdk();
        });
      };
      document.head.appendChild(script);
    };

    if (typeof window.kakao?.maps?.Map === 'function' && window.kakao?.maps?.services) {
      console.log('[지도] SDK + services 이미 로드됨');
      initWithSdk();
    } else if (typeof window.kakao?.maps?.Map === 'function' && !window.kakao?.maps?.services) {
      // SDK는 로드됐지만 services 없음 → 새 스크립트 강제 삽입
      console.log('[지도] services 없음 → 스크립트 재삽입');
      const s = document.createElement('script');
      s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=8a478b4b6ea5e02722a33f6ac2fa34b6&autoload=false&libraries=services';
      s.async = true;
      s.onload = () => {
        window.kakao.maps.load(() => { if (!cancelled) initWithSdk(); });
      };
      document.head.appendChild(s);
    } else if (window.kakao?.maps?.load) {
      console.log('[지도] SDK 스크립트 있음, load() 호출');
      window.kakao.maps.load(() => { if (!cancelled) initWithSdk(); });
    } else {
      const existing = document.querySelector('script[src*="dapi.kakao.com/v2/maps/sdk"]');
      if (existing) {
        console.log('[지도] 스크립트 태그 존재, 로드 대기 (폴링)');
        const t = setInterval(() => {
          if (cancelled) { clearInterval(t); return; }
          if (typeof window.kakao?.maps?.Map === 'function') {
            clearInterval(t); initWithSdk();
          } else if (window.kakao?.maps?.load) {
            clearInterval(t);
            window.kakao.maps.load(() => { if (!cancelled) initWithSdk(); });
          }
        }, 200);
        return () => { cancelled = true; clearInterval(t); };
      }
      console.log('[지도] SDK 스크립트 없음 → 동적 삽입');
      loadSdk();
    }

    return () => { cancelled = true; };
  }, [property, openLocation]);

  // ── 카테고리 검색 (편의점, 카페 등)
  const prevImage = () => setCurrentImage((p) => (p === 0 ? images.length - 1 : p - 1));
  const nextImage = () => setCurrentImage((p) => (p === images.length - 1 ? 0 : p + 1));

  if (loading) {
    return (
      <main style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⏳</div>
          <p style={{ fontSize: '16px' }}>매물 정보를 불러오는 중입니다...</p>
        </div>
      </main>
    );
  }

  if (!property) {
    return (
      <main style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏚</div>
          <p style={{ fontSize: '20px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>매물을 찾을 수 없습니다</p>
          <p style={{ fontSize: '15px', color: '#999' }}>매물번호 {id}에 해당하는 매물이 존재하지 않습니다.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh' }}>

      <style dangerouslySetInnerHTML={{ __html: `
        /* ── 태블릿 (768px ~ 1199px) ── */
        @media (min-width: 768px) and (max-width: 1199px) {
          .detail-tab-inner { padding: 0 24px !important; }
          .detail-tab-inner .detail-tab-btns button { font-size: 14px !important; padding: 10px 12px !important; }
          .detail-tab-inner .detail-tab-utils { display: none !important; }
          .detail-body { padding: 16px 24px 0 !important; gap: 16px !important; }
          .detail-aside { width: 280px !important; }
          .detail-carousel-img { height: 380px !important; }
          .detail-carousel-thumb { height: 70px !important; }
          .detail-similar { grid-template-columns: repeat(2, 1fr) !important; }
          .detail-map-container { height: 300px !important; }
          .detail-section { padding: 12px !important; }
          .detail-info-table { border-collapse: separate !important; border-spacing: 0 !important; }
          .detail-info-table tbody { display: flex !important; flex-direction: column !important; }
          .detail-info-table tr { display: contents !important; }
          .detail-info-table td { display: flex !important; justify-content: space-between !important; align-items: center !important; width: 100% !important; padding: 10px 12px !important; border-bottom: 1px solid #f0f0f0 !important; box-sizing: border-box !important; }
          .detail-info-table td:nth-child(odd) { background: #f8f8f8 !important; font-size: 13px !important; color: #888 !important; }
          .detail-info-table td:nth-child(even) { font-size: 14px !important; font-weight: 700 !important; }
        }

        /* ── 모바일 (768px 미만) ── */
        @media (max-width: 767px) {
          .tab-bar { top: 64px !important; }
          .detail-tab-inner { padding: 0 8px !important; }
          .detail-tab-inner .detail-tab-btns { overflow-x: auto !important; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .detail-tab-inner .detail-tab-btns::-webkit-scrollbar { display: none; }
          .detail-tab-inner .detail-tab-btns button { font-size: 13px !important; padding: 9px 10px !important; }
          .detail-body { padding: 8px 4px 0 !important; flex-direction: column !important; gap: 10px !important; }
          .detail-main { order: 2; }
          .detail-aside { width: 100% !important; position: static !important; max-height: none !important; overflow: visible !important; order: 1; }
          .detail-carousel-img { height: 240px !important; }
          .detail-carousel-thumb { height: 50px !important; }
          .detail-info-table { border-collapse: separate !important; border-spacing: 0 !important; }
          .detail-info-table tbody { display: flex !important; flex-direction: column !important; }
          .detail-info-table tr { display: contents !important; }
          .detail-info-table td { display: flex !important; justify-content: space-between !important; align-items: center !important; width: 100% !important; padding: 10px 12px !important; border-bottom: 1px solid #f0f0f0 !important; box-sizing: border-box !important; }
          .detail-info-table td:nth-child(odd) { background: #f8f8f8 !important; font-size: 13px !important; color: #888 !important; }
          .detail-info-table td:nth-child(even) { font-size: 14px !important; font-weight: 700 !important; }
          .detail-similar { grid-template-columns: repeat(2, 1fr) !important; }
          .detail-section { padding: 10px !important; }
          .detail-map-container { height: 250px !important; }
          .detail-subway-item { font-size: 13px !important; }
          .detail-subway-item span { font-size: 11px !important; }
          .detail-watermark span:first-child { font-size: 18px !important; letter-spacing: 4px !important; }
          .detail-watermark span:last-child { font-size: 10px !important; }
          .detail-pnum { font-size: 12px !important; padding: 2px 6px !important; }
          .detail-sold-overlay span { font-size: 32px !important; padding: 8px 20px !important; }
          .detail-mobile-fab { display: flex !important; }
          .detail-pc-back { display: none !important; }
        }
        .detail-mobile-fab { display: none !important; }
        @media (max-width: 767px) {
          .detail-mobile-fab { display: flex !important; }
          .detail-pc-scroll-top { display: none !important; }
        }
      ` }} />

      {/* ── 상단 탭 바 ── */}
      <div className="tab-bar" style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', position: 'sticky', top: headerHeight, zIndex: 100, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div className="detail-tab-inner" style={{ width: '100%', maxWidth: '100%', padding: '0 350px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="detail-tab-btns" style={{ display: 'flex', overflowX: 'auto' }}>
            {navTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  const el = document.getElementById(tab.id);
                  if (el) {
                    const tabBarH = 50;
                    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - tabBarH;
                    window.scrollTo({ top, behavior: 'smooth' });
                  }
                }}
                style={{
                  padding: '11px 14px',
                  fontSize: '16px',
                  fontWeight: activeTab === tab.id ? 700 : 400,
                  color: activeTab === tab.id ? '#e2a06e' : '#555',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #e2a06e' : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="detail-tab-utils detail-pc-back" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={() => router.back()}
              style={{ fontSize: '14px', color: '#fff', background: 'rgba(100,100,100,0.5)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ← 목록으로
            </button>
          </div>
        </div>
      </div>

      {/* ── 2열 본문 ── */}
      <div className="detail-body" style={{ width: '100%', maxWidth: '100%', padding: '20px 350px 0', display: 'flex', gap: '32px', alignItems: 'flex-start' }}>

        {/* ── 좌측 본문 ── */}
        <div className="detail-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* 이미지 캐러셀 */}
          <div style={{ background: '#fff', overflow: 'hidden', border: '1px solid #e0e0e0', position: 'relative' }}>
            {hasImages ? (
              <>
                <div className="detail-carousel-img" style={{ position: 'relative', height: '600px' }}>
                  <img src={images[currentImage]} alt="매물 이미지" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {/* 좌측 상단: 매물번호 */}
                  <div className="detail-pnum" style={{ position: 'absolute', top: '14px', left: '14px', background: 'rgba(100,100,100,0.55)', color: '#fff', fontSize: '18px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', zIndex: 2 }}>
                    매물번호 {property.property_number ?? id}
                  </div>
                  {images.length > 1 && (
                    <>
                      <button onClick={prevImage} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff', borderRadius: '50%', width: '44px', height: '44px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                      <button onClick={nextImage} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff', borderRadius: '50%', width: '44px', height: '44px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                    </>
                  )}
                  {/* 중앙 워터마크 */}
                  <div className="detail-watermark" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.55, pointerEvents: 'none' }}>
                    <span style={{ color: '#e2a06e', fontSize: '40px', fontWeight: 300, letterSpacing: '8px', fontFamily: 'Georgia, "Times New Roman", serif' }}>HERMANN REALTY</span>
                    <span style={{ color: '#e2a06e', fontSize: '20px', fontWeight: 400, letterSpacing: '4px', marginTop: '8px' }}>헤르만부동산</span>
                  </div>
                  {/* 우측 하단: 페이지 카운터 */}
                  <div style={{ position: 'absolute', right: '16px', bottom: '16px', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '13px', padding: '4px 10px', borderRadius: '20px' }}>
                    {currentImage + 1}/{images.length}
                  </div>
                </div>
                {thumbnails.length > 1 && (
                  <div style={{ display: 'flex', gap: '6px', padding: '10px' }}>
                    {thumbnails.map((thumb, i) => (
                      <div key={i} onClick={() => setCurrentImage(i)} className="detail-carousel-thumb" style={{ flex: 1, height: '120px', cursor: 'pointer', overflow: 'hidden', border: currentImage === i ? '2px solid #e2a06e' : '2px solid #e0e0e0', transition: 'border 0.2s' }}>
                        <img src={thumb} alt={`썸네일${i + 1}`} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#aaa', gap: '8px', background: '#f8f8f8' }}>
                <span style={{ fontSize: '48px' }}>🏠</span>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#999' }}>이미지 준비중</p>
              </div>
            )}
            {/* 거래완료 오버레이 (이미지 유무 상관없이 컨테이너 위에 표시) */}
            {property.is_sold && (
              <div className="detail-sold-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <span style={{ border: '4px solid #e04a4a', color: '#e04a4a', fontSize: '48px', fontWeight: 900, padding: '12px 32px', transform: 'rotate(-15deg)', letterSpacing: '4px' }}>
                  거래완료
                </span>
              </div>
            )}
          </div>

          {/* 🏠 매물 정보 */}
          <div id="section-info" className="detail-section" style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="🏠" title="매물 정보" open={openInfo} onToggle={() => setOpenInfo(!openInfo)} />
            {openInfo && (
              <table className="detail-info-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {/* 1행: 주소 | 매물종류 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>주소</td>
                    <td style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>{property.address ? (isAdmin ? [property.address, formatUnit(property.unit_number)].filter(Boolean).join(' ') : formatAddressLong(property.address)) : '-'}</td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>매물종류</td>
                    <td style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>{property.property_type ?? '-'}</td>
                  </tr>
                  {/* 2행: 거래유형 | 금액 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>거래유형</td>
                    <td style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>{property.transaction_type ?? '-'}</td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>금액</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#e2a06e', fontWeight: 700 }}>
                      {buildPriceStr(property)}
                    </td>
                  </tr>
                  {/* 3행: 권리금 | 관리비 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>권리금</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: property.premium ? '#333' : '#E53935', fontWeight: 700 }}>{property.premium ? (isAdmin ? formatPrice(property.premium) : '협의') : '무권리'}</td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>관리비</td>
                    <td style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>{property.maintenance_fee ? formatPrice(property.maintenance_fee) : '없음'}</td>
                  </tr>
                  {/* 4행: 면적 | 층수 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>면적</td>
                    <td style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {property.supply_area && (
                          <span>공급 {property.supply_area}㎡ ({toPyeong(parseFloat(property.supply_area))}평)</span>
                        )}
                        {property.exclusive_area && (
                          <span>전용 {property.exclusive_area}㎡ ({toPyeong(parseFloat(property.exclusive_area))}평)</span>
                        )}
                        {!property.supply_area && !property.exclusive_area && '-'}
                      </div>
                    </td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>층수</td>
                    <td style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>
                      {[property.current_floor && formatFloor(property.current_floor), property.total_floor && `전체 ${formatFloor(property.total_floor)}`].filter(Boolean).join(' / ') || '-'}
                    </td>
                  </tr>
                  {/* 5행: 방향 | 입주가능일 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>방향</td>
                    <td style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>{property.direction ?? '-'}</td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>입주가능일</td>
                    <td style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>{property.available_date ?? '-'}</td>
                  </tr>
                  {/* 6행: 주차 | 엘리베이터 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>주차</td>
                    <td style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>{property.parking === true || property.parking === '가능' ? '가능' : property.parking === false || property.parking === '불가' ? '불가' : property.parking ?? '-'}</td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>엘리베이터</td>
                    <td style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>{property.elevator === true || property.elevator === '있음' ? '있음' : property.elevator === false || property.elevator === '없음' ? '없음' : property.elevator ?? '-'}</td>
                  </tr>
                  {/* 7행: 용도 | 사용승인일 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>용도</td>
                    <td style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>{property.usage_type ?? '-'}</td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>사용승인일</td>
                    <td style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>{property.approval_date ?? '-'}</td>
                  </tr>
                  {/* 8행: 테마종류 (전체) */}
                  <tr>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>테마종류</td>
                    <td colSpan={3} style={{ padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 }}>{property.theme_types ?? property.theme_type ?? '-'}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* 📝 매물 설명 */}
          <div id="section-desc" className="detail-section" style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="📝" title="매물 설명" open={openDesc} onToggle={() => setOpenDesc(!openDesc)} />
            {openDesc && (
              <div>
                <p style={{ whiteSpace: 'pre-line', lineHeight: '2', fontSize: '15px' }}>
                  {property?.description}
                </p>
              </div>
            )}
          </div>

          {/* 🔒 관리자 메모 (로그인 시에만 표시) */}
          {isAdmin && property?.admin_memo && (
            <div style={{ background: '#fffdf0', border: '1px solid #f0e6b8', padding: '16px', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px' }}>🔒</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#8b7000' }}>관리자 메모</span>
              </div>
              <p style={{ whiteSpace: 'pre-line', lineHeight: '1.8', fontSize: '14px', color: '#666', background: '#fffef5', padding: '12px', borderRadius: '4px', border: '1px solid #f0e6b8' }}>
                {property.admin_memo}
              </p>
            </div>
          )}

          {/* 🔒 연락처 (관리자 전용) */}
          {isAdmin && (property?.landlord_name || property?.landlord_phone || property?.tenant_name || property?.tenant_phone || (property?.extra_contacts && property.extra_contacts.length > 0)) && (
            <div style={{ background: '#f0f6ff', border: '1px solid #c6dcf3', padding: '16px', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <span style={{ fontSize: '16px' }}>🔒</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#2c4f8c' }}>연락처</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(property.landlord_name || property.landlord_phone) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#fff', borderRadius: '4px', border: '1px solid #dce7f5' }}>
                    <span style={{ fontSize: '12px', color: '#fff', background: '#4a7cdc', padding: '3px 10px', borderRadius: '3px', fontWeight: 700, flexShrink: 0 }}>임대인</span>
                    {property.landlord_name && <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{property.landlord_name}</span>}
                    {property.landlord_phone && (
                      <a href={`tel:${property.landlord_phone}`} style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 700, color: '#4a7cdc', textDecoration: 'none' }}>
                        📞 {property.landlord_phone}
                      </a>
                    )}
                  </div>
                )}
                {(property.tenant_name || property.tenant_phone) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#fff', borderRadius: '4px', border: '1px solid #dce7f5' }}>
                    <span style={{ fontSize: '12px', color: '#fff', background: '#888', padding: '3px 10px', borderRadius: '3px', fontWeight: 700, flexShrink: 0 }}>임차인</span>
                    {property.tenant_name && <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{property.tenant_name}</span>}
                    {property.tenant_phone && (
                      <a href={`tel:${property.tenant_phone}`} style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 700, color: '#4a7cdc', textDecoration: 'none' }}>
                        📞 {property.tenant_phone}
                      </a>
                    )}
                  </div>
                )}
                {property.extra_contacts?.map((c, i) => (
                  (c.name || c.phone) && (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#fff', borderRadius: '4px', border: '1px solid #dce7f5' }}>
                      <span style={{ fontSize: '12px', color: '#fff', background: '#7a9bd9', padding: '3px 10px', borderRadius: '3px', fontWeight: 700, flexShrink: 0 }}>{c.role || '기타'}</span>
                      {c.name && <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{c.name}</span>}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 700, color: '#4a7cdc', textDecoration: 'none' }}>
                          📞 {c.phone}
                        </a>
                      )}
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* 📍 위치 */}
          <div id="section-location" className="detail-section" style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="📍" title="위치" open={openLocation} onToggle={() => setOpenLocation(!openLocation)} />
            {openLocation && (
              <div>
                <div className="detail-map-container" style={{ position: 'relative', width: '100%', height: '400px', marginBottom: '16px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div ref={locationMapRef} style={{ width: '100%', height: '100%' }} />
                  {!locationMapObjRef.current && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8e8e8', fontSize: '15px', color: '#888' }}>
                      지도를 불러오는 중...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 🚇 인근 지하철 */}
          <div id="section-transport" className="detail-section" style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="🚇" title="인근 지하철 (주변 2km 이내)" open={openSubway} onToggle={() => setOpenSubway(!openSubway)} />
            {openSubway && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {nearbySubway.length > 0 ? nearbySubway.map((s: any, i: number) => (
                  <div key={i} className="detail-subway-item" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: '#00A84D', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>지하철</span>
                    <span style={{ fontSize: '15px', fontWeight: 500, color: '#222' }}>{s.name}</span>
                    <span style={{ fontSize: '15px', color: '#e2a06e', fontWeight: 600 }}>{formatDist(s.dist)}</span>
                  </div>
                )) : (
                  <p style={{ fontSize: '14px', color: '#999', textAlign: 'center', padding: '8px 0' }}>
                    {locationMapObjRef.current ? '주변에 지하철역이 없습니다.' : '지도 로딩 후 자동 검색됩니다.'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 🏘 비슷한 매물 */}
          <div id="section-similar" className="detail-section" style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="🏢" title="비슷한 매물" open={true} onToggle={() => {}} />
            {similarProperties.length > 0 ? (
              <div className="detail-similar" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {similarProperties.map((p: any) => {
                  const pyeong = p.exclusive_area ? toPyeong(parseFloat(p.exclusive_area)) : null;
                  return (
                    <a
                      key={p.property_number}
                      href={`/item/view/${p.property_number}`}
                      style={{ textDecoration: 'none', color: 'inherit', display: 'block', border: '1px solid #e0e0e0', overflow: 'hidden', transition: 'all 0.2s ease', cursor: 'pointer', background: '#fff' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      }}
                    >
                      {/* 썸네일 4:3 */}
                      <div style={{ aspectRatio: '4/3', overflow: 'hidden', background: '#f0f0f0' }}>
                        {p.image
                          ? <img src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#bbb' }}>준비중</div>
                        }
                      </div>
                      <div style={{ padding: '10px' }}>
                        <p style={{ fontSize: '11px', color: '#bbb', marginBottom: '2px' }}>{p.property_number}</p>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(p.title ?? '').replace(/헤르만\s*/g, '')}
                        </p>
                        <p style={{ fontSize: '12px', color: '#888', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatAddressLong(p.address ?? '')}
                        </p>
                        <p style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                          {[p.property_type, p.exclusive_area ? `${p.exclusive_area}㎡${pyeong ? ` (${pyeong}평)` : ''}` : null, p.current_floor ? `${p.current_floor}층` : null].filter(Boolean).join(' · ')}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {p.transaction_type && (() => {
                            const colors: Record<string, { bg: string; border: string; text: string }> = {
                              '월세': { bg: '#fff8f2', border: '#e2a06e', text: '#e2a06e' },
                              '전세': { bg: '#eef4ff', border: '#4a80e8', text: '#4a80e8' },
                              '매매': { bg: '#fff0f0', border: '#e05050', text: '#e05050' },
                            };
                            const c = colors[p.transaction_type] ?? { bg: '#f5f5f5', border: '#999', text: '#999' };
                            return (
                              <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', flexShrink: 0 }}>
                                {p.transaction_type}
                              </span>
                            );
                          })()}
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>{buildPriceStr(p)}</span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: '#999', textAlign: 'center', padding: '16px 0' }}>비슷한 매물이 없습니다.</p>
            )}
          </div>

        </div>

        {/* ── 우측 패널 ── */}
        <aside className="detail-aside" style={{ width: '360px', flexShrink: 0, position: 'sticky', top: '190px', alignSelf: 'flex-start', maxHeight: 'calc(100vh - 190px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* 매물 정보 카드 */}
          <div style={{ background: '#fff', border: '1px solid #ddd', padding: '16px' }}>
            <div style={{ background: '#f0f0f0', fontSize: '12px', color: '#555', padding: '4px 8px', display: 'inline-block', borderRadius: '3px', marginBottom: '10px' }}>
              매물번호 {property.property_number ?? id}
            </div>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#e2a06e', lineHeight: 1.5, marginBottom: '4px' }}>
              {buildPriceStr(property)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '22px', fontWeight: 700, color: '#e04a4a' }}>
                {property.premium ? (isAdmin ? `권리금 ${formatPrice(property.premium)}` : '권리금 협의') : '무권리'}
              </span>
              {property.maintenance_fee && (
                <>
                  <span style={{ color: '#ddd' }}>|</span>
                  <span style={{ fontSize: '15px', color: '#666' }}>관리비 {formatPrice(property.maintenance_fee)}</span>
                </>
              )}
            </div>
            <p style={{ fontSize: '16px', color: '#444', marginBottom: '4px' }}>📍 {property.address ? (isAdmin ? [property.address, formatUnit(property.unit_number)].filter(Boolean).join(' ') : formatAddressLong(property.address)) : '-'}</p>
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '14px' }}>
              {[property.property_type, property.exclusive_area && `전용 ${property.exclusive_area}㎡ (${toPyeong(parseFloat(property.exclusive_area))}평)`, property.current_floor && formatFloor(property.current_floor)].filter(Boolean).join(' · ')}
            </p>
            <button
              style={{ width: '100%', height: '48px', background: '#e2a06e', color: '#fff', fontSize: '18px', fontWeight: 700, border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '10px', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#A06828')}
              onMouseLeave={e => (e.currentTarget.style.background = '#e2a06e')}
            >
              매물 문의하기
            </button>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[{ icon: '♡', label: '찜하기' }, { icon: '🖨', label: '인쇄' }, { icon: '📤', label: '공유' }, { icon: '🔗', label: '링크복사' }].map((btn, i) => (
                <button key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '7px 4px', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#555' }}>
                  <span style={{ fontSize: '15px' }}>{btn.icon}</span>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* 공인중개사 카드 */}
          <div style={{ background: '#fff', border: '1px solid #ddd', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>👤</div>
              <div>
                <p style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', marginBottom: '1px' }}>황정아</p>
                <p style={{ fontSize: '13px', color: '#888' }}>대표공인중개사</p>
              </div>
            </div>
            <p style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', marginBottom: '10px' }}>📞 010-8680-8151</p>
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {[
                '사무소: 헤르만공인중개사사무소',
                '주소: 부천시 신흥로 223 101동 712호',
                '등록번호: 제41192-2024-00113호',
              ].map((info, i) => (
                <p key={i} style={{ fontSize: '12px', color: '#666', lineHeight: 1.5 }}>{info}</p>
              ))}
            </div>
          </div>

          {/* 수정/삭제 (로그인 시에만) */}
          {isAdmin && (
          <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href={`/admin/properties/${property.property_number}/edit`}
                style={{ flex: 1, display: 'block', textAlign: 'center', padding: '12px', background: '#f8f8f8', border: '1px solid #e2a06e', borderRadius: '4px', color: '#e2a06e', fontSize: '15px', fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}
              >
                매물 수정
              </a>
              <button
                onClick={async () => {
                  if (!confirm(`매물 ${property.property_number} "${property.title}"을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
                  const pid = property.id;
                  // 1) 이미지 조회 + Storage 삭제
                  const { data: imgs } = await supabase.from('property_images').select('id, image_url').eq('property_id', pid);
                  if (imgs && imgs.length > 0) {
                    const paths = imgs.map((img: any) => {
                      const m = (img.image_url as string).match(/property-images\/(.+)$/);
                      return m ? m[1] : null;
                    }).filter(Boolean) as string[];
                    if (paths.length > 0) await supabase.storage.from('property-images').remove(paths);
                    // 2) property_images 삭제
                    await supabase.from('property_images').delete().eq('property_id', pid);
                  }
                  // 3) properties 삭제
                  const { error } = await supabase.from('properties').delete().eq('id', pid);
                  if (error) { alert(`삭제 실패: ${error.message}`); return; }
                  alert('매물이 삭제되었습니다.');
                  window.location.href = '/map';
                }}
                style={{ flex: 1, padding: '12px', background: '#fff', border: '1px solid #e05050', borderRadius: '4px', color: '#e05050', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
              >
                매물 삭제
              </button>
            </div>
          )}

        </aside>

      </div>

      {/* 모바일 우측 하단 FAB (뒤로가기 + 위로이동) */}
      <div
        className="detail-mobile-fab"
        style={{
          display: 'none',
          position: 'fixed', bottom: '70px', right: '16px',
          flexDirection: 'column', gap: '8px',
          zIndex: 999,
        }}
      >
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(100,100,100,0.7)', color: '#fff',
              border: 'none', fontSize: '18px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ↑
          </button>
        )}
        <button
          onClick={() => router.back()}
          style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(100,100,100,0.7)', color: '#fff',
            border: 'none', fontSize: '18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ←
        </button>
      </div>

      {/* PC용 위로이동 */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed',
            bottom: '40px',
            right: '40px',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(100,100,100,0.5)',
            color: '#fff',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="detail-pc-scroll-top"
        >
          ↑
        </button>
      )}

    </main>
  );
}
