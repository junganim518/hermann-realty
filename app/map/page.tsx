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
const PROP_TYPES  = ['', '상가', '사무실', '원룸·투룸', '쓰리룸이상', '아파트', '건물매매'];
const AREA_RANGES = ['전체', '10평 이하', '10~20평', '20~30평', '30~40평', '40~50평', '50평 이상'];
const THEME_TYPES = ['전체', '추천매물', '사옥형및통임대', '대형상가', '대형사무실', '무권리상가', '프랜차이즈양도양수', '1층상가', '2층이상상가'];

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function MapPage() {
  // refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapObjRef       = useRef<any>(null);
  const clustererRef    = useRef<any>(null);
  const markersRef      = useRef<any[]>([]);
  const listRef         = useRef<HTMLDivElement>(null);
  const cardRefs        = useRef<Record<string, HTMLDivElement | null>>({});

  // state
  const [properties, setProperties]     = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [mapReady, setMapReady]         = useState(false);
  const [headerH, setHeaderH]           = useState(144);
  const [highlightId, setHighlightId]   = useState<string | null>(null);
  const [visibleIds, setVisibleIds]     = useState<Set<string> | null>(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);

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

      const isMobile = window.innerWidth < 768;
      const center = new window.kakao.maps.LatLng(37.5040479677868, 126.77522691726);
      const map = new window.kakao.maps.Map(mapContainerRef.current, {
        center,
        level: isMobile ? 8 : 7,
        minLevel: 4,
      });
      mapObjRef.current = map;

      // 크기 재계산 + 중심 재설정 (여러 타이밍에 보장)
      const recenter = () => {
        map.relayout();
        map.setCenter(center);
      };
      setTimeout(recenter, 100);
      setTimeout(recenter, 500);

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

      if (!cancelled) setMapReady(true);
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
      if (filterTx !== '전체' && p.transaction_type !== filterTx) return false;
      if (filterType && p.property_type !== filterType) return false;
      if (!matchArea(p.exclusive_area, filterArea)) return false;
      if (filterTheme !== '전체' && !(p.theme_type ?? '').split(',').includes(filterTheme)) return false;
      if (q && !String(p.title ?? '').toLowerCase().includes(q)
             && !String(p.address ?? '').toLowerCase().includes(q)
             && !String(p.property_number ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [properties, filterTx, filterType, filterArea, filterTheme, search]);

  // ── 마커 + 원 업데이트
  useEffect(() => {
    if (!mapReady || !mapObjRef.current) return;

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

        // 클릭 이벤트 — 카드 하이라이트 + 스크롤만
        window.kakao.maps.event.addListener(marker, 'click', () => {
          setHighlightId(p.property_number);
          const card = cardRefs.current[p.property_number];
          if (card && listRef.current) {
            listRef.current.scrollTo({ top: card.offsetTop - 16, behavior: 'smooth' });
          }
        });

        newMarkers.push(marker);
      });

    markersRef.current = newMarkers;
    clustererRef.current?.addMarkers(newMarkers);

    // 클러스터 클릭 → 해당 매물만 목록 표시
    const handleClusterClick = (cluster: any) => {
      const bounds = cluster.getBounds();
      const ids = new Set<string>();
      markersRef.current.forEach((m: any) => {
        if (bounds.contain(m.getPosition()) && m._pnum) ids.add(m._pnum);
      });
      if (ids.size > 0) setVisibleIds(ids);
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

  // ── 핸들러
  const runSearch = () => setSearch(searchInput);
  const resetAll  = () => {
    setSearchInput(''); setSearch('');
    setFilterTx('전체'); setFilterType('');
    setFilterArea('전체'); setFilterTheme('전체');
    setVisibleIds(null);
  };

  // ── 스타일 상수
  const selectSt: React.CSSProperties = {
    height: '40px', border: '1px solid #ddd', borderRadius: '4px',
    padding: '0 10px', fontSize: '15px', color: '#555',
    background: '#fff', cursor: 'pointer', outline: 'none',
  };

  // ── 렌더
  return (
    <div style={{ height: `calc(100vh - ${headerH}px)`, display: 'flex', flexDirection: 'column', background: '#f5f5f5', overflow: 'hidden' }}>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1199px) {
          .map-panel { width: 300px !important; }
          .map-filter-bar { padding: 10px 16px !important; }
          .map-filter-bar select { height: 36px !important; font-size: 13px !important; padding: 0 6px !important; }
          .map-filter-bar input { width: 200px !important; }
          .map-filter-bar button { height: 36px !important; font-size: 13px !important; }
          .map-filter-bar .map-count { font-size: 13px !important; }
        }
        @media (max-width: 767px) {
          .map-filter-bar {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 6px !important;
            padding: 8px 10px !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .map-filter-bar .map-search { grid-column: 1 / -1 !important; display: flex !important; }
          .map-filter-bar .map-search input { flex: 1 !important; width: auto !important; height: 36px !important; font-size: 13px !important; }
          .map-filter-bar .map-search button { height: 36px !important; font-size: 13px !important; }
          .map-filter-bar select { width: 100% !important; height: 34px !important; font-size: 12px !important; padding: 0 4px !important; }
          .map-filter-bar .map-reset { height: 34px !important; font-size: 12px !important; padding: 0 8px !important; }
          .map-filter-bar .map-count { display: none !important; }
          .map-panel { display: none !important; }
          .map-drawer-toggle { display: flex !important; }
          .map-card-text { padding: 12px 14px !important; }
          .map-card-text .map-card-pnum { font-size: 11px !important; }
          .map-card-text .map-card-title { font-size: 14px !important; }
          .map-card-text .map-card-addr { font-size: 12px !important; }
          .map-card-text .map-card-detail { font-size: 12px !important; }
        }
      ` }} />

      {/* ════════════ 필터 바 ════════════ */}
      <div className="map-filter-bar" style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', borderBottom: '1px solid #e0e0e0',
        padding: '14px 24px', display: 'flex', alignItems: 'center',
        gap: '8px', flexWrap: 'wrap', flexShrink: 0,
        boxShadow: '0 2px 6px rgba(0,0,0,0.07)',
      }}>
        {/* 검색 */}
        <div className="map-search" style={{ display: 'flex' }}>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSearch()}
            placeholder="지역, 매물종류, 키워드 검색"
            style={{
              width: '280px', height: '40px',
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

      {/* ════════════ 2열 본문 ════════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── 좌측 지도 */}
        <div className="map-area" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

          {/* 모바일 매물목록 토글 버튼 */}
          <button
            className="map-drawer-toggle"
            onClick={() => setDrawerOpen(true)}
            style={{
              display: 'none', position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 50, padding: '10px 24px', background: '#e2a06e', color: '#fff',
              fontSize: '14px', fontWeight: 700, border: 'none', borderRadius: '24px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.25)', cursor: 'pointer',
              alignItems: 'center', gap: '6px',
            }}
          >
            매물 목록 보기 <strong>{displayList.length}</strong>개
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
        <div className="map-panel" style={{ width: '480px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e0e0e0', background: '#fff' }}>

          {/* 헤더 */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>
              지도 내 매물&nbsp;<span style={{ color: '#e2a06e' }}>{displayList.length}</span>개
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
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto' }}>
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
                const title    = String(p.title ?? '').replace(/헤르만\s*/g, '');
                const pyeong   = p.exclusive_area ? toPyeong(p.exclusive_area) : null;
                const isHl     = highlightId === p.property_number;
                const price    = buildPriceStr(p);
                const addr     = formatAddress(p.address ?? '');
                const detail   = [
                  p.exclusive_area ? `전용 ${p.exclusive_area}㎡${pyeong ? ` (${pyeong}평)` : ''}` : null,
                  p.current_floor  ? (/^\d+$/.test(String(p.current_floor)) ? `${p.current_floor}층` : p.current_floor) : null,
                ].filter(Boolean).join(' · ');

                return (
                  <div
                    key={p.property_number}
                    ref={el => { cardRefs.current[p.property_number] = el; }}
                    style={{ borderBottom: '1px solid #f0f0f0', background: isHl ? '#fff8f2' : '#fff', transition: 'background 0.25s' }}
                  >
                    <Link
                      href={`/item/view/${p.property_number}`}
                      style={{ display: 'flex', gap: '14px', padding: '16px 20px', textDecoration: 'none', color: 'inherit' }}
                    >
                      {/* 썸네일 */}
                      <div style={{ width: '100px', height: '100px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', background: '#f0f0f0', position: 'relative' }}>
                        {thumb
                          ? <img src={thumb} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#bbb' }}>준비중</div>
                        }
                        {p.is_sold && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#fff', fontSize: '12px', fontWeight: 800, letterSpacing: '1px', border: '1px solid #fff', padding: '2px 6px', borderRadius: '3px' }}>거래완료</span>
                          </div>
                        )}
                      </div>

                      {/* 텍스트 */}
                      <div className="map-card-text" style={{ flex: 1, minWidth: 0 }}>
                        <p className="map-card-pnum" style={{ fontSize: '13px', color: '#bbb', margin: '0 0 2px' }}>{p.property_number}</p>
                        <p className="map-card-title" style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                        <p className="map-card-addr" style={{ fontSize: '13px', color: '#888', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr}</p>
                        {detail && <p className="map-card-detail" style={{ fontSize: '13px', color: '#888', margin: '0 0 5px' }}>{detail}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {p.transaction_type && (() => {
                            const colors: Record<string, { bg: string; border: string; text: string }> = {
                              '월세': { bg: '#fff8f2', border: '#e2a06e', text: '#e2a06e' },
                              '전세': { bg: '#f0f4ff', border: '#4a7cdc', text: '#4a7cdc' },
                              '매매': { bg: '#fff0f0', border: '#e04a4a', text: '#e04a4a' },
                            };
                            const c = colors[p.transaction_type] ?? { bg: '#f5f5f5', border: '#999', text: '#999' };
                            return (
                              <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '3px', flexShrink: 0 }}>
                                {p.transaction_type}
                              </span>
                            );
                          })()}
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>{price}</span>
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

      {/* ════════════ 모바일 드로어 ════════════ */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setDrawerOpen(false)}>
          {/* 배경 오버레이 */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          {/* 드로어 시트 */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '70vh', background: '#fff',
              borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* 드로어 핸들 + 헤더 */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee', flexShrink: 0 }}>
              <div style={{ width: '40px', height: '4px', background: '#ddd', borderRadius: '2px', margin: '0 auto 10px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>
                  매물 목록&nbsp;<span style={{ color: '#e2a06e' }}>{displayList.length}</span>개
                </span>
                <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer' }}>×</button>
              </div>
            </div>
            {/* 카드 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {displayList.map(p => {
                const thumb = p.property_images?.[0]?.image_url ?? null;
                const title = String(p.title ?? '').replace(/헤르만\s*/g, '');
                const pyeong = p.exclusive_area ? toPyeong(p.exclusive_area) : null;
                const price = buildPriceStr(p);
                const floorStr = p.current_floor ? (/^\d+$/.test(String(p.current_floor)) ? `${p.current_floor}층` : p.current_floor) : null;
                const detailStr = [
                  p.exclusive_area ? `전용 ${p.exclusive_area}㎡${pyeong ? ` (${pyeong}평)` : ''}` : null,
                  floorStr,
                ].filter(Boolean).join(' · ');
                return (
                  <a key={p.property_number} href={`/item/view/${p.property_number}`} style={{ display: 'flex', gap: '12px', padding: '14px 20px', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ width: '80px', height: '80px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', background: '#f0f0f0' }}>
                      {thumb ? <img src={thumb} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#bbb' }}>준비중</div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '11px', color: '#bbb', margin: '0 0 2px' }}>{p.property_number}</p>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                      <p style={{ fontSize: '12px', color: '#888', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatAddress(p.address ?? '')}</p>
                      {detailStr && <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>{detailStr}</p>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {p.transaction_type && (() => {
                          const colors: Record<string, { bg: string; border: string; text: string }> = {
                            '월세': { bg: '#fff8f2', border: '#e2a06e', text: '#e2a06e' },
                            '전세': { bg: '#f0f4ff', border: '#4a7cdc', text: '#4a7cdc' },
                            '매매': { bg: '#fff0f0', border: '#e04a4a', text: '#e04a4a' },
                          };
                          const c = colors[p.transaction_type] ?? { bg: '#f5f5f5', border: '#999', text: '#999' };
                          return <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px' }}>{p.transaction_type}</span>;
                        })()}
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>{price}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
