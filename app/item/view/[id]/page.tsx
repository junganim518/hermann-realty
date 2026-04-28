'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Link as LinkIcon, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isNewProperty } from '@/lib/isNewProperty';

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

/* ── 호수 포맷: 숫자만이면 "호" 붙이기, "호"로 끝나면 유지 ── */
const formatUnit = (v?: string) => {
  if (!v) return '';
  const s = v.trim();
  if (s.endsWith('호') || /^\d+$/.test(s) === false) return s;
  return `${s}호`;
};

/* ── 동 포맷: 숫자만이면 "동" 붙이기, "동"으로 끝나면 유지 ── */
const formatDong = (v?: string) => {
  if (!v) return '';
  const s = v.trim();
  if (s.endsWith('동')) return s;
  if (/^\d+$/.test(s)) return `${s}동`;
  return s;
};

/* ── 동호수 합쳐서 표시 ── */
const formatBuildingUnit = (buildingName?: string, unitNumber?: string) => {
  const parts = [
    buildingName ? formatDong(buildingName) : '',
    unitNumber ? formatUnit(unitNumber) : '',
  ].filter(Boolean);
  return parts.join(' ');
};

/* ── 층수 포맷: "층"으로 안 끝나면 "층" 붙이기 ── */
const formatFloor = (v: any) => {
  if (!v) return '';
  const s = String(v).trim();
  return s.endsWith('층') ? s : `${s}층`;
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
  building_name?: string;
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
  total_parking?: number;
  room_count?: number;
  bathroom_count?: number;
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
  created_at?: string;
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
  const [showLightbox, setShowLightbox] = useState(false);
  const lightboxTouchX = useRef<number | null>(null);
  const carouselTouchX = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState('section-info');
  const [headerHeight, setHeaderHeight] = useState(144);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [shareToast, setShareToast] = useState('');
  const [openInfo,     setOpenInfo]     = useState(true);
  const [openDesc,     setOpenDesc]     = useState(true);
  const [openSubway,   setOpenSubway]   = useState(true);
  const [openLocation, setOpenLocation] = useState(true);
  const [nearbySubway, setNearbySubway] = useState<any[]>([]);

  useEffect(() => {
    const measure = () => {
      const header = document.querySelector('header') as HTMLElement;
      if (header) {
        const h = header.offsetHeight;
        setHeaderHeight(h);
        console.log('[상세페이지] headerHeight:', h);
      } else {
        console.warn('[상세페이지] <header> 요소를 찾을 수 없습니다');
      }
    };
    measure();
    // 로고 이미지/폰트 로드 후 재측정
    const t = setTimeout(measure, 300);
    const checkMobile = () => { const w = window.innerWidth; setIsMobile(w < 768); setIsTablet(w >= 768 && w < 1200); };
    checkMobile();
    window.addEventListener('resize', measure);
    window.addEventListener('resize', checkMobile);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('resize', checkMobile);
    };
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

  // 매물 조회수 +1 (관리자 로그인 시 제외, localStorage 24시간 중복 방지)
  useEffect(() => {
    const propId = property?.id;
    if (!propId) return;
    let cancelled = false;

    (async () => {
      // 1) 로그인 사용자(관리자)는 카운트 제외 — localStorage도 건드리지 않음
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        if (data.user) {
          console.log('[조회수] 관리자 로그인 — 카운트 제외');
          return;
        }
      } catch (err) {
        // auth 조회 실패 시 익명 사용자로 간주하고 계속 진행
        console.warn('[조회수] auth 조회 실패 — 익명으로 진행:', err);
      }
      if (cancelled) return;

      // 2) localStorage 24시간 중복 체크
      const STORAGE_KEY = `viewed_property_${propId}`;
      const TTL_MS = 24 * 60 * 60 * 1000;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const last = parseInt(stored, 10);
          if (!isNaN(last) && Date.now() - last < TTL_MS) return;
        }
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        // localStorage 접근 불가(사파리 프라이빗 모드 등) — 그대로 진행
      }
      if (cancelled) return;

      // 3) RPC로 원자적 +1
      const { error } = await supabase.rpc('increment_view_count', { p_property_id: propId });
      if (error) console.warn('[조회수] 증가 실패:', error.message);
    })();

    return () => { cancelled = true; };
  }, [property?.id]);

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
          .eq('is_sold', false)
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
            .eq('is_sold', false)
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

  // 라이트박스: 키보드 조작 + body 스크롤 락
  useEffect(() => {
    if (!showLightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLightbox(false);
      else if (e.key === 'ArrowLeft') prevImage();
      else if (e.key === 'ArrowRight') nextImage();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [showLightbox]);

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

      {/* ── 인쇄 전용 헤더 (화면에서는 숨김) ── */}
      <div className="print-only print-header">
        <div className="print-logo">헤르만부동산</div>
        <div className="print-tagline">REAL ESTATE &amp; INVESTMENTS</div>
      </div>

      {/* ── 인쇄 전용 매물 타이틀 + 매물번호 ── */}
      {property && (
        <div className="print-only print-title-block">
          <h1 className="print-title">{property.title || '(제목 없음)'}</h1>
          <div className="print-pnum">매물번호 {property.property_number ?? '-'}</div>
        </div>
      )}

      {/* ── 인쇄 전용 사진 섹션 (대표 1장 + 보조 2장) ── */}
      {property && images.length > 0 && (
        <div className="print-only print-photos">
          <img src={images[0]} alt="대표 사진" className="print-photo-main" />
          {images.length > 1 && (
            <div className="print-photo-row">
              {images.slice(1, 3).map((src, i) => (
                <img key={`print-photo-${i}`} src={src} alt="" className="print-photo-sub" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 인쇄 전용 매물 정보 표 (4-column 고정) ── */}
      {property && (
        <div className="print-only print-info-block">
          <h2 className="print-info-title">📋 매물 정보</h2>
          <table className="print-info-table">
            <tbody>
              <tr>
                <th>주소</th>
                <td>
                  {normalizeAddr(property.address ?? '-')}
                  {(property.building_name || property.unit_number) && (
                    <span> {formatBuildingUnit(property.building_name, property.unit_number)}</span>
                  )}
                </td>
                <th>매물종류</th>
                <td>{property.property_type ?? '-'}</td>
              </tr>
              <tr>
                <th>거래유형</th>
                <td>{property.transaction_type ?? '-'}</td>
                <th>금액</th>
                <td>{buildPriceStr(property)}</td>
              </tr>
              <tr>
                <th>권리금</th>
                <td>{property.premium ? formatPrice(property.premium) : '무권리'}</td>
                <th>관리비</th>
                <td>{property.maintenance_fee ? formatPrice(property.maintenance_fee) : '없음'}</td>
              </tr>
              <tr>
                <th>면적</th>
                <td>
                  {[
                    property.supply_area ? `공급 ${property.supply_area}㎡` : '',
                    property.exclusive_area ? `전용 ${property.exclusive_area}㎡ (${toPyeong(parseFloat(property.exclusive_area))}평)` : '',
                  ].filter(Boolean).join(' / ') || '-'}
                </td>
                <th>층수</th>
                <td>
                  {[
                    property.current_floor && formatFloor(property.current_floor),
                    property.total_floor && `전체 ${formatFloor(property.total_floor)}`,
                  ].filter(Boolean).join(' / ') || '-'}
                </td>
              </tr>
              <tr>
                <th>총 주차대수</th>
                <td>{property.total_parking != null ? `${property.total_parking}대` : '-'}</td>
                <th>방수/욕실수</th>
                <td>{`${property.room_count != null ? property.room_count : '-'}개 / ${property.bathroom_count != null ? property.bathroom_count : '-'}개`}</td>
              </tr>
              <tr>
                <th>방향</th>
                <td>{property.direction ?? '-'}</td>
                <th>입주가능일</th>
                <td>{property.available_date ?? '-'}</td>
              </tr>
              <tr>
                <th>주차</th>
                <td>
                  {property.parking === true || property.parking === '가능'
                    ? '가능'
                    : property.parking === false || property.parking === '불가'
                    ? '불가'
                    : property.parking ?? '-'}
                </td>
                <th>엘리베이터</th>
                <td>
                  {property.elevator === true || property.elevator === '있음'
                    ? '있음'
                    : property.elevator === false || property.elevator === '없음'
                    ? '없음'
                    : property.elevator ?? '-'}
                </td>
              </tr>
              <tr>
                <th>용도</th>
                <td>{property.usage_type ?? '-'}</td>
                <th>사용승인일</th>
                <td>{property.approval_date ?? '-'}</td>
              </tr>
              <tr>
                <th>테마종류</th>
                <td colSpan={3}>{property.theme_types ?? property.theme_type ?? '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .detail-carousel-thumbs::-webkit-scrollbar { display: none; }

        /* ── PC 기본 ── */
        .tab-bar { top: 144px; }
        .detail-body { padding-top: 50px; }

        /* ── 매물정보 테이블 (PC/태블릿) 컬럼 너비 고정 ── */
        @media (min-width: 768px) {
          .detail-info-table { table-layout: fixed !important; width: 100% !important; }
          .detail-info-table td:nth-child(1),
          .detail-info-table td:nth-child(3) { width: 15% !important; }
          .detail-info-table td:nth-child(2),
          .detail-info-table td:nth-child(4) { width: 35% !important; }
          .detail-info-table td { word-break: break-word !important; overflow-wrap: break-word !important; }
          .detail-info-title { font-size: 18px !important; }
        }

        /* ── PC (1200px 이상) 좌측 본문 오버플로우 방지 ── */
        @media (min-width: 1200px) {
          .detail-main { overflow: hidden !important; min-width: 0 !important; }
          .detail-body { padding-left: clamp(16px, calc((100% - 1280px) / 2 + 16px), 350px) !important; padding-right: clamp(16px, calc((100% - 1280px) / 2 + 16px), 350px) !important; gap: clamp(16px, 2vw, 32px) !important; }
          /* aside를 유연하게: 기본 360px, 1500px 미만에서 단계적으로 줄어듦 */
          .detail-aside {
            width: clamp(280px, 22vw, 360px) !important;
            flex: 0 1 auto !important;
            flex-shrink: 1 !important;
            min-width: 280px !important;
          }
          .detail-aside-card, .detail-aside-card * { min-width: 0 !important; overflow-wrap: break-word !important; word-break: break-word !important; }
        }

        /* ── 태블릿 (768px ~ 1199px) ── */
        @media (min-width: 768px) and (max-width: 1199px) {
          .tab-bar { top: 124px !important; }
          .detail-tab-inner { padding: 0 24px !important; }
          .detail-tab-inner .detail-tab-btns button { font-size: 15px !important; padding: 10px 12px !important; }
          .detail-tab-inner .detail-tab-utils { display: none !important; }
          .detail-body { padding: 50px 24px 0 !important; gap: 16px !important; padding-top: 50px !important; }
          .detail-aside { width: 280px !important; }
          .detail-carousel-img { height: 500px !important; }
          .detail-carousel-thumb { height: 80px !important; }
          .detail-similar { grid-template-columns: repeat(2, 1fr) !important; }
          .detail-map-container { height: 300px !important; }
          .detail-section { padding: 12px !important; font-size: 15px !important; }
          .detail-subway-item { font-size: 15px !important; }
          .detail-similar .prop-card-body p { font-size: 14px !important; }
          .detail-info-table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; }
          .detail-info-table tbody { display: table-row-group !important; flex-direction: unset !important; }
          .detail-info-table tr { display: table-row !important; }
          .detail-info-table td { display: table-cell !important; justify-content: unset !important; width: auto !important; padding: 12px 14px !important; border-bottom: 1px solid #f0f0f0 !important; font-size: 15px !important; }
          .detail-info-table td:nth-child(odd) { background: #f8f8f8 !important; color: #888 !important; font-weight: 500 !important; width: 90px !important; white-space: nowrap !important; font-size: 14px !important; }
          .detail-info-table td:nth-child(even) { font-weight: 700 !important; color: #333 !important; font-size: 15px !important; }
          .detail-aside { width: 100% !important; position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important; top: auto !important; max-height: none !important; overflow-y: visible !important; z-index: 200 !important; border-top: 2px solid #e2a06e !important; background: #fff !important; }
        }

        /* ── 모바일+태블릿 공통 ── */
        @media (max-width: 1199px) {
          .detail-aside-actions { display: none !important; }
          .detail-aside-agent { display: none !important; }
        }

        /* ── 태블릿 aside 레이아웃 ── */
        @media (min-width: 768px) and (max-width: 1199px) {
          .detail-aside > div:first-child { display: grid !important; grid-template-columns: 1fr auto !important; gap: 16px !important; align-items: center !important; padding: 12px 16px !important; }
          .detail-aside-info { display: flex !important; flex-direction: column !important; gap: 6px !important; }
          .detail-aside-info .aside-pnum { display: inline-block !important; width: fit-content !important; font-size: 11px !important; padding: 2px 6px !important; background: #f0f0f0 !important; color: #888 !important; border-radius: 3px !important; margin-bottom: 4px !important; }
          .detail-aside-info .aside-price-row { display: flex !important; align-items: center !important; gap: 10px !important; flex-wrap: wrap !important; margin-bottom: 0 !important; }
          .detail-aside-info .aside-price-row .aside-price { font-size: 18px !important; font-weight: 700 !important; color: #e2a06e !important; margin: 0 !important; }
          .detail-aside-info .aside-price-row .aside-sub { font-size: 14px !important; color: #666 !important; margin: 0 !important; }
          .detail-aside-info .aside-price-row .aside-sub span { font-size: 14px !important; font-weight: 500 !important; }
          .detail-aside-info .aside-addr-row { display: flex !important; align-items: center !important; gap: 6px !important; flex-wrap: wrap !important; margin-bottom: 0 !important; }
          .detail-aside-info .aside-addr-row p { font-size: 12px !important; color: #777 !important; margin: 0 !important; }
          .detail-aside > div:first-child > button { width: 130px !important; min-height: 80px !important; height: 100% !important; font-size: 15px !important; border-radius: 8px !important; margin: 0 !important; flex-shrink: 0 !important; }
        }

        /* ── 모바일 (768px 미만) ── */
        @media (max-width: 767px) {
          .tab-bar { top: 64px !important; }
          .detail-tab-inner { padding: 0 8px !important; }
          .detail-tab-inner .detail-tab-btns { overflow-x: auto !important; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .detail-tab-inner .detail-tab-btns::-webkit-scrollbar { display: none; }
          .detail-tab-inner .detail-tab-btns button { font-size: 13px !important; padding: 9px 10px !important; }
          .detail-body { padding-top: 50px !important; padding-left: 4px !important; padding-right: 4px !important; margin-top: 0 !important; flex-direction: column !important; gap: 10px !important; overflow-x: hidden !important; }
          .detail-main { order: 2; overflow-x: hidden !important; width: 100% !important; max-width: 100vw !important; }
          .detail-aside { width: 100% !important; position: fixed !important; bottom: 60px !important; left: 0 !important; right: 0 !important; top: auto !important; max-height: none !important; overflow-y: visible !important; z-index: 200 !important; order: unset !important; align-self: auto !important; border-top: 2px solid #e2a06e !important; background: #fff !important; }
          .detail-carousel-img { height: 240px !important; }
          .lightbox-watermark-main { font-size: 20px !important; letter-spacing: 4px !important; }
          .lightbox-watermark-sub { font-size: 11px !important; letter-spacing: 2px !important; margin-top: 4px !important; }
          .detail-info-table { border-collapse: separate !important; border-spacing: 0 !important; }
          .detail-info-table tbody { display: flex !important; flex-direction: column !important; }
          .detail-info-table tr { display: flex !important; flex-direction: row !important; border-bottom: 1px solid #f0f0f0 !important; }
          .detail-info-table td:nth-child(1) { width: 80px !important; min-width: 80px !important; background: #f8f8f8 !important; font-size: 13px !important; color: #888 !important; padding: 10px 12px !important; }
          .detail-info-table td:nth-child(2) { flex: 1 !important; font-size: 14px !important; font-weight: 700 !important; padding: 10px 12px !important; }
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
          .detail-aside > div:first-child { display: grid !important; grid-template-columns: 1fr auto !important; gap: 12px !important; align-items: center !important; padding: 6px 12px !important; }
          .detail-aside-info { display: flex !important; flex-direction: column !important; gap: 3px !important; }
          .detail-aside-info .aside-pnum { display: inline-block !important; width: fit-content !important; font-size: 11px !important; padding: 2px 6px !important; background: #f0f0f0 !important; color: #888 !important; border-radius: 3px !important; }
          .detail-aside-info .aside-price-row { display: flex !important; align-items: center !important; gap: 8px !important; flex-wrap: wrap !important; }
          .detail-aside-info .aside-price { font-size: 15px !important; font-weight: 700 !important; color: #e2a06e !important; margin: 0 !important; }
          .detail-aside-info .aside-sub { font-size: 10px !important; color: #888 !important; margin: 0 !important; }
          .detail-aside-info .aside-addr-row { display: flex !important; align-items: center !important; gap: 4px !important; flex-wrap: wrap !important; }
          .detail-aside-info .aside-addr-row p { font-size: 11px !important; color: #777 !important; margin: 0 !important; }
          .detail-aside > div:first-child > button { width: 100px !important; min-height: 56px !important; font-size: 13px !important; border-radius: 8px !important; margin: 0 !important; flex-shrink: 0 !important; }
        }
        .detail-mobile-fab { display: none !important; }
        .detail-pc-back-btn { display: none !important; }
        @media (min-width: 768px) and (max-width: 1199px) {
          .detail-pc-scroll-top { bottom: 50% !important; right: 16px !important; }
          .detail-pc-back-btn { display: flex !important; position: fixed !important; bottom: calc(50% - 60px) !important; right: 16px !important; }
        }
        @media (max-width: 767px) {
          .detail-mobile-fab { display: flex !important; }
          .detail-pc-scroll-top { display: none !important; }
          .detail-pc-back-btn { display: none !important; }
        }
        @media (min-width: 1200px) {
          .detail-aside-card { padding: 24px !important; }
          .detail-aside-card > p { margin-bottom: 14px !important; line-height: 1.8 !important; }
          .detail-aside-card > div { margin-bottom: 14px !important; }
          .detail-aside-card .aside-price { font-size: 22px !important; }
          .detail-aside-card .aside-sub-premium { font-size: 22px !important; color: #e04a4a !important; font-weight: 700 !important; }
          .detail-aside-card .aside-sub-maintenance { font-size: 15px !important; color: #666 !important; }
          .detail-aside-card .aside-sub-divider { font-size: 15px !important; }
          .detail-aside-card button { height: 48px !important; margin-bottom: 10px !important; }
          .detail-aside-actions { gap: 4px !important; }
          .detail-aside-actions button { font-size: 11px !important; padding: 7px 2px !important; word-break: keep-all !important; overflow: visible !important; white-space: nowrap !important; }
          .detail-aside-agent { padding: 20px !important; }
        }

        /* ── 매물 문의하기 버튼 줄바꿈 방지 (모든 화면) ── */
        .cta-inquiry { white-space: nowrap !important; }

        /* ── 모바일 전용: 매물 문의(가로 대부분) + 공유(아이콘 정사각) 가로 배치 ── */
        @media (max-width: 767px) {
          aside.detail-aside > div.detail-aside-card { display: block !important; padding: 10px 12px !important; }
          .aside-cta-row {
            display: flex !important;
            flex-direction: row !important;
            gap: 8px !important;
            margin-top: 8px !important;
            width: 100% !important;
            align-items: stretch !important;
          }
          .aside-cta-row > .cta-inquiry {
            flex: 1 1 0 !important;
            min-width: 0 !important;
            height: 48px !important;
            font-size: 15px !important;
          }
          .aside-cta-row > .cta-share {
            flex: none !important;
            width: 48px !important;
            height: 48px !important;
            padding: 0 !important;
            background: #f3f4f6 !important;
            color: #374151 !important;
            border: 1px solid #f3f4f6 !important;
            border-radius: 8px !important;
            font-size: 0 !important;
          }
          .aside-cta-row > .cta-share svg { width: 20px !important; height: 20px !important; }
          .cta-share-label { display: none !important; }

          /* 관리자 버튼(수정/인쇄/삭제) — 모바일에서만 컴팩트 */
          .admin-actions > a,
          .admin-actions > button {
            padding: 7px 6px !important;
            font-size: 13px !important;
            min-width: 60px !important;
            min-height: 0 !important;
            line-height: 1.2 !important;
          }
          .admin-actions > button svg { width: 14px !important; height: 14px !important; }
        }

        /* ── 태블릿 전용: 매물 문의하기 버튼 너비 확보 (글씨 잘림 방지) ── */
        @media (min-width: 768px) and (max-width: 1199px) {
          .aside-cta-row > .cta-inquiry { min-width: 160px !important; padding: 0 18px !important; }
        }

        /* ════════════ 인쇄 전용 ════════════ */
        /* 화면에서는 인쇄 전용 요소 숨김 */
        .print-only { display: none !important; }

        @media print {
          /* 모든 요소에 색상 보정 강제 (배경/보더 정확히 인쇄) */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 페이지 설정: A4 풀블리드 (마진 0 → 헤더/푸터 가장자리까지) */
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          body { font-family: 'Pretendard', sans-serif; }

          /* 화면용 요소 숨김 */
          header,
          footer,
          .tab-bar,
          .detail-mobile-fab,
          .detail-pc-back-btn,
          .detail-pc-scroll-top,
          .detail-aside,
          .detail-image-section,
          .detail-body,
          .print-hide,
          #section-info,
          #section-desc,
          #section-location,
          #section-transport,
          #section-similar {
            display: none !important;
          }

          /* main: A4 1페이지 flex column — 안전 장치로 max-height + overflow:hidden */
          main {
            background: #fff !important;
            display: flex !important;
            flex-direction: column !important;
            height: 100vh !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* 인쇄 전용 요소 표시 */
          .print-only { display: block !important; }

          /* 1) 헤더 — 흰 배경 + 골드 라인 (위 굵게, 아래 얇게) */
          .print-header {
            background: #fff !important;
            color: #000 !important;
            text-align: center;
            padding: 6mm 10mm 5mm;
            border-top: 3px solid #e2a06e !important;
            border-bottom: 1px solid #e2a06e !important;
            flex-shrink: 0;
          }
          .print-header .print-logo {
            font-size: 22px;
            font-weight: 800;
            color: #000 !important;
            letter-spacing: 2px;
          }
          .print-header .print-tagline {
            font-size: 9px;
            letter-spacing: 4px;
            color: #e2a06e !important;
            margin-top: 3px;
            font-weight: 600;
          }

          /* 2) 타이틀 + 매물번호 */
          .print-title-block {
            padding: 3mm 8mm 1mm;
            flex-shrink: 0;
          }
          .print-title-block .print-title {
            font-size: 17px !important;
            font-weight: 700;
            color: #000;
            margin: 0 0 3px 0;
            line-height: 1.25;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .print-title-block .print-pnum {
            font-size: 13.5px !important;
            color: #888;
            font-weight: 500;
          }

          /* 3) 사진 — 큼 */
          .print-photos {
            padding: 0 8mm;
            margin-bottom: 2mm;
            flex-shrink: 0;
          }
          .print-photo-main {
            width: 100%; height: 260px; object-fit: cover;
            display: block; border: 1px solid #ccc;
          }
          .print-photo-row { display: flex; gap: 2px; margin-top: 2px; }
          .print-photo-row img {
            width: 50%; height: 130px; object-fit: cover;
            border: 1px solid #ccc;
          }

          /* 4) 정보 표 — 컴팩트 (자동 stretch 안 함) */
          .print-info-block {
            flex-shrink: 0 !important;
            padding: 0 8mm 2mm;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .print-info-title {
            font-size: 17px !important;
            font-weight: 700;
            color: #1a1a1a;
            margin: 0 0 4px 0;
            padding: 0 0 3px 0;
            border-bottom: 2px solid #e2a06e !important;
            letter-spacing: 0.3px;
            flex-shrink: 0;
          }
          .print-info-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px !important;
            table-layout: fixed;
          }
          .print-info-table th,
          .print-info-table td {
            border: 1px solid #d0d0d0;
            padding: 5px 9px;
            vertical-align: middle;
            line-height: 1.35;
            word-break: keep-all;
            overflow-wrap: anywhere;
          }
          .print-info-table th {
            width: 16%;
            background: #f3f3f3 !important;
            color: #555 !important;
            font-weight: 600;
            font-size: 13px !important;
            text-align: left;
          }
          .print-info-table td {
            width: 34%;
            color: #000 !important;
            font-weight: 500;
          }

          /* 5) 푸터 — 흰 배경 + 골드 라인 + 좌우 2단 레이아웃 (페이지 하단 고정) */
          .print-footer {
            background: #fff !important;
            color: #000 !important;
            padding: 5mm 10mm 6mm;
            border-top: 3px solid #e2a06e !important;
            margin-top: auto !important;
            flex-shrink: 0;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            gap: 10mm;
          }
          /* 좌측: 작은 정보 */
          .print-footer-left {
            text-align: left;
            line-height: 1.6;
            color: #999 !important;
            font-size: 9.5px;
          }
          .print-footer-left > div {
            color: #999 !important;
          }
          .print-footer-left .print-date {
            color: #bbb !important;
            margin-top: 2px;
            font-size: 9px;
          }
          /* 우측: 헤르만부동산 + 전화번호 강조 */
          .print-footer-right {
            text-align: right;
            line-height: 1.25;
          }
          .print-footer-right .print-footer-name {
            font-size: 18px;
            font-weight: 800;
            color: #000 !important;
            letter-spacing: 1px;
            margin-bottom: 2px;
          }
          .print-footer-right .print-footer-phone {
            font-size: 17px;
            font-weight: 700;
            color: #1a1a1a !important;
            letter-spacing: 0.5px;
          }
        }
      ` }} />

      {/* ── 상단 탭 바 ── */}
      <div className="tab-bar" style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', position: 'fixed', left: 0, right: 0, zIndex: 100, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
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
              onClick={() => { window.scrollTo(0, 0); router.back(); }}
              style={{ fontSize: '14px', color: '#fff', background: 'rgba(100,100,100,0.5)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ← 목록으로
            </button>
          </div>
        </div>
      </div>

      {/* ── 2열 본문 ── */}
      <div className="detail-body" style={{ width: '100%', maxWidth: '100%', paddingLeft: '350px', paddingRight: '350px', paddingBottom: isMobile ? (isAdmin ? '170px' : '128px') : isTablet ? (isAdmin ? '140px' : '104px') : 0, display: 'flex', gap: '32px', alignItems: 'flex-start' }}>

        {/* ── 좌측 본문 ── */}
        <div className="detail-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* 이미지 캐러셀 */}
          <div className="detail-image-section" style={{ background: '#fff', overflow: 'hidden', border: '1px solid #e0e0e0', position: 'relative' }}>
            {hasImages ? (
              <>
                <div
                  className="detail-carousel-img"
                  style={{ position: 'relative', height: '600px', overflow: 'hidden' }}
                  onTouchStart={(e) => { carouselTouchX.current = e.touches[0].clientX; }}
                  onTouchEnd={(e) => {
                    if (carouselTouchX.current === null) return;
                    const dx = e.changedTouches[0].clientX - carouselTouchX.current;
                    carouselTouchX.current = null;
                    if (images.length > 1 && Math.abs(dx) > 50) {
                      dx < 0 ? nextImage() : prevImage();
                    }
                  }}
                >
                  <img src={images[currentImage]} alt="매물 이미지" onClick={() => setShowLightbox(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} />
                  {/* 좌측 상단: 매물번호 */}
                  <div className="detail-pnum" style={{ position: 'absolute', top: '14px', left: '14px', background: 'rgba(100,100,100,0.55)', color: '#fff', fontSize: '18px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', zIndex: 2 }}>
                    매물번호 {property.property_number ?? id}
                  </div>
                  {isNewProperty(property.created_at) && (
                    <div style={{ position: 'absolute', top: 0, right: 0, width: isMobile ? '70px' : '140px', height: isMobile ? '70px' : '140px', overflow: 'hidden', pointerEvents: 'none', zIndex: 3 }}>
                      <div style={{ position: 'absolute', top: isMobile ? '14px' : '28px', right: isMobile ? '-22px' : '-44px', transform: 'rotate(45deg)', background: '#e05050', color: '#fff', textAlign: 'center', padding: isMobile ? '3px 0' : '6px 0', width: isMobile ? '90px' : '180px', fontSize: isMobile ? '10px' : '18px', fontWeight: 800, letterSpacing: isMobile ? '1px' : '2px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
                        NEW
                      </div>
                    </div>
                  )}
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
                  <div className="detail-carousel-thumbs" style={{ display: 'flex', gap: '6px', padding: '10px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', flexWrap: 'nowrap', scrollbarWidth: 'none' }}>
                    {thumbnails.map((thumb, i) => (
                      <div key={i} onClick={() => setCurrentImage(i)} className="detail-carousel-thumb" style={{ flexShrink: 0, width: '80px', minWidth: '80px', height: '80px', cursor: 'pointer', overflow: 'hidden', border: currentImage === i ? '2px solid #e2a06e' : '2px solid #e0e0e0', transition: 'border 0.2s' }}>
                        <img src={thumb} alt={`썸네일${i + 1}`} style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ width: '100%', height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', position: 'relative', overflow: 'hidden' }}>
                <span style={{ color: '#e2a06e', fontSize: 'clamp(10px, 2vw, 20px)', fontWeight: 300, letterSpacing: 'clamp(2px, 0.5vw, 6px)', fontFamily: 'Georgia, "Times New Roman", serif', opacity: 0.7, whiteSpace: 'nowrap' }}>HERMANN REALTY</span>
                <span style={{ color: '#e2a06e', fontSize: 'clamp(8px, 1.2vw, 12px)', letterSpacing: 'clamp(1px, 0.3vw, 3px)', marginTop: '4px', opacity: 0.5, whiteSpace: 'nowrap' }}>헤르만부동산</span>
                <div className="detail-pnum" style={{ position: 'absolute', top: '14px', left: '14px', background: 'rgba(100,100,100,0.55)', color: '#fff', fontSize: '18px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', zIndex: 2 }}>
                  매물번호 {property.property_number ?? id}
                </div>
                {isNewProperty(property.created_at) && (
                  <div style={{ position: 'absolute', top: 0, right: 0, width: isMobile ? '70px' : '140px', height: isMobile ? '70px' : '140px', overflow: 'hidden', pointerEvents: 'none', zIndex: 3 }}>
                    <div style={{ position: 'absolute', top: isMobile ? '14px' : '28px', right: isMobile ? '-22px' : '-44px', transform: 'rotate(45deg)', background: '#e05050', color: '#fff', textAlign: 'center', padding: isMobile ? '3px 0' : '6px 0', width: isMobile ? '90px' : '180px', fontSize: isMobile ? '10px' : '18px', fontWeight: 800, letterSpacing: isMobile ? '1px' : '2px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
                      NEW
                    </div>
                  </div>
                )}
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
            {openInfo && property.title && (
              <p className="detail-info-title" style={{ color: '#e2a06e', fontSize: '15px', fontWeight: 700, margin: '4px 0 12px', lineHeight: 1.4 }}>
                {property.title}
              </p>
            )}
            {openInfo && (
              <table className="detail-info-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {(() => {
                    const labelTd: React.CSSProperties = { width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '13px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' };
                    const valTd: React.CSSProperties = { padding: '12px 16px', fontSize: '15px', color: '#333', fontWeight: 700 };
                    const rowSt: React.CSSProperties = { borderBottom: '1px solid #f0f0f0' };
                    const addrCell = (
                      property.address ? (
                        <>
                          {isAdmin ? normalizeAddr(property.address ?? '') : formatAddressLong(property.address ?? '')}
                          {isAdmin && (property.building_name || property.unit_number) && (
                            <span style={{ color: '#e2a06e', fontSize: '13px', fontWeight: 600, marginLeft: '4px' }}>
                              {formatBuildingUnit(property.building_name, property.unit_number)}
                            </span>
                          )}
                        </>
                      ) : '-'
                    );
                    const priceCell = buildPriceStr(property);
                    const premiumCell = property.premium ? (isAdmin ? formatPrice(property.premium) : '협의') : '무권리';
                    const maintCell = property.maintenance_fee ? formatPrice(property.maintenance_fee) : '없음';
                    const areaCell = (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {property.supply_area && (
                          <span>공급 {property.supply_area}㎡ ({toPyeong(parseFloat(property.supply_area))}평)</span>
                        )}
                        {property.exclusive_area && (
                          <span>전용 {property.exclusive_area}㎡ ({toPyeong(parseFloat(property.exclusive_area))}평)</span>
                        )}
                        {!property.supply_area && !property.exclusive_area && '-'}
                      </div>
                    );
                    const floorCell = [property.current_floor && formatFloor(property.current_floor), property.total_floor && `전체 ${formatFloor(property.total_floor)}`].filter(Boolean).join(' / ') || '-';
                    const roomBathroomCell = `${property.room_count != null ? property.room_count : '-'}개 / ${property.bathroom_count != null ? property.bathroom_count : '-'}개`;
                    const parkingCountCell = `${property.total_parking != null ? property.total_parking : '-'}대`;
                    const availableDateCell = (() => {
                      const v = property.available_date;
                      if (!v) return '-';
                      const parts = v.split('/').map(s => s.trim()).filter(Boolean);
                      return parts.length > 0 ? parts.join(' / ') : '-';
                    })();
                    const parkingCell = property.parking === true || property.parking === '가능' ? '가능' : property.parking === false || property.parking === '불가' ? '불가' : property.parking ?? '-';
                    const elevatorCell = property.elevator === true || property.elevator === '있음' ? '있음' : property.elevator === false || property.elevator === '없음' ? '없음' : property.elevator ?? '-';

                    if (isMobile) {
                      return (
                        <>
                          <tr style={rowSt}><td style={labelTd}>주소</td><td style={{ ...valTd, fontSize: '13px' }}>{addrCell}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>매물종류</td><td style={valTd}>{property.property_type ?? '-'}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>거래유형</td><td style={valTd}>{property.transaction_type ?? '-'}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>금액</td><td style={{ ...valTd, fontSize: '16px', color: '#e2a06e' }}>{priceCell}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>권리금</td><td style={{ ...valTd, fontSize: '16px', color: property.premium ? '#333' : '#E53935' }}>{premiumCell}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>관리비</td><td style={valTd}>{maintCell}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>면적</td><td style={valTd}>{areaCell}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>층수</td><td style={valTd}>{floorCell}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>총 주차대수</td><td style={valTd}>{parkingCountCell}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>방수/욕실수</td><td style={valTd}>{roomBathroomCell}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>방향</td><td style={valTd}>{property.direction ?? '-'}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>입주가능일</td><td style={valTd}>{availableDateCell}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>주차</td><td style={valTd}>{parkingCell}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>엘리베이터</td><td style={valTd}>{elevatorCell}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>용도</td><td style={valTd}>{property.usage_type ?? '-'}</td></tr>
                          <tr style={rowSt}><td style={labelTd}>사용승인일</td><td style={valTd}>{property.approval_date ?? '-'}</td></tr>
                          <tr><td style={labelTd}>테마종류</td><td style={valTd}>{property.theme_types ?? property.theme_type ?? '-'}</td></tr>
                        </>
                      );
                    }

                    return (
                      <>
                        {/* 1행: 주소 | 매물종류 */}
                        <tr style={rowSt}>
                          <td style={labelTd}>주소</td>
                          <td style={{ ...valTd, fontSize: '13px' }}>{addrCell}</td>
                          <td style={labelTd}>매물종류</td>
                          <td style={valTd}>{property.property_type ?? '-'}</td>
                        </tr>
                        {/* 2행: 거래유형 | 금액 */}
                        <tr style={rowSt}>
                          <td style={labelTd}>거래유형</td>
                          <td style={valTd}>{property.transaction_type ?? '-'}</td>
                          <td style={labelTd}>금액</td>
                          <td style={{ ...valTd, fontSize: '16px', color: '#e2a06e' }}>{priceCell}</td>
                        </tr>
                        {/* 3행: 권리금 | 관리비 */}
                        <tr style={rowSt}>
                          <td style={labelTd}>권리금</td>
                          <td style={{ ...valTd, fontSize: '16px', color: property.premium ? '#333' : '#E53935' }}>{premiumCell}</td>
                          <td style={labelTd}>관리비</td>
                          <td style={valTd}>{maintCell}</td>
                        </tr>
                        {/* 4행: 면적 | 층수 */}
                        <tr style={rowSt}>
                          <td style={labelTd}>면적</td>
                          <td style={valTd}>{areaCell}</td>
                          <td style={labelTd}>층수</td>
                          <td style={valTd}>{floorCell}</td>
                        </tr>
                        <tr style={rowSt}>
                          <td style={labelTd}>총 주차대수</td>
                          <td style={valTd}>{parkingCountCell}</td>
                          <td style={labelTd}>방수/욕실수</td>
                          <td style={valTd}>{roomBathroomCell}</td>
                        </tr>
                        {/* 5행: 방향 | 입주가능일 */}
                        <tr style={rowSt}>
                          <td style={labelTd}>방향</td>
                          <td style={valTd}>{property.direction ?? '-'}</td>
                          <td style={labelTd}>입주가능일</td>
                          <td style={valTd}>{availableDateCell}</td>
                        </tr>
                        {/* 6행: 주차 | 엘리베이터 */}
                        <tr style={rowSt}>
                          <td style={labelTd}>주차</td>
                          <td style={valTd}>{parkingCell}</td>
                          <td style={labelTd}>엘리베이터</td>
                          <td style={valTd}>{elevatorCell}</td>
                        </tr>
                        {/* 7행: 용도 | 사용승인일 */}
                        <tr style={rowSt}>
                          <td style={labelTd}>용도</td>
                          <td style={valTd}>{property.usage_type ?? '-'}</td>
                          <td style={labelTd}>사용승인일</td>
                          <td style={valTd}>{property.approval_date ?? '-'}</td>
                        </tr>
                        {/* 8행: 테마종류 */}
                        <tr>
                          <td style={labelTd}>테마종류</td>
                          <td colSpan={3} style={valTd}>{property.theme_types ?? property.theme_type ?? '-'}</td>
                        </tr>
                      </>
                    );
                  })()}
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
            <div className="print-hide" style={{ background: '#fffdf0', border: '1px solid #f0e6b8', padding: '16px', borderRadius: '4px' }}>
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
            <div className="print-hide" style={{ background: '#f0f6ff', border: '1px solid #c6dcf3', padding: '16px', borderRadius: '4px' }}>
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
          <div id="section-similar" className="detail-section" style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px', marginBottom: 0 }}>
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
                      <div style={{ aspectRatio: '4/3', overflow: 'hidden', background: '#f0f0f0', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'rgba(100,100,100,0.6)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', zIndex: 2 }}>
                          {p.property_number}
                        </div>
                        {p.image ? (
                          <>
                            <img src={p.image} alt="매물 이미지" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0.45, overflow: 'hidden' }}>
                              <span style={{ color: '#e2a06e', fontSize: 'clamp(10px, 2vw, 18px)', fontWeight: 300, letterSpacing: 'clamp(2px, 0.5vw, 6px)', fontFamily: 'Georgia, "Times New Roman", serif', whiteSpace: 'nowrap' }}>HERMANN REALTY</span>
                              <span style={{ color: '#e2a06e', fontSize: 'clamp(8px, 1.2vw, 10px)', letterSpacing: 'clamp(1px, 0.3vw, 3px)', marginTop: '4px', whiteSpace: 'nowrap' }}>헤르만부동산</span>
                            </div>
                          </>
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', overflow: 'hidden' }}>
                            <span style={{ color: '#e2a06e', fontSize: 'clamp(10px, 2vw, 18px)', fontWeight: 300, letterSpacing: 'clamp(2px, 0.5vw, 6px)', fontFamily: 'Georgia, "Times New Roman", serif', opacity: 0.7, whiteSpace: 'nowrap' }}>HERMANN REALTY</span>
                            <span style={{ color: '#e2a06e', fontSize: 'clamp(8px, 1.2vw, 10px)', letterSpacing: 'clamp(1px, 0.3vw, 3px)', marginTop: '4px', opacity: 0.5, whiteSpace: 'nowrap' }}>헤르만부동산</span>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
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
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '2px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {p.premium ? (
                            <span style={{ fontSize: '12px', color: '#e05050', fontWeight: 600 }}>권리금 {isAdmin ? formatPrice(p.premium) : '협의'}</span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#e05050', fontWeight: 600 }}>무권리</span>
                          )}
                          {p.maintenance_fee && p.maintenance_fee !== 0 ? (
                            <span style={{ fontSize: '12px', color: '#888' }}>관리비 {formatPrice(p.maintenance_fee)}</span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#888' }}>관리비 -</span>
                          )}
                        </div>
                        <p style={{ fontSize: '12px', color: '#888', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isAdmin ? normalizeAddr(p.address ?? '') : formatAddressLong(p.address ?? '')}
                        </p>
                        <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
                          {[p.property_type, p.exclusive_area ? `${p.exclusive_area}㎡${pyeong ? ` (${pyeong}평)` : ''}` : null, p.current_floor ? `${p.current_floor}층` : null].filter(Boolean).join(' · ')}
                        </p>
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
          <div className="detail-aside-card" style={{ background: '#fff', border: '1px solid #ddd', padding: '6px 12px' }}>
            <div className="detail-aside-info">
              <p className="aside-pnum" style={{ background: '#f0f0f0', fontSize: '12px', color: '#555', padding: '4px 8px', display: 'inline-block', borderRadius: '3px', marginBottom: '2px' }}>
                매물번호 {property.property_number ?? id}
              </p>
              <div className="aside-price-row" style={{ marginBottom: '4px' }}>
                <p className="aside-price" style={{ fontSize: '22px', fontWeight: 700, color: '#e2a06e', lineHeight: 1.5, marginBottom: '4px' }}>
                  {buildPriceStr(property)}
                </p>
                <div className="aside-sub" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="aside-sub-premium" style={{ fontSize: '13px', fontWeight: 700, color: '#e05050' }}>
                    {property.premium ? (isAdmin ? `권리금 ${formatPrice(property.premium)}` : '권리금 협의') : '무권리'}
                  </span>
                  {property.maintenance_fee && (
                    <>
                      <span className="aside-sub-divider" style={{ color: '#ddd', fontSize: '13px' }}>|</span>
                      <span className="aside-sub-maintenance" style={{ fontSize: '13px', color: '#999' }}>관리비 {formatPrice(property.maintenance_fee)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="aside-addr-row" style={{ marginBottom: 0, paddingBottom: 0 }}>
                <p style={{ fontSize: '13px', color: '#444', marginBottom: '4px' }}>
                  📍 {property.address ? (
                    <>
                      {isAdmin ? normalizeAddr(property.address ?? '') : formatAddressLong(property.address ?? '')}
                      {isAdmin && (property.building_name || property.unit_number) && (
                        <span style={{ color: '#e2a06e', fontSize: '13px', fontWeight: 600, marginLeft: '4px' }}>
                          {formatBuildingUnit(property.building_name, property.unit_number)}
                        </span>
                      )}
                    </>
                  ) : '-'}
                </p>
                <p style={{ fontSize: '16px', color: '#666' }}>
                  {[property.property_type, property.exclusive_area && `전용 ${property.exclusive_area}㎡ (${toPyeong(parseFloat(property.exclusive_area))}평)`, property.current_floor && formatFloor(property.current_floor)].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <div className="aside-cta-row" style={{ display: 'flex', gap: '8px' }}>
              <button
                className="cta-inquiry"
                onClick={() => setShowInquiryModal(true)}
                style={{ flex: 1, height: '52px', background: '#e2a06e', color: '#fff', fontSize: '18px', fontWeight: 700, border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#A06828')}
                onMouseLeave={e => (e.currentTarget.style.background = '#e2a06e')}
              >
                매물 문의하기
              </button>
              <button
                className="cta-share"
                onClick={async () => {
                  const url = `${window.location.origin}${window.location.pathname}`;
                  const showMsg = (msg: string) => {
                    setShareToast(msg);
                    setTimeout(() => setShareToast(''), 2000);
                  };
                  const fallback = () => {
                    try {
                      const ta = document.createElement('textarea');
                      ta.value = url;
                      ta.style.position = 'fixed';
                      ta.style.left = '-9999px';
                      document.body.appendChild(ta);
                      ta.select();
                      const ok = document.execCommand('copy');
                      document.body.removeChild(ta);
                      return ok;
                    } catch { return false; }
                  };
                  try {
                    if (navigator.clipboard && window.isSecureContext) {
                      await navigator.clipboard.writeText(url);
                      showMsg('링크가 복사되었습니다');
                      return;
                    }
                  } catch {
                    // fall through
                  }
                  showMsg(fallback() ? '링크가 복사되었습니다' : '링크 복사에 실패했습니다');
                }}
                aria-label="링크 복사"
                style={{ width: '52px', height: '52px', flexShrink: 0, background: '#f3f4f6', color: '#374151', border: '1px solid #f3f4f6', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#e5e7eb')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f3f4f6')}
                title="링크 복사"
              >
                <LinkIcon size={22} strokeWidth={2.2} />
                <span className="cta-share-label" style={{ display: 'none' }}>링크 복사</span>
              </button>
            </div>
          </div>

          {/* 공인중개사 카드 */}
          <div className="detail-aside-agent" style={{ background: '#fff', border: '1px solid #ddd', padding: '16px' }}>
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
          <div className="admin-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a
                href={`/admin/properties/${property.property_number}/edit`}
                style={{ flex: 1, minWidth: '90px', display: 'block', textAlign: 'center', padding: '12px', background: '#f8f8f8', border: '1px solid #e2a06e', borderRadius: '4px', color: '#e2a06e', fontSize: '15px', fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}
              >
                매물 수정
              </a>
              <button
                onClick={() => window.print()}
                style={{ flex: 1, minWidth: '90px', padding: '12px', background: '#1a1a1a', color: '#e2a06e', border: '1px solid #1a1a1a', borderRadius: '4px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                title="인쇄하기"
              >
                <Printer size={16} strokeWidth={2.2} />
                인쇄
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`매물 ${property.property_number}을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
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
                  window.scrollTo(0, 0);
                  if (window.history.length > 1) {
                    router.back();
                  } else {
                    router.push('/properties');
                  }
                }}
                style={{ flex: 1, minWidth: '90px', padding: '12px', background: '#fff', border: '1px solid #e05050', borderRadius: '4px', color: '#e05050', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
              >
                매물 삭제
              </button>
            </div>
          )}

        </aside>

      </div>

      {/* ── 인쇄 전용 푸터 (화면에서는 숨김) ── */}
      <div className="print-only print-footer">
        <div className="print-footer-left">
          <div>사무소: 부천시 신흥로 223 101동 712호</div>
          <div>등록번호: 제41192-2024-00113호</div>
          <div className="print-date">인쇄일: {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}</div>
        </div>
        <div className="print-footer-right">
          <div className="print-footer-name">헤르만부동산</div>
          <div className="print-footer-phone">010-8680-8151</div>
        </div>
      </div>

      {/* 모바일 우측 하단 FAB (뒤로가기 + 위로이동) */}
      <div
        className="detail-mobile-fab"
        style={{
          display: 'none',
          position: 'fixed', bottom: 'calc(50% - 60px)', right: '16px',
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
          onClick={() => { window.scrollTo(0, 0); router.back(); }}
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
            bottom: '50%',
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

      {/* 태블릿용 뒤로가기 */}
      <button
        className="detail-pc-back-btn"
        onClick={() => { window.scrollTo(0, 0); router.back(); }}
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 'calc(50% - 60px)',
          right: '40px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'rgba(100,100,100,0.5)',
          color: '#fff',
          border: 'none',
          fontSize: '18px',
          cursor: 'pointer',
          zIndex: 999,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ←
      </button>

      {/* 공유 토스트 */}
      {shareToast && (
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? '180px' : '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(26,26,26,0.92)',
            color: '#e2a06e',
            padding: '10px 18px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            zIndex: 10000,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          {shareToast}
        </div>
      )}

      {/* 매물 문의 모달 */}
      {showInquiryModal && (
        <div
          onClick={() => setShowInquiryModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '16px',
              padding: '28px 24px', width: '100%', maxWidth: '360px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>매물 문의하기</h3>
              <button onClick={() => setShowInquiryModal(false)} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#aaa', cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ fontSize: '13px', color: '#999', marginBottom: '20px' }}>원하시는 방법으로 문의해 주세요</p>

            <div style={{ background: '#f8f8f8', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>대표 공인중개사 황정아</p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#e2a06e' }}>010-8680-8151</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href="tel:010-8680-8151"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', background: '#e2a06e', color: '#fff', fontSize: '16px', fontWeight: 700, borderRadius: '10px', textDecoration: 'none' }}
              >
                📞 전화 문의하기
              </a>
              <a
                href="sms:010-8680-8151"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', background: '#fff', color: '#e2a06e', fontSize: '16px', fontWeight: 700, borderRadius: '10px', textDecoration: 'none', border: '1.5px solid #e2a06e' }}
              >
                💬 문자 문의하기
              </a>
              <a
                href="https://open.kakao.com/o/s3lwiwsh"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', background: '#FEE500', color: '#3C1E1E', fontSize: '16px', fontWeight: 700, borderRadius: '10px', textDecoration: 'none' }}
              >
                💛 카카오톡 문의
              </a>
            </div>
          </div>
        </div>
      )}


      {/* ── 이미지 라이트박스 ── */}
      {showLightbox && hasImages && (
        <div
          onClick={() => setShowLightbox(false)}
          onTouchStart={(e) => { lightboxTouchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (lightboxTouchX.current === null) return;
            const dx = e.changedTouches[0].clientX - lightboxTouchX.current;
            lightboxTouchX.current = null;
            if (Math.abs(dx) > 50) { dx < 0 ? nextImage() : prevImage(); }
          }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, cursor: 'zoom-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', display: 'inline-flex', maxWidth: '92vw', maxHeight: '92vh' }}
          >
            <img
              src={images[currentImage]}
              alt={`매물 이미지 ${currentImage + 1}`}
              style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', userSelect: 'none', cursor: 'default' }}
            />
            <div className="lightbox-watermark" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.55, pointerEvents: 'none' }}>
              <span className="lightbox-watermark-main" style={{ color: '#e2a06e', fontSize: '40px', fontWeight: 300, letterSpacing: '8px', fontFamily: 'Georgia, "Times New Roman", serif' }}>HERMANN REALTY</span>
              <span className="lightbox-watermark-sub" style={{ color: '#e2a06e', fontSize: '20px', fontWeight: 400, letterSpacing: '4px', marginTop: '8px' }}>헤르만부동산</span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowLightbox(false); }}
            aria-label="닫기"
            style={{
              position: 'fixed', top: '20px', right: '20px',
              width: '44px', height: '44px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', color: '#fff',
              border: 'none', fontSize: '26px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >×</button>
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                aria-label="이전 이미지"
                style={{
                  position: 'fixed', left: '16px', top: '50%', transform: 'translateY(-50%)',
                  width: '50px', height: '50px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)', color: '#fff',
                  border: 'none', fontSize: '28px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                }}
              >‹</button>
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                aria-label="다음 이미지"
                style={{
                  position: 'fixed', right: '16px', top: '50%', transform: 'translateY(-50%)',
                  width: '50px', height: '50px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)', color: '#fff',
                  border: 'none', fontSize: '28px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                }}
              >›</button>
              <div style={{
                position: 'fixed', bottom: '20px', left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.15)', color: '#fff',
                padding: '6px 14px', borderRadius: '20px', fontSize: '14px',
                backdropFilter: 'blur(4px)',
              }}>
                {currentImage + 1} / {images.length}
              </div>
            </>
          )}
        </div>
      )}

    </main>
  );
}
