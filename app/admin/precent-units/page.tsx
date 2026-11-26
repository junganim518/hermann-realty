'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { triggerPrecentRevalidate } from '@/lib/triggerPrecentRevalidate';
import PhotoManagerModal from './PhotoManagerModal';

type Unit = {
  id: string;
  unit_no: string;
  floor: string;
  zone: string;
  exclusive_area_py: number;
  contract_area_py: number;
  deposit_krw: number | null;
  monthly_rent_krw: number | null;
  status: string;
  memo: string | null;
  admin_memo: string | null;
  sale_price: number | null;
  sale_note: string | null;
};

// 자주 쓰는 비고 값 — datalist로 제안만 하고 자유 입력도 그대로 허용
const SALE_NOTE_SUGGESTIONS = ['미분양', '수익보장', '분양주직영'];

// 수익률 계산으로 나온 월세를 반올림하는 단위(원) — 만원 단위로 바꾸려면 10000
const RENT_ROUND_UNIT = 50000;

// 수익률(%) = 월세×12 ÷ (분양가−보증금) × 100. 분양가가 없거나 분양가≤보증금이면 계산 불가(null)
function calcYieldPct(salePrice: number | null, depositKrw: number | null, monthlyKrw: number | null): number | null {
  if (!salePrice) return null;
  const base = salePrice - (depositKrw ?? 0);
  if (base <= 0) return null;
  return ((monthlyKrw ?? 0) * 12 / base) * 100;
}

const ZONE_LABEL: Record<string, string> = {
  large: 'B1 대형',
  small: 'B1 소형',
  'street-fb': '1F F&B',
  'clinic-academy': '클리닉·학원',
  'mid-office': '중형 오피스',
  'section-office': '섹션 오피스',
};

const STATUS_OPTIONS = ['vacant', 'inquiry', 'leased'];
const STATUS_LABEL: Record<string, string> = { vacant: '공실', inquiry: '문의중', leased: '임대완료' };
const STATUS_COLOR: Record<string, string> = { vacant: '#166534', inquiry: '#92400e', leased: '#374151' };
const STATUS_BG: Record<string, string> = { vacant: '#dcfce7', inquiry: '#fef9c3', leased: '#f3f4f6' };

const FLOOR_ORDER = ['B1', '1F', '2F', '3F'];
const PY_TO_M2 = 3.3058;

// 원 단위 → "O억 O천만원" 표시 (선택 합계 막대에서만 사용 — 행 안의 숫자 칸은 쉼표만 쓰는 만원 단위로 바뀜)
function formatKRW(won: number | null) {
  if (!won) return '-';
  const man = Math.round(won / 10000);
  const uk = Math.floor(man / 10000);
  const rest = man % 10000;
  if (uk > 0) return rest > 0 ? `${uk}억 ${rest.toLocaleString()}만원` : `${uk}억`;
  return `${man.toLocaleString()}만원`;
}

// 선택 요약 막대의 금액 표시 — 합계가 0이어도(선택된 호실 전부 가격 미입력 등) "-" 대신 "0원"
function formatKRWSum(won: number) {
  const label = formatKRW(won);
  return label === '-' ? '0원' : label;
}

// 선택 요약 막대의 면적 표시 — 평 합계를 먼저 구하고, 그 합계 값 하나만 반올림(평 1자리)해서
// ㎡도 그 합계에서 바로 환산한다 (호실별로 미리 반올림한 값을 더하지 않음).
function formatPyAndM2(pySum: number) {
  return `${pySum.toFixed(1)}평 (${(pySum * PY_TO_M2).toFixed(1)}㎡)`;
}

// 원 단위 금액 → 입력칸에 쓰는 "만원" 숫자 문자열(쉼표 없음, AutoField가 표시할 때만 쉼표 입힘)
function toManStr(won: number | null): string {
  return won ? String(Math.round(won / 10000)) : '';
}

// 타이핑 중 숫자만 남기고, 맨 앞 '-'(음수 입력 방어용으로 통과시켰다가 commit에서 막음)만 허용
function sanitizeNumeric(raw: string): string {
  const neg = raw.trim().startsWith('-');
  const digits = raw.replace(/[^0-9]/g, '');
  return (neg && digits ? '-' : '') + digits;
}

// 천 단위 쉼표만 입힌 표시 — "만원"/"억" 글자는 붙이지 않음
function formatThousands(raw: string): string {
  if (!raw) return '';
  const n = Number(raw);
  if (isNaN(n)) return raw;
  return n.toLocaleString('en-US');
}

