'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

declare global {
  interface Window { kakao: any; }
}

// ── 유틸 ────────────────────────────────────────────────────
const formatAddress = (addr: string) => {
  if (!addr) return '';
  const m = addr.match(/(.+동)/);
  return m ? m[1] : addr;
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
const PROP_TYPES  = ['', '상가', '사무실', '원룸·투룸', '쓰리룸이상', '아파트', '건물매매'];
const AREA_RANGES = ['전체', '10평 이하', '10~20평', '20~30평', '30~40평', '40~50평', '50평 이상'];
const THEME_TYPES = ['전체', '추천매물', '사옥형및통임대', '대형상가', '대형사무실', '무권리상가', '프랜차이즈양도양수', '1층상가', '2층이상상가'];

const MARKER_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <ellipse cx="16" cy="37" rx="5" ry="2.5" fill="rgba(0,0,0,0.18)"/>
    <path d="M16 0C9.4 0 4 5.4 4 12c0 9 12 24 12 24S28 21 28 12C28 5.4 22.6 0 16 0z" fill="#e2a06e"/>
    <circle cx="16" cy="12" r="5" fill="#fff"/>
  </svg>`
);

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function MapPage() {
  // refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapObjRef       = useRef<any>(null);
  const clustererRef    = useRef<any>(null);
  const infowindowRef   = useRef<any>(null);
  const markersRef      = useRef<any[]>([]);
  const circlesRef      = useRef<any[]>([]);
  const listRef         = useRef<HTMLDivElement>(null);
  const cardRefs        = useRef<Record<string, HTMLDivElement | null>>({});

  // state
  const [properties, setProperties]     = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [mapReady, setMapReady]         = useState(false);
  const [headerH, setHeaderH]           = useState(144);
  const [highlightId, setHighlightId]   = useState<string | null>(null);

  const [searchInput, setSearchInput]   = useState('');
  const [search, setSearch]             = useState('');
  const [filterTx, setFilterTx]         = useState('전체');
  const [filterType, setFilterType]     = useState('');
  const [filterArea, setFilterArea]     = useState('전체');
  const [filterTheme, setFilterTheme]   = useState('전체');

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
      if (mapObjRef.current) { setMapReady(true); return; }

      const map = new window.kakao.maps.Map(mapContainerRef.current, {
        center: new window.kakao.maps.LatLng(37.5040479677868, 126.77522691726),
        level: 6,
      });
      mapObjRef.current = map;

      // 주소 레이어(지번/도로명) 숨기기
      map.removeOverlayMapTypeId(window.kakao.maps.MapTypeId.USE_DISTRICT);

      clustererRef.current = new window.kakao.maps.MarkerClusterer({
        map,
        averageCenter: true,
        minLevel: 5,
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

      infowindowRef.current = new window.kakao.maps.InfoWindow({ zIndex: 10 });
      if (!cancelled) setMapReady(true);
    };

    // 이미 SDK가 로드된 경우 (페이지 재방문 등)
    if (typeof window.kakao?.maps?.Map === 'function') {
      createMap();
      return () => { cancelled = true; };
    }

    // script 태그 동적 생성
    const script = document.createElement('script');
    script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=8a478b4b6ea5e02722a33f6ac2fa34b6&autoload=false&libraries=clusterer';
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
      if (filterTx !== '전체' && p.transaction_type !== filterTx) return false;
      if (filterType && p.property_type !== filterType) return false;
      if (!matchArea(p.exclusive_area, filterArea)) return false;
      if (filterTheme !== '전체' && p.theme_type !== filterTheme && p.theme_types !== filterTheme) return false;
      if (q && !String(p.title ?? '').toLowerCase().includes(q)
             && !String(p.address ?? '').toLowerCase().includes(q)
             && !String(p.property_number ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [properties, filterTx, filterType, filterArea, filterTheme, search]);

  // ── 마커 + 원 업데이트
  useEffect(() => {
    if (!mapReady || !mapObjRef.current) return;
    const map = mapObjRef.current;

    // 기존 제거
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    circlesRef.current.forEach(c => c.setMap(null));
    circlesRef.current = [];
    clustererRef.current?.clear();
    infowindowRef.current?.close();

    const markerImage = new window.kakao.maps.MarkerImage(
      `data:image/svg+xml;charset=utf-8,${MARKER_SVG}`,
      new window.kakao.maps.Size(32, 40),
      { offset: new window.kakao.maps.Point(16, 40) }
    );

    const newMarkers: any[] = [];
    const newCircles: any[] = [];

    filtered
      .filter(p => p.latitude && p.longitude)
      .forEach(p => {
        const position = new window.kakao.maps.LatLng(p.latitude, p.longitude);

        // 마커 (줌 5 이상에서 표시, 클러스터링용)
        const marker = new window.kakao.maps.Marker({
          position,
          image: markerImage,
        });

        // 반경 원 (줌 4 이하에서 표시)
        const circle = new window.kakao.maps.Circle({
          center: position,
          radius: 100,
          strokeWeight: 1.5,
          strokeColor: '#e2a06e',
          strokeOpacity: 0.8,
          fillColor: '#e2a06e',
          fillOpacity: 0.2,
        });

        // 클릭 이벤트 (마커 & 원 공통)
        const handleClick = () => {
          const price = buildPriceStr(p);

          infowindowRef.current.setContent(`
            <div style="padding:10px 14px;font-family:Pretendard,sans-serif;min-width:190px;line-height:1.5;">
              <p style="font-size:11px;color:#aaa;margin:0 0 2px;">${p.property_number ?? ''}</p>
              <p style="font-size:14px;font-weight:700;color:#1a1a1a;margin:0 0 3px;">${String(p.title ?? '').replace(/헤르만\s*/g, '')}</p>
              <p style="font-size:13px;color:#e2a06e;font-weight:700;margin:0 0 6px;">${price}</p>
              <a href="/item/view/${p.property_number}" style="font-size:12px;color:#e2a06e;text-decoration:underline;">상세보기 →</a>
            </div>
          `);
          infowindowRef.current.open(map, marker);

          setHighlightId(p.property_number);
          const card = cardRefs.current[p.property_number];
          if (card && listRef.current) {
            listRef.current.scrollTo({ top: card.offsetTop - 16, behavior: 'smooth' });
          }
        };

        window.kakao.maps.event.addListener(marker, 'click', handleClick);
        window.kakao.maps.event.addListener(circle, 'click', handleClick);

        newMarkers.push(marker);
        newCircles.push(circle);
      });

    markersRef.current = newMarkers;
    circlesRef.current = newCircles;

    // 줌 레벨에 따라 마커/원 전환
    const updateVisibility = () => {
      const level = map.getLevel();
      const zoomed = level <= 4; // 줌 4 이하 = 확대 상태

      // 원: 확대 시 표시
      newCircles.forEach(c => c.setMap(zoomed ? map : null));

      // 마커+클러스터: 축소 시 표시
      if (zoomed) {
        clustererRef.current?.clear();
        newMarkers.forEach(m => m.setMap(null));
      } else {
        newMarkers.forEach(m => m.setMap(null)); // 클러스터러가 관리
        clustererRef.current?.clear();
        clustererRef.current?.addMarkers(newMarkers);
      }
    };

    window.kakao.maps.event.addListener(map, 'zoom_changed', updateVisibility);
    updateVisibility(); // 초기 적용

    return () => {
      window.kakao.maps.event.removeListener(map, 'zoom_changed', updateVisibility);
    };
  }, [filtered, mapReady]);

  // ── 핸들러
  const runSearch = () => setSearch(searchInput);
  const resetAll  = () => {
    setSearchInput(''); setSearch('');
    setFilterTx('전체'); setFilterType('');
    setFilterArea('전체'); setFilterTheme('전체');
  };

  // ── 스타일 상수
  const selectSt: React.CSSProperties = {
    height: '34px', border: '1px solid #ddd', borderRadius: '4px',
    padding: '0 8px', fontSize: '13px', color: '#555',
    background: '#fff', cursor: 'pointer', outline: 'none',
  };

  // ── 렌더
  return (
    <div style={{ height: `calc(100vh - ${headerH}px)`, display: 'flex', flexDirection: 'column', background: '#f5f5f5', overflow: 'hidden' }}>

      {/* ════════════ 필터 바 ════════════ */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', borderBottom: '1px solid #e0e0e0',
        padding: '10px 20px', display: 'flex', alignItems: 'center',
        gap: '8px', flexWrap: 'wrap', flexShrink: 0,
        boxShadow: '0 2px 6px rgba(0,0,0,0.07)',
      }}>
        {/* 검색 */}
        <div style={{ display: 'flex' }}>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSearch()}
            placeholder="매물번호 / 제목 / 주소 검색"
            style={{
              width: '230px', height: '34px',
              border: '1px solid #ddd', borderRight: 'none',
              borderRadius: '4px 0 0 4px', padding: '0 10px',
              fontSize: '13px', outline: 'none',
            }}
          />
          <button
            onClick={runSearch}
            style={{ height: '34px', padding: '0 14px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '0 4px 4px 0', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            검색
          </button>
        </div>

        {/* 거래유형 */}
        <select value={filterTx} onChange={e => setFilterTx(e.target.value)} style={selectSt}>
          {TX_TYPES.map(t => <option key={t} value={t}>{t === '전체' ? '거래유형 전체' : t}</option>)}
        </select>

        {/* 매물종류 */}
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectSt}>
          <option value="">매물종류 전체</option>
          {PROP_TYPES.filter(t => t).map(t => <option key={t}>{t}</option>)}
        </select>

        {/* 면적 */}
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)} style={selectSt}>
          {AREA_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '면적 전체' : t}</option>)}
        </select>

        {/* 테마 */}
        <select value={filterTheme} onChange={e => setFilterTheme(e.target.value)} style={selectSt}>
          {THEME_TYPES.map(t => <option key={t} value={t}>{t === '전체' ? '테마 전체' : t}</option>)}
        </select>

        {/* 초기화 */}
        <button
          onClick={resetAll}
          style={{ height: '34px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', color: '#666', background: '#fff', cursor: 'pointer' }}
        >
          초기화
        </button>

        <span style={{ fontSize: '13px', color: '#555', marginLeft: 'auto' }}>
          매물 <strong style={{ color: '#e2a06e' }}>{filtered.length}</strong>개
        </span>
      </div>

      {/* ════════════ 2열 본문 ════════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── 좌측 지도 */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
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
        <div style={{ width: '400px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e0e0e0', background: '#fff' }}>

          {/* 헤더 */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', flexShrink: 0 }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>
              지도 내 매물&nbsp;<span style={{ color: '#e2a06e' }}>{filtered.length}</span>개
            </span>
          </div>

          {/* 카드 리스트 */}
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#888', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>⏳</span>
                <p style={{ fontSize: '14px' }}>매물을 불러오는 중...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', flexDirection: 'column', gap: '8px', color: '#aaa' }}>
                <span style={{ fontSize: '28px' }}>🏚</span>
                <p style={{ fontSize: '14px', color: '#666', fontWeight: 600 }}>조건에 맞는 매물이 없습니다</p>
              </div>
            ) : (
              filtered.map(p => {
                const thumb    = p.property_images?.[0]?.image_url ?? null;
                const title    = String(p.title ?? '').replace(/헤르만\s*/g, '');
                const pyeong   = p.exclusive_area ? toPyeong(p.exclusive_area) : null;
                const isHl     = highlightId === p.property_number;
                const price    = buildPriceStr(p);
                const meta     = [
                  formatAddress(p.address ?? ''),
                  p.exclusive_area ? `전용 ${p.exclusive_area}㎡${pyeong ? ` (${pyeong}평)` : ''}` : null,
                  p.current_floor  ? `${p.current_floor}층` : null,
                ].filter(Boolean).join(' · ');

                return (
                  <div
                    key={p.property_number}
                    ref={el => { cardRefs.current[p.property_number] = el; }}
                    style={{ borderBottom: '1px solid #f0f0f0', background: isHl ? '#fff8f2' : '#fff', transition: 'background 0.25s' }}
                  >
                    <Link
                      href={`/item/view/${p.property_number}`}
                      style={{ display: 'flex', gap: '12px', padding: '12px 16px', textDecoration: 'none', color: 'inherit' }}
                    >
                      {/* 썸네일 */}
                      <div style={{ width: '80px', height: '80px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', background: '#f0f0f0' }}>
                        {thumb
                          ? <img src={thumb} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#bbb' }}>준비중</div>
                        }
                      </div>

                      {/* 텍스트 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '11px', color: '#bbb', margin: '0 0 2px' }}>{p.property_number}</p>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                        <p style={{ fontSize: '12px', color: '#888', margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {p.transaction_type && (
                            <span style={{ background: '#fff8f2', border: '1px solid #e2a06e', color: '#e2a06e', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', flexShrink: 0 }}>
                              {p.transaction_type}
                            </span>
                          )}
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>{price}</span>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
