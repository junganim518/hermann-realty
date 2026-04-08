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

const PAGE_SIZE = 20;

export default function PropertiesPage() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') ?? '';
  const themeParam = searchParams.get('theme') ?? '';

  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(200);
  const [filterTx, setFilterTx] = useState('전체');
  const [filterArea, setFilterArea] = useState('전체');
  const [filterDeposit, setFilterDeposit] = useState('전체');
  const [filterRent, setFilterRent] = useState('전체');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const title = themeParam ? themeParam : typeParam ? `${typeParam} 매물` : '전체 매물';

  useEffect(() => {
    const h = document.querySelector('header') as HTMLElement;
    if (h) setHeaderHeight(h.offsetHeight);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase.from('properties').select('*').order('created_at', { ascending: false });
      if (typeParam) query = query.eq('property_type', typeParam);
      if (themeParam) query = query.ilike('theme_type', `%${themeParam}%`);
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
      setVisibleCount(PAGE_SIZE);
    })();
  }, [typeParam, themeParam]);

  const filtered = allProperties.filter(p => {
    if (filterTx !== '전체' && p.transaction_type !== filterTx) return false;
    if (!matchArea(p.exclusive_area, filterArea)) return false;
    if (!matchDeposit(p.deposit, filterDeposit)) return false;
    if (!matchRent(p.monthly_rent, filterRent)) return false;
    return true;
  });

  const displayed = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const selectSt: React.CSSProperties = {
    height: '40px', border: '1px solid #ddd', borderRadius: '4px',
    padding: '0 10px', fontSize: '14px', color: '#555',
    background: '#fff', cursor: 'pointer', outline: 'none',
  };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh' }}>

      {/* 3열 레이아웃 */}
      <div className="flex items-start" style={{ width: 'calc(100% - 32px)', margin: '0 16px' }}>

        {/* ── 좌측 사이드바 ── */}
        <aside
          className="hidden lg:block shrink-0 border border-gray-200 bg-white"
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
                    style={{ fontSize: '16px', padding: '9px 16px', color: typeParam === type.id ? '#e2a06e' : '#333', fontWeight: typeParam === type.id ? 700 : 400, background: typeParam === type.id ? '#fff8f2' : 'transparent' }}
                  >
                    <span>{type.name}</span>
                    <span style={{ fontSize: '11px', color: typeParam === type.id ? '#e2a06e' : '#ccc' }}>›</span>
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
                    style={{ fontSize: '16px', padding: '9px 16px', color: themeParam === theme.id ? '#e2a06e' : '#333', fontWeight: themeParam === theme.id ? 700 : 400, background: themeParam === theme.id ? '#fff8f2' : 'transparent' }}
                  >
                    <span>{theme.name}</span>
                    <span style={{ fontSize: '11px', color: themeParam === theme.id ? '#e2a06e' : '#ccc' }}>›</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ── 중앙 콘텐츠 ── */}
        <div className="flex-1 min-w-0 px-4">

          {/* 타이틀 */}
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a' }}>{title}</h1>
            <p style={{ fontSize: '14px', color: '#888', marginTop: '4px' }}>
              총 <strong style={{ color: '#e2a06e' }}>{filtered.length}</strong>개 매물
            </p>
          </div>

          {/* 필터 바 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <select value={filterTx} onChange={e => { setFilterTx(e.target.value); setVisibleCount(PAGE_SIZE); }} style={selectSt}>
              {TX_TYPES.map(t => <option key={t} value={t}>{t === '전체' ? '거래유형 전체' : t}</option>)}
            </select>
            <select value={filterArea} onChange={e => { setFilterArea(e.target.value); setVisibleCount(PAGE_SIZE); }} style={selectSt}>
              {AREA_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '면적 전체' : t}</option>)}
            </select>
            <select value={filterDeposit} onChange={e => { setFilterDeposit(e.target.value); setVisibleCount(PAGE_SIZE); }} style={selectSt}>
              {DEPOSIT_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '보증금 전체' : t}</option>)}
            </select>
            <select value={filterRent} onChange={e => { setFilterRent(e.target.value); setVisibleCount(PAGE_SIZE); }} style={selectSt}>
              {RENT_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '월세 전체' : t}</option>)}
            </select>
            {(filterTx !== '전체' || filterArea !== '전체' || filterDeposit !== '전체' || filterRent !== '전체') && (
              <button
                onClick={() => { setFilterTx('전체'); setFilterArea('전체'); setFilterDeposit('전체'); setFilterRent('전체'); setVisibleCount(PAGE_SIZE); }}
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayed.map((p: any) => (
                  <Link
                    key={p.property_number}
                    href={`/item/view/${p.property_number}`}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block', transition: 'all 0.2s ease', cursor: 'pointer' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                    className="border border-gray-200 overflow-hidden bg-white"
                  >
                    <div className="bg-[#e2a06e] text-white flex justify-between items-center" style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{p.property_number}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }} className="truncate ml-2">{(p.title ?? '').replace(/헤르만\s*/g, '')}</span>
                    </div>
                    <div className="relative" style={{ height: '260px' }}>
                      {p.image ? (
                        <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-sm">준비중</div>
                      )}
                      {p.is_sold && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: '#fff', fontSize: '24px', fontWeight: 800, letterSpacing: '3px', border: '2px solid #fff', padding: '4px 16px', borderRadius: '4px', transform: 'rotate(-15deg)' }}>거래완료</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="mb-2">
                        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatAddress(p.address ?? '')}
                        </p>
                        <p style={{ fontSize: '13px', color: '#666' }}>
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
                            <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '3px', flexShrink: 0 }}>
                              {p.transaction_type}
                            </span>
                          );
                        })()}
                        <span style={{ fontSize: '18px', fontWeight: 700 }}>{buildPriceStr(p)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {hasMore && (
                <div style={{ textAlign: 'center', margin: '24px 0 40px' }}>
                  <button
                    onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                    className="border border-[#e2a06e] text-[#e2a06e] hover:bg-[#e2a06e] hover:text-white rounded-lg font-semibold transition"
                    style={{ fontSize: '15px', padding: '10px 32px' }}
                  >
                    매물 더보기 ({filtered.length - visibleCount}개 남음)
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── 우측 패널 ── */}
        <aside
          className="hidden xl:block shrink-0 border border-gray-200 bg-white"
          style={{ minWidth: '260px', maxWidth: '260px', position: 'sticky', top: headerHeight, overflowY: 'auto', alignSelf: 'flex-start' }}
        >
          <div className="bg-[#e2a06e] text-white" style={{ padding: '8px 12px' }}>
            <p style={{ fontSize: '16px', fontWeight: 600 }}>대표전화 CALL CENTER</p>
          </div>
          <div style={{ padding: '16px' }}>
            <p style={{ fontSize: '26px', fontWeight: 700, color: '#e2a06e', marginBottom: '4px' }}>010-8680-8151</p>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px', lineHeight: 1.6 }}>평일 10:00 - 19:00<br />토요일 10:00 - 19:00</p>
            <p style={{ fontSize: '16px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>상담 신청</p>
            <form className="space-y-2">
              <input type="text" placeholder="이름" className="w-full border border-gray-300 rounded focus:outline-none focus:border-[#e2a06e]" style={{ fontSize: '15px', padding: '10px 12px' }} />
              <input type="tel" placeholder="연락처" className="w-full border border-gray-300 rounded focus:outline-none focus:border-[#e2a06e]" style={{ fontSize: '15px', padding: '10px 12px' }} />
              <textarea placeholder="문의 내용" rows={4} className="w-full border border-gray-300 rounded focus:outline-none focus:border-[#e2a06e] resize-none" style={{ fontSize: '15px', padding: '10px 12px' }} />
              <div className="flex items-start gap-2">
                <input type="checkbox" id="privacy-prop" className="w-4 h-4 mt-0.5 shrink-0" />
                <label htmlFor="privacy-prop" style={{ fontSize: '12px', color: '#666', lineHeight: '1.5' }}>개인정보 수집 및 이용에 동의합니다.</label>
              </div>
              <button type="submit" className="w-full bg-[#e2a06e] hover:bg-[#A06828] text-white rounded font-semibold transition" style={{ fontSize: '18px', padding: '12px' }}>
                상담 신청하기
              </button>
            </form>
          </div>
        </aside>

      </div>
    </main>
  );
}
