'use client';

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { isNewProperty } from '@/lib/isNewProperty';
import ThemeBadges from '@/components/ThemeBadges';
import { formatMaintenance } from '@/lib/formatProperty';

declare global {
  interface Window { kakao: any; }
}

// ── 유틸 ────────────────────────────────────────────────────
const normalizeAddr = (addr: string) =>
  addr.replace(/^경기\s/, '경기도 ').replace(/^서울\s/, '서울특별시 ');

const formatAddress = (addr: string) => {
  if (!addr) return '';
  const normalized = addr.replace(/^경기\s/, '경기도 ');
  const roadMatch = normalized.match(/^(.*?(?:시|군|구)\s+\S+(?:로|길))/);
  if (roadMatch) return roadMatch[1];
  const dongMatch = normalized.match(/^(.*?[가-힣]+동)/);
  if (dongMatch) return dongMatch[1];
  return normalized;
};

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

const toPyeong = (sqm: number | string) => {
  const n = typeof sqm === 'string' ? parseFloat(sqm) : sqm;
  if (!n || isNaN(n)) return null;
  return (n * 0.3025).toFixed(1);
};

const matchArea = (exclusive_area: any, range: string) => {
  if (range === '전체') return true;
  const py = parseFloat(exclusive_area) * 0.3025;
  if (isNaN(py)) return false;
  if (range === '10평 이하')  return py <= 10;
  if (range === '10~20평')    return py > 10 && py <= 20;
  if (range === '20~30평')    return py > 20 && py <= 30;
  if (range === '30~40평')    return py > 30 && py <= 40;
  if (range === '40~50평')    return py > 40 && py <= 50;
  if (range === '50평 이상')  return py > 50;
  return true;
};

// ── 상수 ────────────────────────────────────────────────────
const TX_TYPES    = ['전체', '월세', '전세', '매매'];
const DEPOSIT_RANGES = ['전체', '1천만원 이하', '1천~3천만원', '3천~5천만원', '5천만원~1억', '1억 이상'];
const RENT_RANGES = ['전체', '50만원 이하', '50~100만원', '100~200만원', '200만원 이상'];

const matchDeposit = (deposit: any, range: string) => {
  if (range === '전체') return true;
  const v = Number(deposit);
  if (isNaN(v)) return false;
  if (range === '1천만원 이하') return v <= 1000;
  if (range === '1천~3천만원') return v > 1000 && v <= 3000;
  if (range === '3천~5천만원') return v > 3000 && v <= 5000;
  if (range === '5천만원~1억') return v > 5000 && v <= 10000;
  if (range === '1억 이상') return v > 10000;
  return true;
};

const matchRent = (rent: any, range: string) => {
  if (range === '전체') return true;
  const v = Number(rent);
  if (isNaN(v)) return false;
  if (range === '50만원 이하') return v <= 50;
  if (range === '50~100만원') return v > 50 && v <= 100;
  if (range === '100~200만원') return v > 100 && v <= 200;
  if (range === '200만원 이상') return v > 200;
  return true;
};
const PROP_TYPES  = ['', '상가', '사무실', '오피스텔', '아파트', '건물', '기타'];
const AREA_RANGES = ['전체', '10평 이하', '10~20평', '20~30평', '30~40평', '40~50평', '50평 이상'];
const THEME_TYPES = ['전체', '추천매물', '사옥형및통임대', '대형상가', '대형사무실', '무권리상가', '프랜차이즈양도양수', '1층상가', '2층이상상가'];

// ── 지도 상태 sessionStorage 복원 ─────────────────────────────
const MAP_STATE_KEY = 'hermann-map-state-v1';

type SavedMapState = {
  center?: { lat: number; lng: number };
  level?: number;
  drawerOpen?: boolean;
  drawerHeight?: number;
  topPropertyNumber?: string | null;
  filters?: Record<string, string>;
};

function readMapState(): SavedMapState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(MAP_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveMapState(partial: SavedMapState) {
  if (typeof window === 'undefined') return;
  try {
    const prev = readMapState() ?? {};
    sessionStorage.setItem(MAP_STATE_KEY, JSON.stringify({ ...prev, ...partial }));
  } catch { /* quota / private mode 등 무시 */ }
}

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function MapPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩중...</div>}>
      <MapPageInner />
    </Suspense>
  );
}

function MapPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const readParam = (key: string, fallback: string) => searchParams.get(key) || fallback;

  // refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapObjRef       = useRef<any>(null);
  const clustererRef    = useRef<any>(null);
  const markersRef      = useRef<any[]>([]);
  const listRef         = useRef<HTMLDivElement>(null);
  const cardRefs        = useRef<Record<string, HTMLDivElement | null>>({});
  const drawerRef       = useRef<HTMLDivElement>(null);
  const handleBarRef    = useRef<HTMLDivElement>(null);
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [snapIndex, setSnapIndex] = useState(0);

  // state
  const [properties, setProperties]     = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [mapReady, setMapReady]         = useState(false);
  const [headerH, setHeaderH]           = useState(144);
  const [highlightId, setHighlightId]   = useState<string | null>(null);
  const [visibleIds, setVisibleIds]     = useState<Set<string> | null>(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [drawerDragY, setDrawerDragY]   = useState(0);
  const [drawerHeight, setDrawerHeight] = useState<number>(45); // vh 단위
  const [topPropertyNumber, setTopPropertyNumber] = useState<string | null>(null);
  const drawerStartY = useRef(0);
  const drawerDragRef = useRef(0);


  // 새로고침이 아니라 다른 페이지에서 들어온 경우 → 지도 sessionStorage 초기화
  // (이 effect는 다른 useEffect보다 먼저 선언되어 우선 실행됨)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const navType = navEntries[0]?.type;
      if (navType && navType !== 'reload') {
        sessionStorage.removeItem(MAP_STATE_KEY);
        console.log('[map] 일반 진입 감지 — 지도 상태 초기화');
      } else {
        console.log('[map] 새로고침 감지 — 지도 상태 유지');
      }
    } catch (err) {
      console.warn('[map] navigation type 조회 실패:', err);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAdmin(!!data.user));
  }, []);

  useEffect(() => {
    const check = () => {
      // window.innerWidth < 768 직접 비교 (기존 방식 유지)
      setIsMobile(window.innerWidth < 768);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  useEffect(() => {
    console.log('[map] isMobile state 변경:', isMobile);
  }, [isMobile]);

  useEffect(() => {
    console.log('[map] 드로어 상태 — open:', drawerOpen, 'height:', drawerHeight, 'topProperty:', topPropertyNumber);
  }, [drawerOpen, drawerHeight, topPropertyNumber]);

  // 필터 바 가로 스크롤 힌트
  useEffect(() => {
    const el = filterScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const isEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
      setShowScrollHint(!isEnd);
    };
    onScroll();
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // isMobile 변경 시 지도 relayout + 중심 재설정
  useEffect(() => {
    if (!mapObjRef.current) return;
    const timer = setTimeout(() => {
      const map = mapObjRef.current;
      if (!map) return;
      const center = map.getCenter();
      map.relayout();
      if (center) map.setCenter(center);
    }, 300);
    return () => clearTimeout(timer);
  }, [isMobile]);

  // 모바일에서 body 스크롤 막기
  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isMobile]);

  // 모바일 드로어 초기 위치/스타일 직접 설정
  useEffect(() => {
    if (!drawerRef.current) return;
    const isMob = window.innerWidth < 768;
    if (isMob) {
      const el = drawerRef.current;
      el.style.position = 'fixed';
      el.style.bottom = '60px';
      el.style.top = 'auto';
      el.style.left = '0';
      el.style.right = '0';
      el.style.width = '100%';
      el.style.height = '72px';
      el.style.zIndex = '300';
      el.style.borderRadius = '16px 16px 0 0';
      el.style.boxShadow = '0 -4px 20px rgba(0,0,0,0.15)';
      el.style.borderLeft = 'none';
    }
  }, [isMobile]);

  // 드로어 핸들바 탭 (3단계 스냅 순환) — 마우스용
  const handleHandleTap = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!drawerRef.current) return;
    const snapPoints = [72, Math.round(window.innerHeight * 0.45), Math.round(window.innerHeight * 0.7)];
    const nextIndex = (snapIndex + 1) % snapPoints.length;
    setSnapIndex(nextIndex);
    drawerRef.current.style.transition = 'height 0.3s ease';
    drawerRef.current.style.height = snapPoints[nextIndex] + 'px';
  };

  // 핸들바 터치 — passive: false 로 네이티브 등록
  useEffect(() => {
    const el = handleBarRef.current;
    if (!el) return;
    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const snapPoints = [72, Math.round(window.innerHeight * 0.45), Math.round(window.innerHeight * 0.7)];
      setSnapIndex(prev => {
        const nextIndex = (prev + 1) % snapPoints.length;
        if (drawerRef.current) {
          drawerRef.current.style.transition = 'height 0.3s ease';
          drawerRef.current.style.height = snapPoints[nextIndex] + 'px';
        }
        return nextIndex;
      });
    };
    el.addEventListener('touchstart', onTouch, { passive: false });
    return () => el.removeEventListener('touchstart', onTouch);
  }, []);

  // 드로어 열릴 때 body 스크롤 막기
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const [searchInput, setSearchInput]   = useState(readParam('search', ''));
  const [search, setSearch]             = useState(readParam('search', ''));
  const [filterTx, setFilterTx]         = useState(readParam('tx', '전체'));
  const [filterType, setFilterType]     = useState(readParam('type', ''));
  const [filterArea, setFilterArea]     = useState(readParam('area', '전체'));
  const [filterTheme, setFilterTheme]   = useState(readParam('theme', '전체'));
  const [filterDeposit, setFilterDeposit] = useState(readParam('deposit', '전체'));
  const [filterRent, setFilterRent]     = useState(readParam('rent', '전체'));

  const syncURL = useCallback((overrides: Record<string, string> = {}) => {
    const vals: Record<string, string> = {
      search, tx: filterTx, type: filterType, area: filterArea, theme: filterTheme, deposit: filterDeposit, rent: filterRent,
      ...overrides,
    };
    const params = new URLSearchParams();
    Object.entries(vals).forEach(([k, v]) => {
      if (v && v !== '전체' && v !== '') params.set(k, v);
    });
    const qs = params.toString();
    router.replace(`/map${qs ? '?' + qs : ''}`, { scroll: false });
  }, [search, filterTx, filterType, filterArea, filterTheme, filterDeposit, filterRent, router]);

  // 뒤로가기 시 URL → state 동기화
  useEffect(() => {
    setSearchInput(readParam('search', ''));
    setSearch(readParam('search', ''));
    setFilterTx(readParam('tx', '전체'));
    setFilterType(readParam('type', ''));
    setFilterArea(readParam('area', '전체'));
    setFilterTheme(readParam('theme', '전체'));
    setFilterDeposit(readParam('deposit', '전체'));
    setFilterRent(readParam('rent', '전체'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── sessionStorage: 마운트 시 드로어/상단매물/필터 복원
  useEffect(() => {
    const s = readMapState();
    if (!s) return;
    if (s.drawerOpen !== undefined) setDrawerOpen(s.drawerOpen);
    if (s.drawerHeight !== undefined) setDrawerHeight(s.drawerHeight);
    if (s.topPropertyNumber !== undefined) setTopPropertyNumber(s.topPropertyNumber);

    // 필터: URL 파라미터가 없을 때만 sessionStorage 복원
    const hasUrlParams = Array.from(searchParams?.keys() ?? []).length > 0;
    if (!hasUrlParams && s.filters) {
      if (s.filters.search !== undefined) { setSearch(s.filters.search); setSearchInput(s.filters.search); }
      if (s.filters.filterTx !== undefined) setFilterTx(s.filters.filterTx);
      if (s.filters.filterType !== undefined) setFilterType(s.filters.filterType);
      if (s.filters.filterArea !== undefined) setFilterArea(s.filters.filterArea);
      if (s.filters.filterTheme !== undefined) setFilterTheme(s.filters.filterTheme);
      if (s.filters.filterDeposit !== undefined) setFilterDeposit(s.filters.filterDeposit);
      if (s.filters.filterRent !== undefined) setFilterRent(s.filters.filterRent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── sessionStorage: 드로어/상단매물 저장
  useEffect(() => {
    saveMapState({ drawerOpen, drawerHeight, topPropertyNumber });
  }, [drawerOpen, drawerHeight, topPropertyNumber]);

  // ── sessionStorage: 필터 저장
  useEffect(() => {
    saveMapState({
      filters: { search, filterTx, filterType, filterArea, filterTheme, filterDeposit, filterRent },
    });
  }, [search, filterTx, filterType, filterArea, filterTheme, filterDeposit, filterRent]);

  // ── 헤더 높이 측정
  useEffect(() => {
    const h = document.querySelector('header') as HTMLElement | null;
    if (h) setHeaderH(h.offsetHeight);
  }, []);

  // ── 카카오맵 초기화 (script 동적 삽입)
  useEffect(() => {
    let cancelled = false;

    const createMap = () => {
      if (cancelled || !mapContainerRef.current) return;
      if (mapObjRef.current) { setMapReady(true); console.log('지도 컨테이너 크기:', mapContainerRef.current?.offsetWidth, mapContainerRef.current?.offsetHeight); return; }

      const isMobile = window.innerWidth < 768;
      const saved = readMapState();
      const defaultLat = isMobile ? 37.5040479677868 - 0.02 : 37.5040479677868;
      const defaultLng = 126.77522691726;
      const startLat = saved?.center?.lat ?? defaultLat;
      const startLng = saved?.center?.lng ?? defaultLng;
      const startLevel = saved?.level ?? 7;
      console.log('[map] 초기 view — saved?', !!saved?.center, 'lat:', startLat, 'lng:', startLng, 'level:', startLevel);

      const center = new window.kakao.maps.LatLng(startLat, startLng);
      const map = new window.kakao.maps.Map(mapContainerRef.current, {
        center,
        level: startLevel,
        minLevel: 5,
      });
      mapObjRef.current = map;

      // idle 이벤트 — 드래그/줌 종료 시 sessionStorage에 저장
      window.kakao.maps.event.addListener(map, 'idle', () => {
        const c = map.getCenter();
        saveMapState({ center: { lat: c.getLat(), lng: c.getLng() }, level: map.getLevel() });
      });

      // 크기 재계산 + 중심 재설정 (여러 타이밍에 보장)
      const recenter = () => {
        map.relayout();
        map.setCenter(center);
      };
      setTimeout(recenter, 100);
      setTimeout(recenter, 300);
      setTimeout(recenter, 500);
      // 태블릿 레이아웃 변경 후 추가 recenter
      const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1199;
      if (isTablet) setTimeout(recenter, 1000);

      // 주소 레이어(지번/도로명) 숨기기
      map.removeOverlayMapTypeId(window.kakao.maps.MapTypeId.USE_DISTRICT);

      clustererRef.current = new window.kakao.maps.MarkerClusterer({
        map,
        averageCenter: true,
        minClusterSize: 1,
        disableClickZoom: true,
        styles: [{
          width: '44px', height: '44px',
          background: 'rgba(226,160,110,0.92)',
          borderRadius: '50%',
          color: '#fff',
          textAlign: 'center',
          fontWeight: '700',
          lineHeight: '44px',
          fontSize: '14px',
        }],
      });

      if (!cancelled) { setMapReady(true); console.log('지도 컨테이너 크기:', mapContainerRef.current?.offsetWidth, mapContainerRef.current?.offsetHeight); }
    };

    // 이미 SDK가 로드된 경우 (페이지 재방문 등)
    if (typeof window.kakao?.maps?.Map === 'function') {
      createMap();
      return () => { cancelled = true; };
    }

    // script 태그 동적 생성
    const script = document.createElement('script');
    script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=8a478b4b6ea5e02722a33f6ac2fa34b6&autoload=false&libraries=services,clusterer';
    script.async = true;
    script.onload = () => {
      window.kakao.maps.load(() => {
        if (!cancelled) createMap();
      });
    };
    document.head.appendChild(script);

    return () => { cancelled = true; };
  }, []);

  // ── Supabase fetch
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: props } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      // 각 매물의 이미지를 property_id로 조회
      const withImages = await Promise.all(
        (props ?? []).map(async (p: any) => {
          const { data: imgs } = await supabase
            .from('property_images')
            .select('*')
            .eq('property_id', p.id)
            .order('order_index', { ascending: true })
            .limit(1);
          return { ...p, property_images: imgs ?? [] };
        })
      );
      setProperties(withImages);
      setLoading(false);
    })();
  }, []);

  // ── 필터
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return properties.filter(p => {
      // 보류 매물은 사이트에서 숨김 (관리자는 /admin에서 확인)
      if (p.status === '보류') return false;
      if (filterTx !== '전체' && p.transaction_type !== filterTx) return false;
      if (filterType && p.property_type !== filterType) return false;
      if (!matchArea(p.exclusive_area, filterArea)) return false;
      if (filterTheme !== '전체' && !(p.theme_type ?? '').split(',').includes(filterTheme)) return false;
      if (!matchDeposit(p.deposit, filterDeposit)) return false;
      if (!matchRent(p.monthly_rent, filterRent)) return false;
      if (q && !String(p.address ?? '').toLowerCase().includes(q)
             && !String(p.property_number ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [properties, filterTx, filterType, filterArea, filterTheme, filterDeposit, filterRent, search]);

  // ── 마커 + 원 업데이트
  useEffect(() => {
    if (!mapReady || !mapObjRef.current) return;

    // 지도 크기 재계산
    setTimeout(() => {
      mapObjRef.current?.relayout();
    }, 100);

    // 기존 제거
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    clustererRef.current?.clear();

    const newMarkers: any[] = [];

    filtered
      .filter(p => p.latitude && p.longitude)
      .forEach(p => {
        const position = new window.kakao.maps.LatLng(p.latitude, p.longitude);

        const marker = new window.kakao.maps.Marker({ position });
        (marker as any)._pnum = p.property_number;

        // 클릭/터치 이벤트 공통 핸들러
        const handleMarkerClick = () => {
          console.log('[마커클릭] 실행됨', p.property_number);
          console.log('[마커클릭] mobile:', window.innerWidth < 768);
          setHighlightId(p.property_number);
          if (window.innerWidth < 768) {
            setTopPropertyNumber(p.property_number);
            console.log('[마커클릭] drawerOpen 설정 전');
            setDrawerOpen(true);
            console.log('[마커클릭] drawerOpen 설정 후');
            setDrawerHeight(45);
            console.log('[마커클릭] drawerHeight 설정 후');
            setDrawerDragY(0);
          } else {
            const card = cardRefs.current[p.property_number];
            if (card && listRef.current) {
              listRef.current.scrollTo({ top: card.offsetTop - 16, behavior: 'smooth' });
            }
          }
        };
        window.kakao.maps.event.addListener(marker, 'click', handleMarkerClick);
        window.kakao.maps.event.addListener(marker, 'touchend', handleMarkerClick);

        newMarkers.push(marker);
      });

    markersRef.current = newMarkers;
    clustererRef.current?.addMarkers(newMarkers);

    // 클러스터 클릭 → 클러스터에 속한 매물만 목록 표시 (+ 모바일 드로어 45vh)
    const handleClusterClick = (cluster: any) => {
      console.log('[클러스터클릭] 실행됨');
      // 카카오 클러스터러 공식 API: getMarkers()로 클러스터에 속한 마커만 정확히 가져옴
      // (getBounds()는 영역이 넓어서 다른 매물까지 포함되는 버그 있음)
      const clusterMarkers: any[] = typeof cluster.getMarkers === 'function' ? cluster.getMarkers() : [];
      const ids = new Set<string>();
      clusterMarkers.forEach((m: any) => {
        if (m._pnum) ids.add(m._pnum);
      });
      console.log('[클러스터클릭] 매물 수:', ids.size);
      if (ids.size > 0) setVisibleIds(ids);

      if (window.innerWidth < 768) {
        console.log('[클러스터클릭] 모바일 분기: drawerHeight=45vh, drawerOpen=true');
        setTopPropertyNumber(null);
        setDrawerHeight(45);
        setDrawerDragY(0);
        setDrawerOpen(true);
      }
    };

    if (clustererRef.current) {
      window.kakao.maps.event.addListener(clustererRef.current, 'clusterclick', handleClusterClick);
    }

    return () => {
      if (clustererRef.current) {
        window.kakao.maps.event.removeListener(clustererRef.current, 'clusterclick', handleClusterClick);
      }
    };
  }, [filtered, mapReady]);

  // ── 지도 내 표시 목록
  const displayList = visibleIds
    ? filtered.filter(p => visibleIds.has(p.property_number))
    : filtered;

  // 모바일 드로어: 선택한 매물을 맨 위로 재정렬
  const drawerList = useMemo(() => {
    if (!topPropertyNumber) return displayList;
    const top = displayList.find(p => p.property_number === topPropertyNumber);
    if (!top) return displayList;
    return [top, ...displayList.filter(p => p.property_number !== topPropertyNumber)];
  }, [displayList, topPropertyNumber]);

  // ── 핸들러
  const runSearch = () => { setSearch(searchInput); syncURL({ search: searchInput }); };
  const resetAll  = () => {
    setSearchInput(''); setSearch('');
    setFilterTx('전체'); setFilterType('');
    setFilterArea('전체'); setFilterTheme('전체');
    setFilterDeposit('전체'); setFilterRent('전체');
    setVisibleIds(null);
    syncURL({ search: '', tx: '전체', type: '', area: '전체', theme: '전체', deposit: '전체', rent: '전체' });
  };

  // ── 스타일 상수
  const selectSt: React.CSSProperties = {
    height: '40px', border: '1px solid #ddd', borderRadius: '4px',
    padding: '0 10px', fontSize: '15px', color: '#555',
    background: '#fff', cursor: 'pointer', outline: 'none',
  };

  // ── 렌더
  return (
    <div className="map-container" style={{ height: isMobile ? '100dvh' : `calc(100vh - ${headerH}px)`, width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', background: '#f5f5f5', overflow: 'hidden', paddingBottom: isMobile ? 0 : undefined }}>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 768px) and (max-width: 1199px) {
          .map-container { height: 100vh !important; }
          .map-body { flex-direction: column !important; }
          .map-panel {
            position: static !important;
            width: 100% !important;
            height: 45vh !important;
            overflow-y: auto !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            border-top: 2px solid #e2a06e !important;
            border-left: none !important;
          }
          .map-area { height: 55vh !important; flex-shrink: 0 !important; }
          .map-panel .map-list-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
            padding: 12px !important;
          }
        }
        .map-drawer-handle { display: none; }
        @media (max-width: 1199px) {
          .map-filter-bar { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; scrollbar-width: none !important; flex-wrap: nowrap !important; white-space: nowrap !important; padding: 8px !important; gap: 6px !important; }
          .map-filter-bar::-webkit-scrollbar { display: none !important; }
          .map-filter-bar select { flex-shrink: 0 !important; height: 34px !important; font-size: 12px !important; padding: 0 6px !important; min-width: 90px !important; max-width: 110px !important; }
          .map-filter-bar button { flex-shrink: 0 !important; height: 34px !important; font-size: 12px !important; padding: 0 10px !important; white-space: nowrap !important; }
          .map-filter-bar .map-count { font-size: 13px !important; }
          .map-search-bar { flex-shrink: 0 !important; padding: 0 !important; }
          .map-search-bar input { font-size: 13px !important; height: 36px !important; width: 160px !important; }
          .map-search-bar button { height: 36px !important; font-size: 13px !important; padding: 0 12px !important; }
        }
        @media (max-width: 767px) {
          .map-filter-bar {
            position: sticky !important;
            top: 0 !important;
            z-index: 100 !important;
            background: #fff !important;
            display: flex !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: none !important;
            padding: 6px 8px !important;
            gap: 6px !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .map-filter-bar::-webkit-scrollbar { display: none !important; }
          .map-filter-bar select { flex-shrink: 0 !important; height: 32px !important; font-size: 12px !important; padding: 0 4px !important; min-width: 85px !important; max-width: 100px !important; }
          .map-filter-bar button { flex-shrink: 0 !important; height: 32px !important; font-size: 12px !important; padding: 0 8px !important; white-space: nowrap !important; }
          .map-filter-bar .map-count { display: none !important; }
          .map-container { height: 100dvh !important; }
          .map-body { display: flex !important; flex-direction: column !important; height: 35vh !important; flex-shrink: 0 !important; }
          .map-area { flex: 1 !important; width: 100% !important; height: 35vh !important; min-height: 35vh !important; flex-shrink: 0 !important; }
          .map-panel { display: none !important; }
          .map-body { height: auto !important; flex: 1 !important; }
          .map-area { flex: 1 !important; height: 100% !important; min-height: 0 !important; }
          .map-drawer-handle { display: none !important; }
          .map-drawer-toggle { display: flex !important; }
          .map-card-text { padding: 12px 14px !important; }
          .map-card-text .map-card-pnum { font-size: 11px !important; }
          .map-card-text .map-card-title { font-size: 14px !important; }
          .map-card-text .map-card-addr { font-size: 12px !important; }
          .map-card-text .map-card-detail { font-size: 12px !important; }
        }
      ` }} />

      {/* ════════════ 검색 바 (상단) ════════════ */}
      <div className="map-search-bar-wrap" style={{
        position: 'sticky', top: 0, zIndex: 101,
        background: '#fff', borderBottom: '1px solid #f0f0f0',
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        gap: '8px', flexShrink: 0,
      }}>
        <div className="map-search map-search-bar" style={{ display: 'flex', flex: 1 }}>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSearch()}
            placeholder="지역, 매물종류, 키워드 검색"
            style={{
              flex: 1, minWidth: 0, height: '40px',
              border: '1px solid #ddd', borderRight: 'none',
              borderRadius: '4px 0 0 4px', padding: '0 12px',
              fontSize: '15px', outline: 'none', color: '#333',
            }}
          />
          <button
            onClick={runSearch}
            style={{ height: '40px', padding: '0 16px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '0 4px 4px 0', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
          >
            검색
          </button>
        </div>
      </div>

      {/* ════════════ 필터 바 (하단) ════════════ */}
      <div style={{ position: 'sticky', top: 62, zIndex: 100 }}>
      {isMobile && showScrollHint && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '48px',
          background: 'linear-gradient(to right, transparent, #fff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: '6px',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <span style={{ fontSize: '16px', color: '#aaa' }}>›</span>
        </div>
      )}
      <div ref={filterScrollRef} className="map-filter-bar" style={{
        background: '#fff', borderBottom: '1px solid #e0e0e0',
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        gap: '8px', flexWrap: 'wrap', flexShrink: 0,
        boxShadow: '0 2px 6px rgba(0,0,0,0.07)',
      }}>
        {/* 거래유형 */}
        <select value={filterTx} onChange={e => { setFilterTx(e.target.value); syncURL({ tx: e.target.value }); }} style={selectSt}>
          {TX_TYPES.map(t => <option key={t} value={t}>{t === '전체' ? '거래유형 전체' : t}</option>)}
        </select>

        {/* 매물종류 */}
        <select value={filterType} onChange={e => { setFilterType(e.target.value); syncURL({ type: e.target.value }); }} style={selectSt}>
          <option value="">매물종류 전체</option>
          {PROP_TYPES.filter(t => t).map(t => <option key={t}>{t}</option>)}
        </select>

        {/* 면적 */}
        <select value={filterArea} onChange={e => { setFilterArea(e.target.value); syncURL({ area: e.target.value }); }} style={selectSt}>
          {AREA_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '면적 전체' : t}</option>)}
        </select>

        {/* 테마 */}
        <select value={filterTheme} onChange={e => { setFilterTheme(e.target.value); syncURL({ theme: e.target.value }); }} style={selectSt}>
          {THEME_TYPES.map(t => <option key={t} value={t}>{t === '전체' ? '테마 전체' : t}</option>)}
        </select>

        {/* 보증금 */}
        <select value={filterDeposit} onChange={e => { setFilterDeposit(e.target.value); syncURL({ deposit: e.target.value }); }} style={selectSt}>
          {DEPOSIT_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '보증금 전체' : t}</option>)}
        </select>

        {/* 월세 */}
        <select value={filterRent} onChange={e => { setFilterRent(e.target.value); syncURL({ rent: e.target.value }); }} style={selectSt}>
          {RENT_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '월세 전체' : t}</option>)}
        </select>

        {/* 초기화 */}
        <button
          className="map-reset"
          onClick={resetAll}
          style={{ height: '40px', padding: '0 14px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '15px', color: '#666', background: '#fff', cursor: 'pointer' }}
        >
          초기화
        </button>

        <span className="map-count" style={{ fontSize: '15px', color: '#555', marginLeft: 'auto', flexShrink: 0 }}>
          매물 <strong style={{ color: '#e2a06e' }}>{filtered.length}</strong>개
        </span>
      </div>
      </div>

      {/* ════════════ 2열 본문 ════════════ */}
      <div className="map-body" style={{ display: 'flex', flex: 1, height: isMobile ? '40vh' : '100%', overflow: 'hidden' }}>

        {/* ── 좌측 지도 */}
        <div className="map-area" style={{ flex: 1, height: isMobile ? '40vh' : '100%', position: 'relative', overflow: 'hidden', minHeight: '300px' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

          {/* 모바일 매물수 오버레이 버튼 */}
          <button
            className="map-drawer-toggle"
            onClick={() => {
              console.log('[오버레이클릭] 매물 수 오버레이 클릭됨');
              setDrawerHeight(45);
              setDrawerDragY(0);
              setDrawerOpen(true);
            }}
            style={{
              display: 'none', position: 'fixed', bottom: '70px', right: '16px',
              zIndex: 150, padding: '12px 18px', background: '#e2a06e', color: '#fff',
              fontSize: '14px', fontWeight: 700, border: 'none', borderRadius: '24px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)', cursor: 'pointer',
              alignItems: 'center', gap: '6px',
            }}
          >
            매물 <strong>{displayList.length}</strong>개 목록보기
          </button>

          {!mapReady && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: '#ebebeb', fontSize: '15px', color: '#888',
            }}>
              지도를 불러오는 중...
            </div>
          )}
        </div>

        {/* ── 우측 매물 목록 */}
        <div ref={drawerRef} className="map-panel" style={{ width: '480px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e0e0e0', background: '#fff', overflow: 'hidden' }}>

          {/* 모바일 드래그 핸들바 */}
          <div
            ref={handleBarRef}
            className="map-drawer-handle"
            style={{ padding: '8px 0', cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => handleHandleTap(e)}
          >
            <div style={{ width: '40px', height: '4px', background: '#ddd', borderRadius: '2px', margin: '0 auto' }} />
          </div>

          {/* 헤더 */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>
              {visibleIds ? '선택한 위치 매물' : '지도 내 매물'}&nbsp;<span style={{ color: '#e2a06e' }}>{displayList.length}</span>개
            </span>
            {visibleIds && (
              <button
                onClick={() => setVisibleIds(null)}
                style={{ background: 'none', border: 'none', color: '#e2a06e', fontSize: '15px', fontWeight: 600, cursor: 'pointer', padding: '2px 4px' }}
              >
                전체보기
              </button>
            )}
          </div>

          {/* 카드 리스트 */}
          <div ref={listRef} className="map-list-grid" style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#888', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>⏳</span>
                <p style={{ fontSize: '14px' }}>매물을 불러오는 중...</p>
              </div>
            ) : displayList.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', flexDirection: 'column', gap: '8px', color: '#aaa' }}>
                <span style={{ fontSize: '28px' }}>🏚</span>
                <p style={{ fontSize: '14px', color: '#666', fontWeight: 600 }}>조건에 맞는 매물이 없습니다</p>
              </div>
            ) : (
              displayList.map(p => {
                const thumb    = p.property_images?.[0]?.image_url ?? null;
                const pyeong   = p.exclusive_area ? toPyeong(p.exclusive_area) : null;
                const isHl     = highlightId === p.property_number;
                const price    = buildPriceStr(p);
                const addr     = isAdmin ? normalizeAddr(p.address ?? '') : formatAddress(p.address ?? '');
                const detail   = [
                  p.exclusive_area ? `전용 ${p.exclusive_area}㎡${pyeong ? ` (${pyeong}평)` : ''}` : null,
                  p.current_floor  ? (String(p.current_floor).trim().endsWith('층') ? p.current_floor : `${p.current_floor}층`) : null,
                ].filter(Boolean).join(' · ');

                return (
                  <div
                    key={p.property_number}
                    ref={el => { cardRefs.current[p.property_number] = el; }}
                    style={{ borderBottom: '1px solid #f0f0f0', background: isHl ? '#fff8f2' : '#fff', transition: 'background 0.25s' }}
                  >
                    <Link
                      href={`/item/view/${p.property_number}`}
                      style={{ display: 'flex', gap: isMobile ? '6px' : '14px', padding: isMobile ? '10px 4px 4px 10px' : '16px 20px', textDecoration: 'none', color: 'inherit', borderRadius: isMobile ? '8px' : '0', border: isMobile ? '1px solid #eee' : 'none', marginBottom: isMobile ? '1px' : '0' }}
                    >
                      {/* 썸네일 */}
                      <div style={{ width: '100px', height: '100px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', background: '#f0f0f0', position: 'relative' }}>
                        {thumb ? (
                          <>
                            <img src={thumb} alt="매물 이미지" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0.45, overflow: 'hidden' }}>
                              <span style={{ color: '#e2a06e', fontSize: '6px', fontWeight: 300, letterSpacing: '0.5px', fontFamily: 'Georgia, "Times New Roman", serif', whiteSpace: 'nowrap' }}>HERMANN REALTY</span>
                              <span style={{ color: '#e2a06e', fontSize: '5px', letterSpacing: '0.3px', marginTop: '1px', whiteSpace: 'nowrap' }}>헤르만부동산</span>
                            </div>
                          </>
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', overflow: 'hidden' }}>
                            <span style={{ color: '#e2a06e', fontSize: '6px', fontWeight: 300, letterSpacing: '0.5px', fontFamily: 'Georgia, "Times New Roman", serif', whiteSpace: 'nowrap', opacity: 0.7 }}>HERMANN REALTY</span>
                            <span style={{ color: '#e2a06e', fontSize: '5px', letterSpacing: '0.3px', marginTop: '1px', whiteSpace: 'nowrap', opacity: 0.5 }}>헤르만부동산</span>
                          </div>
                        )}
                        {p.is_sold && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#fff', fontSize: '12px', fontWeight: 800, letterSpacing: '1px', border: '1px solid #fff', padding: '2px 6px', borderRadius: '3px' }}>거래완료</span>
                          </div>
                        )}
                        {isNewProperty(p.created_at) && (
                          <div style={{ position: 'absolute', top: 0, right: 0, width: '54px', height: '54px', overflow: 'hidden', pointerEvents: 'none', zIndex: 3 }}>
                            <div style={{ position: 'absolute', top: '8px', right: '-20px', transform: 'rotate(45deg)', background: '#e05050', color: '#fff', textAlign: 'center', padding: '1px 0', width: '72px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
                              NEW
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 텍스트 */}
                      <div className="map-card-text" style={{ flex: 1, minWidth: 0 }}>
                        <ThemeBadges themeType={p.theme_type} variant="card" />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', marginBottom: isMobile ? '2px' : '4px' }}>
                          <span className="map-card-pnum" style={{ fontSize: '11px', color: '#999' }}>{p.property_number}</span>
                          {p.transaction_type && (() => {
                            const colors: Record<string, { bg: string; border: string; text: string }> = {
                              '월세': { bg: '#fff8f2', border: '#e2a06e', text: '#e2a06e' },
                              '전세': { bg: '#eef4ff', border: '#4a80e8', text: '#4a80e8' },
                              '매매': { bg: '#fff0f0', border: '#e05050', text: '#e05050' },
                            };
                            const c = colors[p.transaction_type] ?? { bg: '#f5f5f5', border: '#999', text: '#999' };
                            return (
                              <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', flexShrink: 0 }}>
                                {p.transaction_type}
                              </span>
                            );
                          })()}
                        </div>
                        <div style={{ marginBottom: isMobile ? '2px' : '4px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>{price}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '2px', marginBottom: isMobile ? '2px' : '4px', flexWrap: 'wrap', alignItems: 'baseline' }}>
                          {p.premium ? (
                            <span style={{ fontSize: '13px', color: '#e05050', fontWeight: 600 }}>권리금 {isAdmin ? formatPrice(p.premium) : '협의'}</span>
                          ) : (
                            <span style={{ fontSize: '13px', color: '#e05050', fontWeight: 600 }}>무권리</span>
                          )}
                          <span style={{ fontSize: '11px', color: '#888' }}>관리비 {formatMaintenance(p.maintenance_fee)}</span>
                        </div>
                        <p className="map-card-addr" style={{ fontSize: '13px', color: '#888', margin: isMobile ? '0 0 1px' : '0 0 2px', ...(isMobile ? { whiteSpace: 'normal' as const, wordBreak: 'keep-all' as const, overflowWrap: 'break-word' as const } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }) }}>
                          {addr}
                          {isAdmin && (p.building_name || p.unit_number) && (
                            <span style={{ fontSize: '11px', color: '#e2a06e', marginLeft: '4px' }}>
                              {[p.building_name, p.unit_number].filter(Boolean).join(' ')}
                            </span>
                          )}
                        </p>
                        {detail && <p className="map-card-detail" style={{ fontSize: '13px', color: '#888', margin: 0 }}>{detail}</p>}
                      </div>
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ════════════ 모바일 드로어 ════════════ */}
      {/* 배경 오버레이 제거 — 뒤 지도 터치/드래그 가능 */}
      {/* 드로어 시트 (항상 렌더, transform으로 표시/숨김) */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%',
          height: `${drawerHeight}vh`, maxHeight: '90vh', background: '#fff',
          borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
          boxShadow: drawerOpen ? '0 -4px 20px rgba(0,0,0,0.15)' : 'none',
          display: 'flex', flexDirection: 'column',
          overscrollBehavior: 'contain', zIndex: 200,
          transform: drawerOpen ? `translateY(${drawerDragY}px)` : 'translateY(100%)',
          transition: drawerDragY === 0 ? 'transform 0.3s ease, height 0.3s ease' : 'none',
          pointerEvents: drawerOpen ? 'auto' : 'none',
        }}
          >
            {/* 드로어 핸들 + 헤더 */}
            <div
              style={{ padding: '8px 20px 12px', borderBottom: '1px solid #eee', flexShrink: 0, touchAction: 'none', cursor: 'grab' }}
              onTouchStart={e => {
                drawerStartY.current = e.touches[0].clientY;
                drawerDragRef.current = 0;
                setDrawerDragY(0);
              }}
              onTouchMove={e => {
                const diff = e.touches[0].clientY - drawerStartY.current;
                drawerDragRef.current = diff;
                setDrawerDragY(diff);
              }}
              onTouchEnd={() => {
                const dy = drawerDragRef.current;
                drawerDragRef.current = 0;
                setDrawerDragY(0);
                if (Math.abs(dy) < 50) return;
                if (dy < 0) {
                  // 위로 스와이프 → 항상 90vh
                  setDrawerHeight(90);
                } else {
                  // 아래로 스와이프: 90 → 45 → 닫힘
                  if (drawerHeight >= 90) {
                    setDrawerHeight(45);
                  } else {
                    setDrawerOpen(false);
                    setTopPropertyNumber(null);
                  }
                }
              }}
            >
              <div style={{ textAlign: 'center', fontSize: '12px', color: '#888', fontWeight: 500, marginBottom: '6px' }}>
                매물 <span style={{ color: '#e2a06e', fontWeight: 700 }}>{drawerList.length}</span>개
              </div>
              <div style={{ width: '40px', height: '4px', background: '#ddd', borderRadius: '2px', margin: '0 auto' }} />
            </div>
            {/* 카드 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {drawerList.map(p => {
                const thumb = p.property_images?.[0]?.image_url ?? null;
                const pyeong = p.exclusive_area ? toPyeong(p.exclusive_area) : null;
                const price = buildPriceStr(p);
                const floorStr = p.current_floor ? (String(p.current_floor).trim().endsWith('층') ? p.current_floor : `${p.current_floor}층`) : null;
                const detailStr = [
                  p.exclusive_area ? `전용 ${p.exclusive_area}㎡${pyeong ? ` (${pyeong}평)` : ''}` : null,
                  floorStr,
                ].filter(Boolean).join(' · ');
                const isTop = p.property_number === topPropertyNumber;
                return (
                  <a
                    key={p.property_number}
                    href={`/item/view/${p.property_number}`}
                    style={{
                      display: 'flex', gap: '12px', padding: '14px 20px',
                      textDecoration: 'none', color: 'inherit',
                      borderBottom: '1px solid #f0f0f0',
                      border: isTop ? '2px solid #e2a06e' : undefined,
                      background: isTop ? '#fff8f2' : 'transparent',
                      borderRadius: isTop ? '8px' : 0,
                      margin: isTop ? '8px 12px' : 0,
                    }}
                  >
                    <div style={{ width: '80px', height: '80px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', background: '#f0f0f0', position: 'relative' }}>
                      {thumb ? (
                        <>
                          <img src={thumb} alt="매물 이미지" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0.45, overflow: 'hidden' }}>
                            <span style={{ color: '#e2a06e', fontSize: '6px', fontWeight: 300, letterSpacing: '0.5px', fontFamily: 'Georgia, "Times New Roman", serif', whiteSpace: 'nowrap' }}>HERMANN REALTY</span>
                            <span style={{ color: '#e2a06e', fontSize: '5px', letterSpacing: '0.3px', marginTop: '1px', whiteSpace: 'nowrap' }}>헤르만부동산</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', overflow: 'hidden' }}>
                          <span style={{ color: '#e2a06e', fontSize: '6px', fontWeight: 300, letterSpacing: '0.5px', fontFamily: 'Georgia, "Times New Roman", serif', whiteSpace: 'nowrap', opacity: 0.7 }}>HERMANN REALTY</span>
                          <span style={{ color: '#e2a06e', fontSize: '5px', letterSpacing: '0.3px', marginTop: '1px', whiteSpace: 'nowrap', opacity: 0.5 }}>헤르만부동산</span>
                        </div>
                      )}
                      {isNewProperty(p.created_at) && (
                        <div style={{ position: 'absolute', top: 0, right: 0, width: isMobile ? '32px' : '54px', height: isMobile ? '32px' : '54px', overflow: 'hidden', pointerEvents: 'none', zIndex: 3 }}>
                          <div style={{ position: 'absolute', top: isMobile ? '4px' : '8px', right: isMobile ? '-12px' : '-20px', transform: 'rotate(45deg)', background: '#e05050', color: '#fff', textAlign: 'center', padding: isMobile ? '0' : '1px 0', width: isMobile ? '42px' : '72px', fontSize: isMobile ? '6px' : '9px', fontWeight: 700, letterSpacing: isMobile ? '0.3px' : '0.5px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
                            NEW
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <ThemeBadges themeType={p.theme_type} variant="card" />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#999' }}>{p.property_number}</span>
                        {p.transaction_type && (() => {
                          const colors: Record<string, { bg: string; border: string; text: string }> = {
                            '월세': { bg: '#fff8f2', border: '#e2a06e', text: '#e2a06e' },
                            '전세': { bg: '#eef4ff', border: '#4a80e8', text: '#4a80e8' },
                            '매매': { bg: '#fff0f0', border: '#e05050', text: '#e05050' },
                          };
                          const c = colors[p.transaction_type] ?? { bg: '#f5f5f5', border: '#999', text: '#999' };
                          return (
                            <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', flexShrink: 0 }}>
                              {p.transaction_type}
                            </span>
                          );
                        })()}
                      </div>
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>{price}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '2px', marginBottom: '4px', flexWrap: 'wrap', alignItems: 'baseline' }}>
                        {p.premium ? (
                          <span style={{ fontSize: '13px', color: '#e05050', fontWeight: 600 }}>권리금 {isAdmin ? formatPrice(p.premium) : '협의'}</span>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#e05050', fontWeight: 600 }}>무권리</span>
                        )}
                        <span style={{ fontSize: '11px', color: '#888' }}>관리비 {formatMaintenance(p.maintenance_fee)}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#888', margin: '0 0 2px', whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
                        {isAdmin ? normalizeAddr(p.address ?? '') : formatAddress(p.address ?? '')}
                        {isAdmin && (p.building_name || p.unit_number) && (
                          <span style={{ fontSize: '11px', color: '#e2a06e', marginLeft: '4px' }}>
                            {[p.building_name, p.unit_number].filter(Boolean).join(' ')}
                          </span>
                        )}
                      </p>
                      {detailStr && <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{detailStr}</p>}
                    </div>
                  </a>
                );
              })}
            </div>
      </div>
    </div>
  );
}
