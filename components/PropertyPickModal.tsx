'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ALL_THEMES } from '@/lib/themeUtils';
import { matchRange, matchAreaRange, matchFloor } from '@/lib/propertyFilter';

const TX_TYPES = ['전체', '월세', '전세', '매매'];
const FLOOR_RANGES = ['전체', '지하', '1층', '2층 이상'];
const PROPERTY_TYPES = ['상가', '사무실', '오피스텔', '아파트', '건물', '기타'];
const THEME_DISPLAY: Record<string, string> = {
  '사옥형및통임대': '사옥형 및 통임대', '대형상가': '대형 상가',
  '무권리상가': '무권리 상가', '프랜차이즈양도양수': '프랜차이즈 양도양수',
  '1층상가': '1층 상가', '2층이상상가': '2층 이상 상가',
};
const THEME_GROUPS = [
  { label: '매물 특성', themes: ALL_THEMES.slice(0, 9) },
  { label: '위치·조건', themes: ALL_THEMES.slice(9, 18) },
  { label: '업종', themes: ALL_THEMES.slice(18) },
];

export type PickedItem = { id: string; memo: string };

type Props = {
  open: boolean;
  onClose: () => void;
  allProperties: any[];
  alreadyPickedIds?: Set<string>;
  onAdd: (picks: PickedItem[]) => void;
  adding?: boolean;
  title?: string;
};

