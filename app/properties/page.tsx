'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const normalizeAddr = (addr: string) =>
  addr.replace(/^경기\s/, '경기도 ').replace(/^서울\s/, '서울특별시 ');

const splitAddress = (address: string): { line1: string; line2: string } => {
  if (!address) return { line1: '', line2: '' };
  const n = normalizeAddr(address);
  const road = n.match(/^(.*?(?:시|군))\s+((?:\S+구\s+)?(\S+(?:로|길)))/);
  if (road) return { line1: road[1], line2: road[2].trim() };
  const dong = n.match(/^(.*?(?:시|군))\s+((?:\S+구\s+)?\S*[가-힣]동)/);
  if (dong) return { line1: dong[1], line2: dong[2] };
  return { line1: n, line2: '' };
};

const formatAddress = (addr: string) => {
  const { line1, line2 } = splitAddress(addr);
  return [line1, line2].filter(Boolean).join(' ');
};

const formatPrice = (v: number) => {
  if (!v) return '-';
  const uk = Math.floor(v / 10000);
  const man = v % 10000;
  if (uk > 0) return man > 0 ? `${uk}억 ${man.toLocaleString()}만원` : `${uk}억`;
  return `${v.toLocaleString()}만원`;
};

const buildPriceStr = (p: any) => {
  if (p.transaction_type === '매매') {
    const v = p.sale_price || p.deposit;
    return v ? `매매가 ${formatPrice(v)}` : '-';
  }
  const parts = [
    p.deposit ? `보증금 ${formatPrice(p.deposit)}` : null,
    p.monthly_rent ? `월세 ${formatPrice(p.monthly_rent)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '-';
};

const toPyeong = (sqm: number) => (sqm * 0.3025).toFixed(1);

const TX_TYPES = ['전체', '월세', '전세', '매매'];
const AREA_RANGES = ['전체', '10평 이하', '10~20평', '20~30평', '30~40평', '40~50평', '50평 이상'];

const PROP_TYPES = [
  { id: '상가', name: '상가' }, { id: '사무실', name: '사무실' }, { id: '원룸·투룸', name: '원룸·투룸' },
  { id: '쓰리룸이상', name: '쓰리룸이상' }, { id: '아파트', name: '아파트' }, { id: '건물매매', name: '건물매매' },
];
const THEME_TYPES = [
  { id: '추천매물', name: '추천매물' }, { id: '사옥형및통임대', name: '사옥형 및 통임대' }, { id: '대형상가', name: '대형 상가' },
  { id: '대형사무실', name: '대형사무실' }, { id: '무권리상가', name: '무권리 상가' }, { id: '프랜차이즈양도양수', name: '프랜차이즈 양도양수' },
  { id: '1층상가', name: '1층 상가' }, { id: '2층이상상가', name: '2층 이상 상가' },
];

const matchArea = (exclusive_area: any, range: string) => {
  if (range === '전체') return true;
  const py = parseFloat(exclusive_area) * 0.3025;
  if (isNaN(py)) return false;
  if (range === '10평 이하') return py <= 10;
  if (range === '10~20평') return py > 10 && py <= 20;
  if (range === '20~30평') return py > 20 && py <= 30;
  if (range === '30~40평') return py > 30 && py <= 40;
  if (range === '40~50평') return py > 40 && py <= 50;
  if (range === '50평 이상') return py > 50;
  return true;
};

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

const PAGE_SIZE = 10;

export default function PropertiesPage() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') ?? '';
  const themeParam = searchParams.get('theme') ?? '';
  const searchParam = searchParams.get('search') ?? '';

  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(200);
  const [filterTx, setFilterTx] = useState('전체');
  const [filterType, setFilterType] = useState(typeParam || '전체');
  const [filterTheme, setFilterTheme] = useState(themeParam || '전체');
  const [filterArea, setFilterArea] = useState('전체');
  const [filterDeposit, setFilterDeposit] = useState('전체');
  const [filterRent, setFilterRent] = useState('전체');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState(searchParam);

  useEffect(() => {
    setFilterType(typeParam || '전체');
    setFilterTheme(themeParam || '전체');
    setSearchInput(searchParam);
    setCurrentPage(1);
  }, [typeParam, themeParam, searchParam]);

  const title = searchParam ? `"${searchParam}" 검색 결과` : filterTheme !== '전체' ? filterTheme : filterType !== '전체' ? `${filterType} 매물` : '전체 매물';

  useEffect(() => {
    const h = document.querySelector('header') as HTMLElement;
    if (h) setHeaderHeight(h.offsetHeight);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase.from('properties').select('*').order('created_at', { ascending: false });
      if (searchParam) {
        query = query.or(`address.ilike.%${searchParam}%,title.ilike.%${searchParam}%,property_number.ilike.%${searchParam}%,property_type.ilike.%${searchParam}%,transaction_type.ilike.%${searchParam}%,theme_type.ilike.%${searchParam}%,description.ilike.%${searchParam}%`);
      }
      const { data } = await query;

      const withImages = await Promise.all(
        (data ?? []).map(async (p: any) => {
          const { data: imgs } = await supabase
            .from('property_images')
            .select('image_url')
            .eq('property_id', p.id)
            .order('order_index', { ascending: true })
            .limit(1);
          return { ...p, image: imgs?.[0]?.image_url ?? null };
        })
      );
      setAllProperties(withImages);
      setLoading(false);
    })();
  }, [searchParam]);

  const filtered = allProperties.filter(p => {
    if (filterTx !== '전체' && p.transaction_type !== filterTx) return false;
    if (filterType !== '전체' && p.property_type !== filterType) return false;
    if (filterTheme !== '전체' && !(p.theme_type ?? '').split(',').includes(filterTheme)) return false;
    if (!matchArea(p.exclusive_area, filterArea)) return false;
    if (!matchDeposit(p.deposit, filterDeposit)) return false;
    if (!matchRent(p.monthly_rent, filterRent)) return false;
    return true;
  });

  const handleSearch = () => {
    const q = searchInput.trim();
    const params = new URLSearchParams();
    if (q) params.set('search', q);
    if (filterType !== '전체') params.set('type', filterType);
    if (filterTheme !== '전체') params.set('theme', filterTheme);
    window.location.href = `/properties${params.toString() ? '?' + params.toString() : ''}`;
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const displayed = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectSt: React.CSSProperties = {
    height: '40px', border: '1px solid #ddd', borderRadius: '4px',
    padding: '0 10px', fontSize: '14px', color: '#555',
    background: '#fff', cursor: 'pointer', outline: 'none',
  };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', colorScheme: 'light' }}>

      <style dangerouslySetInnerHTML={{ __html: `
        /* ── 기본 (PC 1200px+) ── */
        .prop-sidebar-left  { display: block; }
        .prop-sidebar-right { display: block; }
        .prop-grid { grid-template-columns: repeat(4, 1fr); }

        /* ── 태블릿 (768px ~ 1199px) ── */
        @media (max-width: 1199px) {
          .prop-sidebar-left { min-width: 160px !important; max-width: 160px !important; }
          .prop-sidebar-left a { font-size: 14px !important; padding: 8px 12px !important; }
          .prop-sidebar-right { display: none !important; }
          .prop-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .prop-card-img { height: 200px !important; }
        }

        /* ── 모바일 (768px 미만) ── */
        @media (max-width: 767px) {
          .prop-sidebar-left  { display: none !important; }
          .prop-sidebar-right { display: none !important; }
          .prop-layout { width: 100% !important; margin: 0 !important; }
          .prop-center { padding: 0 8px !important; }
          .prop-title h1 { font-size: 22px !important; }
          .prop-filter { display: grid !important; grid-template-columns: 1fr 1fr 1fr; gap: 6px !important; justify-content: stretch !important; }
          .prop-filter select { width: 100% !important; height: 36px !important; font-size: 12px !important; padding: 0 4px !important; }
          .prop-filter button { grid-column: 1 / -1; height: 36px !important; font-size: 13px !important; }
          .prop-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .prop-card-header { padding: 5px 8px !important; }
          .prop-card-header span { font-size: 11px !important; }
          .prop-card-img { height: 120px !important; }
          .prop-card-body { padding: 6px 8px !important; }
          .prop-card-body .prop-addr { font-size: 11px !important; }
          .prop-card-body .prop-meta { font-size: 11px !important; }
          .prop-card-body .prop-price { font-size: 13px !important; }
          .prop-card-body .prop-badge { font-size: 9px !important; padding: 1px 5px !important; }
          .prop-sold { font-size: 16px !important; padding: 2px 10px !important; }
        }
      ` }} />

      {/* 3열 레이아웃 */}
      <div className="prop-layout flex items-start" style={{ width: 'calc(100% - 32px)', margin: '0 16px' }}>

        {/* ── 좌측 사이드바 ── */}
        <aside
          className="prop-sidebar-left shrink-0 border border-gray-200 bg-white"
          style={{ minWidth: '220px', maxWidth: '220px', position: 'sticky', top: headerHeight, overflowY: 'auto', alignSelf: 'flex-start' }}
        >
          {/* 매물 종류 */}
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, padding: '10px 16px' }} className="bg-[#e2a06e] text-white">
              매물 종류
            </div>
            <ul>
              {PROP_TYPES.map((type) => (
                <li key={type.id}>
                  <a
                    href={`/properties?type=${encodeURIComponent(type.id)}`}
                    className="flex items-center justify-between border-b border-gray-100 transition-colors"
                    style={{ fontSize: '16px', padding: '9px 16px', color: filterType === type.id ? '#e2a06e' : '#333', fontWeight: filterType === type.id ? 700 : 400, background: filterType === type.id ? '#fff8f2' : 'transparent' }}
                  >
                    <span>{type.name}</span>
                    <span style={{ fontSize: '11px', color: filterType === type.id ? '#e2a06e' : '#ccc' }}>›</span>
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
              {THEME_TYPES.map((theme) => (
                <li key={theme.id}>
                  <a
                    href={`/properties?theme=${encodeURIComponent(theme.id)}`}
                    className="flex items-center justify-between border-b border-gray-100 last:border-b-0 transition-colors"
                    style={{ fontSize: '16px', padding: '9px 16px', color: filterTheme === theme.id ? '#e2a06e' : '#333', fontWeight: filterTheme === theme.id ? 700 : 400, background: filterTheme === theme.id ? '#fff8f2' : 'transparent' }}
                  >
                    <span>{theme.name}</span>
                    <span style={{ fontSize: '11px', color: filterTheme === theme.id ? '#e2a06e' : '#ccc' }}>›</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ── 중앙 콘텐츠 ── */}
        <div className="prop-center flex-1 min-w-0 px-4">

          {/* 타이틀 */}
          <div className="prop-title" style={{ marginBottom: '20px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a' }}>{title}</h1>
            <p style={{ fontSize: '14px', color: '#888', marginTop: '4px' }}>
              총 <strong style={{ color: '#e2a06e' }}>{filtered.length}</strong>개 매물
            </p>
          </div>

          {/* 검색바 */}
          <div style={{ marginBottom: '16px', display: 'flex', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '6px', overflow: 'hidden', maxWidth: '600px', margin: '0 auto 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', background: '#fff', color: '#aaa' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="지역, 매물종류, 키워드 검색"
              style={{ flex: 1, height: '44px', border: 'none', outline: 'none', fontSize: '15px', padding: '0 10px', background: '#fff', minWidth: 0, color: '#333' }}
            />
            <button
              onClick={handleSearch}
              style={{ padding: '0 20px', height: '44px', background: '#e2a06e', color: '#fff', fontSize: '15px', fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              검색
            </button>
          </div>

          {/* 필터 바 */}
          <div className="prop-filter" style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }} style={selectSt}>
              <option value="전체">매물종류 전체</option>
              {PROP_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={filterTheme} onChange={e => { setFilterTheme(e.target.value); setCurrentPage(1); }} style={selectSt}>
              <option value="전체">테마 전체</option>
              {THEME_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={filterTx} onChange={e => { setFilterTx(e.target.value); setCurrentPage(1); }} style={selectSt}>
              {TX_TYPES.map(t => <option key={t} value={t}>{t === '전체' ? '거래유형 전체' : t}</option>)}
            </select>
            <select value={filterArea} onChange={e => { setFilterArea(e.target.value); setCurrentPage(1); }} style={selectSt}>
              {AREA_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '면적 전체' : t}</option>)}
            </select>
            <select value={filterDeposit} onChange={e => { setFilterDeposit(e.target.value); setCurrentPage(1); }} style={selectSt}>
              {DEPOSIT_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '보증금 전체' : t}</option>)}
            </select>
            <select value={filterRent} onChange={e => { setFilterRent(e.target.value); setCurrentPage(1); }} style={selectSt}>
              {RENT_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '월세 전체' : t}</option>)}
            </select>
            {(filterTx !== '전체' || filterType !== '전체' || filterTheme !== '전체' || filterArea !== '전체' || filterDeposit !== '전체' || filterRent !== '전체') && (
              <button
                onClick={() => { setFilterTx('전체'); setFilterType('전체'); setFilterTheme('전체'); setFilterArea('전체'); setFilterDeposit('전체'); setFilterRent('전체'); setCurrentPage(1); }}
                style={{ height: '40px', padding: '0 14px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', color: '#666', background: '#fff', cursor: 'pointer' }}
              >
                초기화
              </button>
            )}
          </div>

          {/* 매물 그리드 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
              <p style={{ fontSize: '16px' }}>매물을 불러오는 중...</p>
            </div>
          ) : displayed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
              <p style={{ fontSize: '28px', marginBottom: '8px' }}>🏚</p>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#666' }}>조건에 맞는 매물이 없습니다</p>
            </div>
          ) : (
            <>
              <div className="prop-grid" style={{ display: 'grid', gap: '16px' }}>
                {displayed.map((p: any) => (
                  <Link
                    key={p.property_number}
                    href={`/item/view/${p.property_number}`}
                    style={{ textDecoration: 'none', display: 'block', transition: 'all 0.2s ease', cursor: 'pointer', backgroundColor: '#fff', color: '#1a1a1a' }}
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
                    <div className="prop-card-header flex justify-between items-center" style={{ padding: '8px 12px', background: '#e2a06e', color: '#fff' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>{p.property_number}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '8px' }}>{(p.title ?? '').replace(/헤르만\s*/g, '')}</span>
                    </div>
                    <div className="prop-card-img relative" style={{ height: '260px' }}>
                      {p.image ? (
                        <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-sm">준비중</div>
                      )}
                      {p.is_sold && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="prop-sold" style={{ color: '#fff', fontSize: '24px', fontWeight: 800, letterSpacing: '3px', border: '2px solid #fff', padding: '4px 16px', borderRadius: '4px', transform: 'rotate(-15deg)' }}>거래완료</span>
                        </div>
                      )}
                    </div>
                    <div className="prop-card-body p-3">
                      <div className="mb-1 md:mb-2">
                        <p className="prop-addr" style={{ fontSize: '13px', color: '#666', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatAddress(p.address ?? '')}
                        </p>
                        <p className="prop-meta" style={{ fontSize: '13px', color: '#666' }}>
                          {[p.property_type, p.exclusive_area ? `전용 ${p.exclusive_area}㎡ (${toPyeong(parseFloat(p.exclusive_area))}평)` : null, p.current_floor ? `${p.current_floor}층` : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {p.transaction_type && (() => {
                          const colors: Record<string, { bg: string; border: string; text: string }> = {
                            '월세': { bg: '#fff8f2', border: '#e2a06e', text: '#e2a06e' },
                            '전세': { bg: '#eef4ff', border: '#4a80e8', text: '#4a80e8' },
                            '매매': { bg: '#fff0f0', border: '#e05050', text: '#e05050' },
                          };
                          const c = colors[p.transaction_type] ?? { bg: '#f5f5f5', border: '#999', text: '#999' };
                          return (
                            <span className="prop-badge" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '3px', flexShrink: 0 }}>
                              {p.transaction_type}
                            </span>
                          );
                        })()}
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>{buildPriceStr(p)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* 페이지네이션 */}
              {/* 페이지네이션 */}
              {filtered.length > 0 && (
                <div style={{ margin: '24px 0 40px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      style={{ padding: '8px 14px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', color: safePage <= 1 ? '#ccc' : '#333', cursor: safePage <= 1 ? 'default' : 'pointer' }}
                    >
                      ‹ 이전
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                      .reduce<number[]>((acc, p) => {
                        if (acc.length > 0 && p - acc[acc.length - 1] > 1) acc.push(-1);
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === -1 ? (
                          <span key={`dot-${i}`} style={{ padding: '8px 4px', color: '#999' }}>…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            style={{
                              width: '36px', height: '36px', fontSize: '14px', fontWeight: p === safePage ? 700 : 400,
                              border: p === safePage ? '1px solid #e2a06e' : '1px solid #ddd',
                              borderRadius: '4px', cursor: 'pointer',
                              background: p === safePage ? '#e2a06e' : '#fff',
                              color: p === safePage ? '#fff' : '#333',
                            }}
                          >
                            {p}
                          </button>
                        )
                      )
                    }
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      style={{ padding: '8px 14px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', color: safePage >= totalPages ? '#ccc' : '#333', cursor: safePage >= totalPages ? 'default' : 'pointer' }}
                    >
                      다음 ›
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── 우측 패널 ── */}
        <aside
          className="prop-sidebar-right shrink-0 border border-gray-200 bg-white"
          style={{ minWidth: '260px', maxWidth: '260px', position: 'sticky', top: headerHeight, overflowY: 'auto', alignSelf: 'flex-start' }}
        >
          <div className="bg-[#e2a06e] text-white" style={{ padding: '8px 12px' }}>
            <p style={{ fontSize: '16px', fontWeight: 600 }}>대표전화 CALL CENTER</p>
          </div>
          <div style={{ padding: '16px' }}>
            <p style={{ fontSize: '26px', fontWeight: 700, color: '#e2a06e', marginBottom: '4px' }}>010-8680-8151</p>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px', lineHeight: 1.6 }}>평일 10:00 - 19:00<br />토요일 10:00 - 19:00</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href="tel:010-8680-8151" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: '#e2a06e', color: '#fff', fontSize: '15px', fontWeight: 700, borderRadius: '8px', textDecoration: 'none', border: 'none', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#c4884e')}
                onMouseLeave={e => (e.currentTarget.style.background = '#e2a06e')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                전화 문의하기
              </a>
              <a href="sms:010-8680-8151" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: '#fff', color: '#e2a06e', fontSize: '15px', fontWeight: 700, borderRadius: '8px', border: '1px solid #e2a06e', textDecoration: 'none', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e2a06e'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#e2a06e'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                문자 문의하기
              </a>
              <a href="https://open.kakao.com/o/s3lwiwsh" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: '#FEE500', color: '#3C1E1E', fontSize: '15px', fontWeight: 700, borderRadius: '8px', border: 'none', textDecoration: 'none', transition: 'opacity 0.2s' }}
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