// ── 입력칸 공용 컴포넌트 ──
// 포커스 시점 값(baseline)과 다를 때만 blur/Enter에서 commit 호출, Esc는 원래 값으로 되돌리고 커밋 안 함.
// commit이 true를 반환하면 1.5초간 ✓ 표시.
function AutoField({
  value, commit, placeholder, list, numeric, align, as = 'input', rows, disabled, bold,
}: {
  value: string;
  commit: (v: string) => Promise<boolean>;
  placeholder?: string;
  list?: string;
  numeric?: boolean;
  align?: 'left' | 'right';
  as?: 'input' | 'textarea';
  rows?: number;
  disabled?: boolean;
  bold?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [baseline, setBaseline] = useState('');
  const [flash, setFlash] = useState(false);
  const cancellingRef = useRef(false);

  const rawShown = draft ?? value;
  const shown = numeric ? formatThousands(rawShown) : rawShown;

  const handleFocus = () => {
    if (draft !== null) return;
    setDraft(value);
    setBaseline(value);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft(numeric ? sanitizeNumeric(e.target.value) : e.target.value);
  };

  const handleBlur = async () => {
    if (cancellingRef.current) { cancellingRef.current = false; setDraft(null); return; }
    if (draft === null) return;
    const v = draft;
    setDraft(null); // 먼저 되돌려둠 — 실패/무변경 시 자동으로 원래 값(value prop)이 보임
    if (v === baseline) return; // 값이 바뀌지 않았으면 저장하지 않음
    const ok = await commit(v);
    if (ok) {
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && as !== 'textarea') {
      (e.target as HTMLElement).blur();
    } else if (e.key === 'Escape') {
      cancellingRef.current = true;
      setDraft(null);
      (e.target as HTMLElement).blur();
    }
  };

  const Tag: any = as === 'textarea' ? 'textarea' : 'input';

  return (
    <span style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <Tag
        className="pu-field"
        value={shown}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        list={list}
        rows={as === 'textarea' ? (rows ?? 2) : undefined}
        disabled={disabled}
        style={{
          width: '100%',
          height: as === 'textarea' ? 'auto' : '30px',
          fontSize: '13px',
          fontWeight: bold ? 700 : 400,
          borderRadius: '5px',
          padding: as === 'textarea' ? '6px 8px' : '0 8px',
          outline: 'none',
          background: '#fff',
          color: '#1a1a1a',
          textAlign: align ?? 'left',
          fontVariantNumeric: numeric ? 'tabular-nums' : undefined,
          boxSizing: 'border-box',
        } as React.CSSProperties}
      />
      {flash && (
        <span style={{ position: 'absolute', right: '-15px', top: '50%', transform: 'translateY(-50%)', color: '#16a34a', fontSize: '13px', fontWeight: 700, pointerEvents: 'none' }}>✓</span>
      )}
    </span>
  );
}

export default function PrecentUnitsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFloor, setFilterFloor] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [photoModalUnit, setPhotoModalUnit] = useState<Unit | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [headerHeight, setHeaderHeight] = useState(0);

  // "수익률 기준" 상태(화면 전용, DB 미저장 — 새로고침하면 해제): 잠긴 행 id와, 그때 입력한 목표 수익률(%)
  const [yieldLocked, setYieldLocked] = useState<Set<string>>(new Set());
  const [yieldTargets, setYieldTargets] = useState<Record<string, number>>({});

  // 사이트 상단(sticky) 헤더 높이 측정 — 표 헤더를 그 아래에 고정할 때 기준값으로 사용
  useEffect(() => {
    const measure = () => {
      const header = document.querySelector('header') as HTMLElement | null;
      setHeaderHeight(header ? header.offsetHeight : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return; }
      setAuthChecked(true);
    });
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    supabase
      .from('precent_units')
      .select('*')
      .order('floor')
      .order('unit_no')
      .then(({ data }) => {
        setUnits((data ?? []) as Unit[]);
        setLoading(false);
      });

    supabase.from('precent_unit_photos').select('unit_id').then(({ data }) => {
      const counts: Record<string, number> = {};
      (data ?? []).forEach((row: any) => { counts[row.unit_id] = (counts[row.unit_id] ?? 0) + 1; });
      setPhotoCounts(counts);
    });
  }, [authChecked]);

  // ── 행 단위 저장 순차 처리 — 같은 행에 대한 저장이 겹치지 않도록 순서대로 실행 ──
  const rowQueueRef = useRef<Record<string, Promise<boolean>>>({});
  const runForRow = (id: string, task: () => Promise<boolean>): Promise<boolean> => {
    const prevChain = rowQueueRef.current[id] ?? Promise.resolve(true);
    const result = prevChain.then(task, task);
    rowQueueRef.current[id] = result;
    return result;
  };

  // 공용 저장 함수 — 바뀐 필드를 한 번의 update에 모두 담아 저장 (중간 상태 없음)
  const saveField = (id: string, patch: Record<string, any>): Promise<boolean> =>
    runForRow(id, async () => {
      setSavingIds(prev => new Set(prev).add(id));
      const { error } = await supabase.from('precent_units').update(patch).eq('id', id);
      setSavingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      if (error) {
        alert(`저장 실패: ${error.message}`);
        return false;
      }
      setUnits(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
      triggerPrecentRevalidate();
      return true;
    });

  const updateStatus = (id: string, status: string) => {
    runForRow(id, async () => {
      setSavingIds(prev => new Set(prev).add(id));
      const { error } = await supabase.from('precent_units').update({ status }).eq('id', id);
      setSavingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      if (error) { alert(`상태 저장 실패: ${error.message}`); return false; }
      setUnits(prev => prev.map(u => u.id === id ? { ...u, status } : u));
      triggerPrecentRevalidate();
      return true;
    });
  };

  // ── 업종(상호) — DB 컬럼명은 memo 그대로(방문자 화면 노출용) ──
  const commitBusiness = (u: Unit) => async (raw: string) => {
    const value = raw.trim() || null;
    if (value === u.memo) return false;
    return saveField(u.id, { memo: value });
  };

  // ── 메모(비공개) — admin_memo, 방문자에게 절대 노출되지 않음 ──
  const commitAdminMemo = (u: Unit) => async (raw: string) => {
    const value = raw.trim() || null;
    if (value === u.admin_memo) return false;
    return saveField(u.id, { admin_memo: value });
  };

  // ── 비고(sale_note) — 업종(상호)/비공개 메모와 별개 칸 ──
  const commitSaleNote = (u: Unit) => async (raw: string) => {
    const value = raw.trim() || null;
    if (value === u.sale_note) return false;
    return saveField(u.id, { sale_note: value });
  };

  // ── 보증금 — 숫자 검증 + "수익률 기준" 잠금 행이면 월세를 함께 재계산해 한 번에 저장 ──
  const commitDeposit = (u: Unit) => async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed !== '' && (isNaN(Number(trimmed)) || Number(trimmed) < 0)) {
      alert('보증금은 0 이상 숫자(만원 단위)만 입력해주세요.');
      return false;
    }
    const deposit_krw = trimmed ? Math.round(Number(trimmed) * 10000) : null;
    if (deposit_krw === u.deposit_krw) return false;

    const patch: Record<string, any> = { deposit_krw };
    if (yieldLocked.has(u.id) && u.sale_price != null) {
      const target = yieldTargets[u.id];
      const base = u.sale_price - (deposit_krw ?? 0);
      if (target != null && base > 0) {
        patch.monthly_rent_krw = Math.round((((target / 100) * base) / 12) / RENT_ROUND_UNIT) * RENT_ROUND_UNIT;
      }
    }
    return saveField(u.id, patch);
  };

  // ── 월세 — 직접 수정하면 "수익률 기준" 잠금을 해제(화면 전용 상태, DB 미저장) ──
  const commitMonthly = (u: Unit) => async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed !== '' && (isNaN(Number(trimmed)) || Number(trimmed) < 0)) {
      alert('월세는 0 이상 숫자(만원 단위)만 입력해주세요.');
      return false;
    }
    const monthly_rent_krw = trimmed ? Math.round(Number(trimmed) * 10000) : null;
    if (monthly_rent_krw === u.monthly_rent_krw) return false;
    const ok = await saveField(u.id, { monthly_rent_krw });
    if (ok) {
      setYieldLocked(prev => { const n = new Set(prev); n.delete(u.id); return n; });
      setYieldTargets(prev => { const n = { ...prev }; delete n[u.id]; return n; });
    }
    return ok;
  };

  // ── 분양가 — 숫자 검증 + "수익률 기준" 잠금 행이면 월세를 함께 재계산해 한 번에 저장 ──
  const commitSalePrice = (u: Unit) => async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed !== '' && (isNaN(Number(trimmed)) || Number(trimmed) < 0)) {
      alert('분양가는 0 이상 숫자(만원 단위)만 입력해주세요.');
      return false;
    }
    const sale_price = trimmed ? Math.round(Number(trimmed) * 10000) : null;
    if (sale_price === u.sale_price) return false;

    const patch: Record<string, any> = { sale_price };
    if (yieldLocked.has(u.id)) {
      const target = yieldTargets[u.id];
      const base = sale_price != null ? sale_price - (u.deposit_krw ?? 0) : 0;
      if (target != null && sale_price != null && base > 0) {
        patch.monthly_rent_krw = Math.round((((target / 100) * base) / 12) / RENT_ROUND_UNIT) * RENT_ROUND_UNIT;
      }
    }
    return saveField(u.id, patch);
  };

  // ── 수익률(%) 입력 — 목표 수익률에 맞춰 월세를 계산해 저장하고, 그 행을 "수익률 기준"으로 잠근다 ──
  const commitYield = (u: Unit) => async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-') return false;
    const target = Number(trimmed);
    if (isNaN(target)) {
      alert('수익률은 숫자만 입력해주세요.');
      return false;
    }
    if (!u.sale_price) {
      alert('분양가가 없어 계산할 수 없습니다.');
      return false;
    }
    const base = u.sale_price - (u.deposit_krw ?? 0);
    if (base <= 0) {
      alert('분양가가 보증금보다 작거나 같아 계산할 수 없습니다.');
      return false;
    }
    const monthly_rent_krw = Math.round(((target / 100) * base / 12) / RENT_ROUND_UNIT) * RENT_ROUND_UNIT;
    const ok = await saveField(u.id, { monthly_rent_krw });
    if (ok) {
      setYieldLocked(prev => new Set(prev).add(u.id));
      setYieldTargets(prev => ({ ...prev, [u.id]: target }));
    }
    return ok;
  };

  // ── 다중 선택(합계용) — DB에 저장하지 않는 화면 전용 상태 ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleFloorSelect = (floorUnits: Unit[]) => {
    const allSelected = floorUnits.length > 0 && floorUnits.every(u => selectedIds.has(u.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      floorUnits.forEach(u => allSelected ? next.delete(u.id) : next.add(u.id));
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!authChecked) return null;

  const filtered = units.filter(u =>
    (!filterFloor || u.floor === filterFloor) &&
    (!filterZone || u.zone === filterZone) &&
    (!filterStatus || u.status === filterStatus)
  );

  const vacantCount = filtered.filter(u => u.status === 'vacant').length;

  // 필터와 무관하게 선택된 호실 전체 기준으로 합계를 낸다 (필터를 바꿔도 선택 자체는 유지됨)
  const selectedUnits = units.filter(u => selectedIds.has(u.id));
  const sumField = (field: 'exclusive_area_py' | 'contract_area_py' | 'deposit_krw' | 'monthly_rent_krw' | 'sale_price') =>
    selectedUnits.reduce((sum, u) => (u[field] != null ? sum + (u[field] as number) : sum), 0);
  const missingAreaCount = selectedUnits.filter(u => u.exclusive_area_py == null || u.contract_area_py == null).length;
  const missingPriceCount = selectedUnits.filter(u => u.deposit_krw == null || u.monthly_rent_krw == null).length;
  const exclusivePySum = sumField('exclusive_area_py');
  const contractPySum = sumField('contract_area_py');
  const depositSum = sumField('deposit_krw');
  const monthlySum = sumField('monthly_rent_krw');
  const salePriceSum = sumField('sale_price');
  // 평균 수익률 = Σ(월세×12) ÷ Σ(분양가−보증금) × 100 — 분양가 없는 호실은 제외
  const unitsWithSalePrice = selectedUnits.filter(u => u.sale_price != null);
  const missingSalePriceCount = selectedUnits.length - unitsWithSalePrice.length;
  const yieldDenominator = unitsWithSalePrice.reduce((sum, u) => sum + ((u.sale_price as number) - (u.deposit_krw ?? 0)), 0);
  const yieldNumerator = unitsWithSalePrice.reduce((sum, u) => sum + (u.monthly_rent_krw ?? 0) * 12, 0);
  const avgYieldPct = yieldDenominator > 0 ? (yieldNumerator / yieldDenominator) * 100 : null;
  const selectedUnitNos = selectedUnits.map(u => u.unit_no);
  const unitNoDisplay = selectedUnitNos.length <= 5
    ? selectedUnitNos.join(', ')
    : `${selectedUnitNos.slice(0, 5).join(', ')} 외 ${selectedUnitNos.length - 5}개`;

  const selSt: React.CSSProperties = { height: '34px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 10px', fontSize: '13px', outline: 'none', background: '#fff', color: '#333' };

  // PC 표의 열 폭 — px 합(체크 40+호실 70+업종 140+면적 100+보증금 90+월세 80+분양가 100+수익률 80+상태 90+비고 110+더보기 60=960) 대신
  // 같은 비율을 %로 환산해 table-layout:fixed에 적용한다. %의 합은 항상 100이므로 컨테이너 폭이 몇이든
  // (900px든 1440px든) 표 폭이 컨테이너를 절대 넘지 않아 가로 스크롤이 생기지 않는다.
  const COL_WIDTH: Record<string, string> = {
    check: '4%', unit: '7%', business: '15%', area: '10%', deposit: '9%',
    monthly: '8%', sale: '10%', yield: '8%', status: '9%', note: '11%', more: '9%',
  };

  // 층별 "전체 선택" 체크칸이 참조할, 화면에 보이는(필터 적용된) 호실 목록 — 표/카드 공용
  const floorGroups = new Map<string, Unit[]>();
  filtered.forEach(u => {
    if (!floorGroups.has(u.floor)) floorGroups.set(u.floor, []);
    floorGroups.get(u.floor)!.push(u);
  });

  const renderFloorInfo = (floor: string) => {
    const floorUnits = floorGroups.get(floor) ?? [];
    const floorVacant = floorUnits.filter(x => x.status === 'vacant').length;
    const floorAllSelected = floorUnits.length > 0 && floorUnits.every(fu => selectedIds.has(fu.id));
    const floorSomeSelected = !floorAllSelected && floorUnits.some(fu => selectedIds.has(fu.id));
    return { floorUnits, floorVacant, floorAllSelected, floorSomeSelected };
  };

  const stickyTh = (width: string): React.CSSProperties => ({
    width, padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#555',
    whiteSpace: 'nowrap', position: 'sticky', top: headerHeight, zIndex: 50,
    background: '#f8f8f8', borderBottom: '2px solid #e0e0e0',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', padding: '24px 20px', paddingBottom: selectedUnits.length > 0 ? '150px' : '24px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .pu-field { border: 1px solid #e3e3e3; transition: border-color 0.15s, background 0.15s; }
        .pu-field:hover { border-color: #bbb; }
        .pu-field:focus { border-color: #c47c30; background: #fffdf8; }
        .pu-field:disabled { opacity: 0.55; cursor: not-allowed; }
        .pu-field::placeholder { color: #bbb; }
        .pu-table-wrap { display: block; }
        .pu-cards { display: none; }
        @media (max-width: 899px) {
          .pu-table-wrap { display: none; }
          .pu-cards { display: block; }
        }
      ` }} />
      <datalist id="sale-note-suggestions">
        {SALE_NOTE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
      </datalist>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div>
            <a href="/admin" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>← 관리자 홈</a>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a1a', margin: '4px 0 0' }}>
              보라매 프리센트 호실 관리
            </h1>
          </div>
          <a href="/properties/boramae-precent" target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#c47c30', textDecoration: 'none', fontWeight: 600 }}>
            임대 페이지 보기 →
          </a>
        </div>

        {/* 필터 + 요약 */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <select value={filterFloor} onChange={e => setFilterFloor(e.target.value)} style={selSt}>
            <option value="">전체 층</option>
            {FLOOR_ORDER.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={filterZone} onChange={e => setFilterZone(e.target.value)} style={selSt}>
            <option value="">전체 존</option>
            {Object.entries(ZONE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selSt}>
            <option value="">전체 상태</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#555' }}>표시 {filtered.length}개</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>공실 {vacantCount}개</span>
          </div>
        </div>

        {/* ══════════ PC: 표 (900px 이상) ══════════ */}
        <div className="pu-table-wrap" style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>불러오는 중...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={stickyTh(COL_WIDTH.check)}></th>
                  <th style={stickyTh(COL_WIDTH.unit)}>호실</th>
                  <th style={stickyTh(COL_WIDTH.business)}>업종(상호)</th>
                  <th style={stickyTh(COL_WIDTH.area)}>전용/계약(평)</th>
                  <th style={{ ...stickyTh(COL_WIDTH.deposit), textAlign: 'right' }}>보증금(만원)</th>
                  <th style={{ ...stickyTh(COL_WIDTH.monthly), textAlign: 'right' }}>월세(만원)</th>
                  <th style={{ ...stickyTh(COL_WIDTH.sale), textAlign: 'right' }}>분양가(만원)</th>
                  <th style={{ ...stickyTh(COL_WIDTH.yield), textAlign: 'right' }}>수익률(%)</th>
                  <th style={stickyTh(COL_WIDTH.status)}>상태</th>
                  <th style={stickyTh(COL_WIDTH.note)}>비고</th>
                  <th style={stickyTh(COL_WIDTH.more)}></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: React.ReactNode[] = [];
                  let lastFloor: string | null = null;
                  let rowIndex = 0;

                  filtered.forEach(u => {
                    if (u.floor !== lastFloor) {
                      lastFloor = u.floor;
                      const { floorUnits, floorVacant, floorAllSelected, floorSomeSelected } = renderFloorInfo(u.floor);
                      rows.push(
                        <tr key={`floor-${u.floor}`}>
                          <td style={{ padding: '10px', background: '#eef1f5', borderBottom: '1px solid #e0e0e0', borderTop: '2px solid #d7dbe0', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={floorAllSelected}
                              ref={el => { if (el) el.indeterminate = floorSomeSelected; }}
                              onChange={() => toggleFloorSelect(floorUnits)}
                              title={`${u.floor} 전체 선택/해제`}
                              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                            />
                          </td>
                          <td colSpan={10} style={{ padding: '8px 12px', background: '#eef1f5', fontWeight: 800, fontSize: '13px', color: '#1a1a1a', borderBottom: '1px solid #e0e0e0', borderTop: '2px solid #d7dbe0' }}>
                            {u.floor} <span style={{ fontWeight: 500, fontSize: '12px', color: '#777' }}>· {floorUnits.length}개 · 공실 {floorVacant}개</span>
                          </td>
                        </tr>
                      );
                    }

                    const i = rowIndex++;
                    const isSelected = selectedIds.has(u.id);
                    const isLeased = u.status === 'leased';
                    const isYieldLocked = yieldLocked.has(u.id);
                    const yieldDisplay = calcYieldPct(u.sale_price, u.deposit_krw, u.monthly_rent_krw);
                    const yieldStr = yieldDisplay != null ? yieldDisplay.toFixed(1) : '-';
                    const isSaving = savingIds.has(u.id);
                    const isExpanded = expandedIds.has(u.id);
                    const hasExtra = !!u.admin_memo || (photoCounts[u.id] ?? 0) > 0;
                    const rowBg = isSelected ? '#fff7ec' : isLeased ? '#f6f6f6' : i % 2 === 0 ? '#fff' : '#fafafa';

                    rows.push(
                      <tr key={u.id} style={{ borderBottom: isExpanded ? 'none' : '1px solid #f0f0f0', background: rowBg }}>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(u.id)}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '8px', fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.unit_no}</td>
                        <td style={{ padding: '6px 4px' }}>
                          <AutoField
                            value={u.memo ?? ''}
                            commit={commitBusiness(u)}
                            placeholder="미입력"
                            disabled={isSaving}
                            bold={isLeased}
                          />
                        </td>
                        <td style={{ padding: '8px 6px', color: '#333', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {u.exclusive_area_py.toFixed(1)} / {u.contract_area_py.toFixed(1)}
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <AutoField value={toManStr(u.deposit_krw)} commit={commitDeposit(u)} numeric align="right" disabled={isSaving} />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <AutoField value={toManStr(u.monthly_rent_krw)} commit={commitMonthly(u)} numeric align="right" disabled={isSaving} />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <AutoField value={toManStr(u.sale_price)} commit={commitSalePrice(u)} numeric align="right" disabled={isSaving} />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <AutoField value={yieldStr} commit={commitYield(u)} align="right" disabled={isSaving} placeholder="-" />
                            {isYieldLocked && <span title="수익률 기준으로 월세가 자동 계산되는 호실입니다" style={{ flexShrink: 0 }}>🔒</span>}
                          </div>
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <select
                            value={u.status}
                            onChange={e => updateStatus(u.id, e.target.value)}
                            disabled={isSaving}
                            className="pu-field"
                            style={{
                              width: '100%', height: '30px', borderRadius: '5px', padding: '0 4px',
                              fontSize: '12px', fontWeight: 600, cursor: 'pointer', outline: 'none',
                              background: STATUS_BG[u.status] ?? '#f3f4f6',
                              color: STATUS_COLOR[u.status] ?? '#374151',
                            }}
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <AutoField value={u.sale_note ?? ''} commit={commitSaleNote(u)} placeholder="-" list="sale-note-suggestions" disabled={isSaving} />
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <button
                            onClick={() => toggleExpand(u.id)}
                            title="메모/사진 더보기"
                            style={{
                              position: 'relative', width: '30px', height: '30px', border: '1px solid #e3e3e3', borderRadius: '5px',
                              background: isExpanded ? '#f3f4f6' : '#fff', color: '#555', cursor: 'pointer', fontSize: '14px',
                            }}
                          >
                            {isExpanded ? '▲' : '▾'}
                            {hasExtra && !isExpanded && (
                              <span style={{ position: 'absolute', top: '2px', right: '2px', width: '6px', height: '6px', borderRadius: '50%', background: '#e2a06e' }} />
                            )}
                          </button>
                        </td>
                      </tr>
                    );

                    if (isExpanded) {
                      rows.push(
                        <tr key={`${u.id}-expand`} style={{ borderBottom: '1px solid #f0f0f0', background: rowBg }}>
                          <td></td>
                          <td colSpan={10} style={{ padding: '4px 10px 14px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div style={{ flex: '1 1 260px', minWidth: '220px' }}>
                                <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>메모(비공개) — 방문자에게 노출되지 않음</div>
                                <AutoField
                                  value={u.admin_memo ?? ''}
                                  commit={commitAdminMemo(u)}
                                  as="textarea"
                                  rows={2}
                                  placeholder="메모 없음"
                                  disabled={isSaving}
                                />
                              </div>
                              <button
                                onClick={() => setPhotoModalUnit(u)}
                                style={{ flexShrink: 0, height: '30px', padding: '0 12px', fontSize: '12px', fontWeight: 600, border: '1px solid #ddd', borderRadius: '5px', background: '#fff', color: '#555', cursor: 'pointer', marginTop: '18px' }}
                              >
                                사진 {photoCounts[u.id] ?? 0}장
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  });

                  return rows;
                })()}
              </tbody>
            </table>
          )}
        </div>

        {/* ══════════ 모바일: 카드형 (900px 미만) ══════════ */}
        <div className="pu-cards">
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>불러오는 중...</p>
          ) : (() => {
            const cards: React.ReactNode[] = [];
            let lastFloor: string | null = null;

            filtered.forEach(u => {
              if (u.floor !== lastFloor) {
                lastFloor = u.floor;
                const { floorUnits, floorVacant, floorAllSelected, floorSomeSelected } = renderFloorInfo(u.floor);
                cards.push(
                  <div key={`floor-${u.floor}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#eef1f5', borderRadius: '8px', padding: '10px 12px', margin: '14px 0 8px' }}>
                    <input
                      type="checkbox"
                      checked={floorAllSelected}
                      ref={el => { if (el) el.indeterminate = floorSomeSelected; }}
                      onChange={() => toggleFloorSelect(floorUnits)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontWeight: 800, fontSize: '14px', color: '#1a1a1a' }}>{u.floor}</span>
                    <span style={{ fontSize: '12px', color: '#777' }}>· {floorUnits.length}개 · 공실 {floorVacant}개</span>
                  </div>
                );
              }

              const isSelected = selectedIds.has(u.id);
              const isLeased = u.status === 'leased';
              const isYieldLocked = yieldLocked.has(u.id);
              const yieldDisplay = calcYieldPct(u.sale_price, u.deposit_krw, u.monthly_rent_krw);
              const yieldStr = yieldDisplay != null ? yieldDisplay.toFixed(1) : '-';
              const isSaving = savingIds.has(u.id);
              const isExpanded = expandedIds.has(u.id);
              const hasExtra = !!u.admin_memo || (photoCounts[u.id] ?? 0) > 0;

              const fieldLabelSt: React.CSSProperties = { fontSize: '11px', color: '#888', marginBottom: '3px' };

              cards.push(
                <div key={u.id} style={{
                  background: isSelected ? '#fff7ec' : isLeased ? '#f6f6f6' : '#fff',
                  border: '1px solid #e8e8e8', borderRadius: '10px', padding: '14px', marginBottom: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(u.id)}
                      style={{ width: '22px', height: '22px', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '18px', fontWeight: 800, color: '#1a1a1a' }}>{u.unit_no}</span>
                    <span style={{ fontSize: '12px', color: '#999' }}>전용/계약 {u.exclusive_area_py.toFixed(1)} / {u.contract_area_py.toFixed(1)}평</span>
                    <select
                      value={u.status}
                      onChange={e => updateStatus(u.id, e.target.value)}
                      disabled={isSaving}
                      className="pu-field"
                      style={{
                        marginLeft: 'auto', height: '30px', borderRadius: '5px', padding: '0 6px',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer', outline: 'none', flexShrink: 0,
                        background: STATUS_BG[u.status] ?? '#f3f4f6',
                        color: STATUS_COLOR[u.status] ?? '#374151',
                      }}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <div style={fieldLabelSt}>업종(상호)</div>
                    <AutoField value={u.memo ?? ''} commit={commitBusiness(u)} placeholder="미입력" disabled={isSaving} bold={isLeased} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <div style={fieldLabelSt}>보증금(만원)</div>
                      <AutoField value={toManStr(u.deposit_krw)} commit={commitDeposit(u)} numeric align="right" disabled={isSaving} />
                    </div>
                    <div>
                      <div style={fieldLabelSt}>월세(만원)</div>
                      <AutoField value={toManStr(u.monthly_rent_krw)} commit={commitMonthly(u)} numeric align="right" disabled={isSaving} />
                    </div>
                    <div>
                      <div style={fieldLabelSt}>분양가(만원)</div>
                      <AutoField value={toManStr(u.sale_price)} commit={commitSalePrice(u)} numeric align="right" disabled={isSaving} />
                    </div>
                    <div>
                      <div style={fieldLabelSt}>수익률(%) {isYieldLocked && '🔒'}</div>
                      <AutoField value={yieldStr} commit={commitYield(u)} align="right" disabled={isSaving} placeholder="-" />
                    </div>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <div style={fieldLabelSt}>비고</div>
                    <AutoField value={u.sale_note ?? ''} commit={commitSaleNote(u)} placeholder="-" list="sale-note-suggestions" disabled={isSaving} />
                  </div>

                  <button
                    onClick={() => toggleExpand(u.id)}
                    style={{
                      position: 'relative', width: '100%', height: '32px', border: '1px solid #e3e3e3', borderRadius: '6px',
                      background: isExpanded ? '#f3f4f6' : '#fff', color: '#555', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    }}
                  >
                    {isExpanded ? '▲ 접기' : '▾ 더보기 (메모·사진)'}
                    {hasExtra && !isExpanded && (
                      <span style={{ position: 'absolute', top: '4px', right: '10px', width: '6px', height: '6px', borderRadius: '50%', background: '#e2a06e' }} />
                    )}
                  </button>

                  {isExpanded && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={fieldLabelSt}>메모(비공개) — 방문자에게 노출되지 않음</div>
                      <AutoField value={u.admin_memo ?? ''} commit={commitAdminMemo(u)} as="textarea" rows={2} placeholder="메모 없음" disabled={isSaving} />
                      <button
                        onClick={() => setPhotoModalUnit(u)}
                        style={{ marginTop: '8px', width: '100%', height: '32px', fontSize: '12px', fontWeight: 600, border: '1px solid #ddd', borderRadius: '6px', background: '#fff', color: '#555', cursor: 'pointer' }}
                      >
                        사진 {photoCounts[u.id] ?? 0}장
                      </button>
                    </div>
                  )}
                </div>
              );
            });

            return cards;
          })()}
        </div>
      </div>

      {photoModalUnit && (
        <PhotoManagerModal
          unitId={photoModalUnit.id}
          unitNo={photoModalUnit.unit_no}
          onClose={() => setPhotoModalUnit(null)}
          onCountChange={(unitId, count) => setPhotoCounts(prev => ({ ...prev, [unitId]: count }))}
        />
      )}

      {/* 선택 요약 막대 — 관리자 화면 전용, 선택 상태는 DB에 저장하지 않음 */}
      {selectedUnits.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 400,
          background: '#1a1a1a', color: '#fff', padding: '12px 20px',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.25)',
          display: 'flex', flexWrap: 'wrap', gap: '8px 24px', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'baseline', flex: '1 1 240px', minWidth: '240px' }}>
            <span style={{ fontWeight: 800, fontSize: '14px', color: '#e2a06e', whiteSpace: 'nowrap' }}>{selectedUnits.length}개 선택</span>
            <span style={{ fontSize: '12px', color: '#ccc', wordBreak: 'break-all' }}>{unitNoDisplay}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: '12px', color: '#eee' }}>
            <span>전용 {formatPyAndM2(exclusivePySum)}</span>
            <span>계약 {formatPyAndM2(contractPySum)}</span>
            <span>보증금 {formatKRWSum(depositSum)}</span>
            <span>월세 {formatKRWSum(monthlySum)}</span>
            <span>분양가 {formatKRWSum(salePriceSum)}</span>
            <span>평균 수익률 {avgYieldPct != null ? `${avgYieldPct.toFixed(1)}%` : '-'}</span>
            {missingAreaCount > 0 && <span style={{ color: '#fbbf24' }}>면적 미입력 {missingAreaCount}개 제외</span>}
            {missingPriceCount > 0 && <span style={{ color: '#fbbf24' }}>가격 미입력 {missingPriceCount}개 제외</span>}
            {missingSalePriceCount > 0 && <span style={{ color: '#fbbf24' }}>분양가 없는 {missingSalePriceCount}개 제외</span>}
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ height: '32px', padding: '0 14px', fontSize: '12px', fontWeight: 700, background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            선택 해제
          </button>
        </div>
      )}
    </div>
  );
}