export default function PropertyPickModal({
  open, onClose, allProperties, alreadyPickedIds, onAdd, adding = false, title = '매물 추가',
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterThemes, setFilterThemes] = useState<string[]>([]);
  const [filterTx, setFilterTx] = useState('전체');
  const [filterFloor, setFilterFloor] = useState('전체');
  const [includeSold, setIncludeSold] = useState(false);
  const [depositMin, setDepositMin] = useState('');
  const [depositMax, setDepositMax] = useState('');
  const [rentMin, setRentMin] = useState('');
  const [rentMax, setRentMax] = useState('');
  const [areaMin, setAreaMin] = useState('');
  const [areaMax, setAreaMax] = useState('');
  const [premiumMin, setPremiumMin] = useState('');
  const [premiumMax, setPremiumMax] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [openTypesDD, setOpenTypesDD] = useState(false);
  const [openThemesDD, setOpenThemesDD] = useState(false);
  const typesDDRef = useRef<HTMLDivElement>(null);
  const themesDDRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSearchQuery(''); setFilterTypes([]); setFilterThemes([]);
      setFilterTx('전체'); setFilterFloor('전체'); setIncludeSold(false);
      setDepositMin(''); setDepositMax(''); setRentMin(''); setRentMax('');
      setAreaMin(''); setAreaMax(''); setPremiumMin(''); setPremiumMax('');
      setSelectedIds(new Set()); setMemos({});
      setOpenTypesDD(false); setOpenThemesDD(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!openTypesDD) return;
    const h = (e: MouseEvent) => {
      if (typesDDRef.current && !typesDDRef.current.contains(e.target as Node)) setOpenTypesDD(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [openTypesDD]);

  useEffect(() => {
    if (!openThemesDD) return;
    const h = (e: MouseEvent) => {
      if (themesDDRef.current && !themesDDRef.current.contains(e.target as Node)) setOpenThemesDD(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [openThemesDD]);

  if (!open) return null;

  const q = searchQuery.trim().toLowerCase();
  const filteredResults = allProperties.filter(p => {
    if (!includeSold && (p.is_sold || p.status === '거래완료')) return false;
    if (filterTypes.length > 0 && !filterTypes.includes(p.property_type)) return false;
    if (filterThemes.length > 0) {
      const pThemes = (p.theme_type ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
      if (!filterThemes.every((t: string) => pThemes.includes(t))) return false;
    }
    if (filterTx !== '전체' && p.transaction_type !== filterTx) return false;
    if (!matchFloor(p.current_floor, filterFloor)) return false;
    if (!matchRange(p.deposit, depositMin, depositMax)) return false;
    if (!matchRange(p.monthly_rent, rentMin, rentMax)) return false;
    if (!matchAreaRange(p.exclusive_area, p.supply_area, areaMin, areaMax)) return false;
    if (!matchRange(p.premium, premiumMin, premiumMax)) return false;
    if (q) {
      const hay = `${p.property_number ?? ''} ${p.address ?? ''} ${p.title ?? ''} ${p.theme_type ?? ''} ${p.building_name ?? ''} ${p.business_name ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).slice(0, 100);

  const toggleSelect = (pid: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  };

  const handleAdd = () => {
    onAdd(Array.from(selectedIds).map(id => ({ id, memo: memos[id] ?? '' })));
  };

  const resetFilters = () => {
    setFilterTypes([]); setFilterThemes([]); setFilterTx('전체'); setFilterFloor('전체');
    setIncludeSold(false);
    setDepositMin(''); setDepositMax(''); setRentMin(''); setRentMax('');
    setAreaMin(''); setAreaMax(''); setPremiumMin(''); setPremiumMax('');
  };

  const hasFilter = filterTypes.length > 0 || filterThemes.length > 0
    || filterTx !== '전체' || filterFloor !== '전체'
    || depositMin || depositMax || rentMin || rentMax
    || areaMin || areaMax || premiumMin || premiumMax;

  const selectSt: React.CSSProperties = {
    height: '32px', border: '1px solid #ddd', borderRadius: '6px',
    padding: '0 8px', fontSize: '12px', color: '#555', background: '#fff',
    cursor: 'pointer', outline: 'none',
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px', overflow: 'auto' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: 'auto' }}
      >
        {/* 헤더 */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
            {title} <span style={{ fontSize: '13px', fontWeight: 500, color: '#888' }}>({selectedIds.size}개 선택)</span>
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#666' }}>
            <X size={20} />
          </button>
        </div>

        {/* 필터 영역 */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          {/* 검색 + 초기화 */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="매물번호 / 주소 / 건물명 / 키워드"
              style={{ flex: 1, height: '36px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
            />
            {(hasFilter || searchQuery) && (
              <button type="button" onClick={() => { resetFilters(); setSearchQuery(''); }}
                style={{ height: '36px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', color: '#e05050', background: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                초기화
              </button>
            )}
          </div>

          {/* 드롭다운 필터 행 */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* 매물종류 드롭다운 */}
            <div ref={typesDDRef} style={{ position: 'relative' }}>
              <button type="button" onClick={() => { setOpenTypesDD(v => !v); setOpenThemesDD(false); }}
                style={{ height: '32px', padding: '0 10px', border: `1px solid ${filterTypes.length > 0 ? '#1a1a1a' : '#ddd'}`, borderRadius: '6px', fontSize: '12px', color: filterTypes.length > 0 ? '#e2a06e' : '#555', background: filterTypes.length > 0 ? '#1a1a1a' : '#fff', cursor: 'pointer', outline: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                매물종류{filterTypes.length > 0 ? ` (${filterTypes.length})` : ''} <span style={{ fontSize: '9px', opacity: 0.6 }}>▼</span>
              </button>
              {openTypesDD && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '6px', minWidth: '130px' }}>
                  {PROPERTY_TYPES.map(t => {
                    const checked = filterTypes.includes(t);
                    return (
                      <label key={t}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '13px', borderRadius: '4px', color: '#333', userSelect: 'none' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f5f5'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <input type="checkbox" checked={checked} style={{ accentColor: '#1a1a1a', width: '14px', height: '14px', cursor: 'pointer', flexShrink: 0 }}
                          onChange={() => setFilterTypes(checked ? filterTypes.filter(x => x !== t) : [...filterTypes, t])} />
                        {t}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 거래유형 */}
            <select value={filterTx} onChange={e => setFilterTx(e.target.value)} style={selectSt}>
              {TX_TYPES.map(t => <option key={t} value={t}>{t === '전체' ? '거래유형 전체' : t}</option>)}
            </select>

            {/* 층수 */}
            <select value={filterFloor} onChange={e => setFilterFloor(e.target.value)} style={selectSt}>
              {FLOOR_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '층수 전체' : t}</option>)}
            </select>

            {/* 테마 드롭다운 */}
            <div ref={themesDDRef} style={{ position: 'relative' }}>
              <button type="button" onClick={() => { setOpenThemesDD(v => !v); setOpenTypesDD(false); }}
                style={{ height: '32px', padding: '0 10px', border: `1px solid ${filterThemes.length > 0 ? '#e2a06e' : '#ddd'}`, borderRadius: '6px', fontSize: '12px', color: filterThemes.length > 0 ? '#fff' : '#555', background: filterThemes.length > 0 ? '#e2a06e' : '#fff', cursor: 'pointer', outline: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                테마{filterThemes.length > 0 ? ` (${filterThemes.length})` : ''} <span style={{ fontSize: '9px', opacity: 0.6 }}>▼</span>
              </button>
              {openThemesDD && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: '360px', overflowY: 'auto', minWidth: '200px', maxWidth: 'min(260px, calc(100vw - 16px))' }}>
                  {THEME_GROUPS.map(group => (
                    <div key={group.label}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#aaa', padding: '8px 10px 3px', letterSpacing: '0.3px' }}>{group.label}</div>
                      {group.themes.map(t => {
                        const checked = filterThemes.includes(t);
                        return (
                          <label key={t}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '13px', color: '#333', userSelect: 'none' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f9f9f9'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <input type="checkbox" checked={checked} style={{ accentColor: '#e2a06e', width: '14px', height: '14px', cursor: 'pointer', flexShrink: 0 }}
                              onChange={() => setFilterThemes(checked ? filterThemes.filter(x => x !== t) : [...filterThemes, t])} />
                            {THEME_DISPLAY[t] ?? t}
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 거래완료 포함 */}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#555', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={includeSold} onChange={e => setIncludeSold(e.target.checked)} />
              거래완료 포함
            </label>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#888', whiteSpace: 'nowrap' }}>
              {filteredResults.length === 100 ? '100개 이상' : `${filteredResults.length}개`}
            </span>
          </div>

          {/* 범위 입력 */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {([
              { label: '보증금', minV: depositMin, maxV: depositMax, setMin: setDepositMin, setMax: setDepositMax, unit: '만' },
              { label: '월세', minV: rentMin, maxV: rentMax, setMin: setRentMin, setMax: setRentMax, unit: '만' },
              { label: '면적', minV: areaMin, maxV: areaMax, setMin: setAreaMin, setMax: setAreaMax, unit: '평' },
              { label: '권리금', minV: premiumMin, maxV: premiumMax, setMin: setPremiumMin, setMax: setPremiumMax, unit: '만' },
            ] as const).map(({ label, minV, maxV, setMin, setMax, unit }) => (
              <div key={label} style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>{label}</span>
                <input type="number" min="0" value={minV} onChange={e => setMin(e.target.value)} placeholder="최소"
                  style={{ width: '52px', height: '28px', border: '1px solid #ddd', borderRadius: '4px', padding: '0 4px', fontSize: '11px', outline: 'none', textAlign: 'center' }} />
                <span style={{ fontSize: '11px', color: '#aaa' }}>~</span>
                <input type="number" min="0" value={maxV} onChange={e => setMax(e.target.value)} placeholder="최대"
                  style={{ width: '52px', height: '28px', border: '1px solid #ddd', borderRadius: '4px', padding: '0 4px', fontSize: '11px', outline: 'none', textAlign: 'center' }} />
                <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>{unit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 결과 목록 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px', minHeight: 0, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {filteredResults.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px 0', color: '#aaa', fontSize: '13px' }}>일치하는 매물이 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredResults.map(p => {
                const isSelected = selectedIds.has(p.id);
                const isAlreadyPicked = !!(alreadyPickedIds?.has(p.id));
                const priceStr = (() => {
                  if (p.transaction_type === '매매') {
                    const v = p.sale_price || p.deposit;
                    return v ? `매매 ${(v as number).toLocaleString()}` : '-';
                  }
                  const parts: string[] = [];
                  if (p.deposit) parts.push(`보 ${(p.deposit as number).toLocaleString()}`);
                  if (p.monthly_rent) parts.push(`월 ${(p.monthly_rent as number).toLocaleString()}`);
                  return parts.length ? parts.join('/') : '-';
                })();
                const premiumStr = p.premium && p.premium > 0
                  ? `권리금 ${(p.premium as number).toLocaleString()}만`
                  : '무권리';
                const sqm = parseFloat(p.exclusive_area) || parseFloat(p.supply_area);
                const areaStr = sqm ? `${(sqm / 3.3058).toFixed(1)}평` : null;
                return (
                  <div
                    key={p.id}
                    onClick={() => !isAlreadyPicked && toggleSelect(p.id)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', borderRadius: '6px', background: isAlreadyPicked ? '#f5f5f5' : isSelected ? '#fff8f2' : '#fff', border: `1px solid ${isAlreadyPicked ? '#e5e5e5' : isSelected ? '#e2a06e' : '#eee'}`, cursor: isAlreadyPicked ? 'not-allowed' : 'pointer', opacity: isAlreadyPicked ? 0.55 : 1 }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isAlreadyPicked}
                      onChange={() => !isAlreadyPicked && toggleSelect(p.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ width: '16px', height: '16px', accentColor: '#e2a06e', cursor: isAlreadyPicked ? 'not-allowed' : 'pointer', flexShrink: 0, marginTop: '2px' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* 첫 줄: 매물번호·거래유형·종류·상호명·가격 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>{p.property_number}</span>
                        {p.transaction_type && <span style={{ fontSize: '10px', color: '#e2a06e', fontWeight: 700 }}>{p.transaction_type}</span>}
                        {p.property_type && <span style={{ fontSize: '10px', color: '#666', padding: '1px 5px', background: '#f5f5f5', borderRadius: '3px' }}>{p.property_type}</span>}
                        {p.business_name && (
                          <span title={p.business_name_public ? '공개' : '비공개 (관리자만 표시)'} style={{ fontSize: '11px', fontWeight: 600, color: p.business_name_public ? '#374151' : '#92400e', whiteSpace: 'nowrap' }}>
                            {p.business_name_public ? '🏪' : '🔒'} {p.business_name}
                          </span>
                        )}
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>{priceStr}</span>
                        {(p.is_sold || p.status === '거래완료') && <span style={{ fontSize: '10px', color: '#e05050', fontWeight: 700 }}>거래완료</span>}
                        {isAlreadyPicked && <span style={{ fontSize: '10px', color: '#888', fontWeight: 700, padding: '1px 5px', background: '#f0f0f0', borderRadius: '3px' }}>이미 추가됨</span>}
                      </div>
                      {/* 둘째 줄: 주소·건물명 */}
                      <p style={{ fontSize: '11px', color: '#666', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.address ?? '-'}
                        {p.building_name && <span style={{ color: '#e2a06e', marginLeft: '4px' }}>{p.building_name}</span>}
                      </p>
                      {/* 셋째 줄: 권리금·면적 */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: p.premium && p.premium > 0 ? '#92400e' : '#aaa' }}>{premiumStr}</span>
                        {areaStr && <span style={{ fontSize: '11px', color: '#666' }}>{areaStr}</span>}
                      </div>
                      {isSelected && (
                        <input
                          value={memos[p.id] ?? ''}
                          onChange={e => setMemos(prev => ({ ...prev, [p.id]: e.target.value }))}
                          onClick={e => e.stopPropagation()}
                          placeholder="추천 이유 (선택)"
                          style={{ marginTop: '4px', width: '100%', height: '26px', fontSize: '11px', padding: '0 8px', border: '1px solid #e2a06e', borderRadius: '4px', outline: 'none', background: '#fff' }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>
          <button type="button" onClick={onClose}
            style={{ padding: '8px 14px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            취소
          </button>
          <button type="button" onClick={handleAdd} disabled={selectedIds.size === 0 || adding}
            style={{ padding: '8px 18px', background: selectedIds.size === 0 || adding ? '#ccc' : '#e2a06e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: selectedIds.size === 0 || adding ? 'not-allowed' : 'pointer' }}>
            {adding ? '추가 중...' : `${selectedIds.size}개 추가`}
          </button>
        </div>
      </div>
    </div>
  );
}
