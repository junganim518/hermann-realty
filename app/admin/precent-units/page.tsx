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

// PC 표 폭 비율(%), 100이면 전체 폭 — 나중에 쉽게 바꿀 수 있도록 상수로 둠
const TABLE_WIDTH_PCT = 100;

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
// autoGrow=true(업종/비고/메모): 줄바꿈되는 자동 높이 textarea. Enter=저장, Shift+Enter=줄바꿈.
//   말줄임/title 툴팁은 쓰지 않는다(긴 글은 줄바꿈으로 전체가 보이게 하는 쪽이라 필요 없음).
function AutoField({
  value, commit, placeholder, list, numeric, align, autoGrow, disabled, bold,
}: {
  value: string;
  commit: (v: string) => Promise<boolean>;
  placeholder?: string;
  list?: string;
  numeric?: boolean;
  align?: 'left' | 'right';
  autoGrow?: boolean;
  disabled?: boolean;
  bold?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [baseline, setBaseline] = useState('');
  const [flash, setFlash] = useState(false);
  const cancellingRef = useRef(false);
  const elRef = useRef<HTMLTextAreaElement | null>(null);

  const rawShown = draft ?? value;
  const shown = numeric ? formatThousands(rawShown) : rawShown;

  // 긴 글(업종/비고/메모) — 입력칸 높이를 내용(scrollHeight)에 맞춰 자동으로 늘린다
  useEffect(() => {
    if (!autoGrow || !elRef.current) return;
    const el = elRef.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [autoGrow, shown]);

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
    if (e.key === 'Escape') {
      cancellingRef.current = true;
      setDraft(null);
      (e.target as HTMLElement).blur();
      return;
    }
    if (e.key !== 'Enter') return;
    if (autoGrow && e.shiftKey) return; // Shift+Enter = 줄바꿈(기본 동작 허용)
    e.preventDefault();
    (e.target as HTMLElement).blur(); // Enter = 저장
  };

  const Tag: any = autoGrow ? 'textarea' : 'input';

  return (
    <span style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <Tag
        ref={elRef}
        className={`pu-field${autoGrow ? ' pu-area' : ''}`}
        value={shown}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        list={list}
        rows={autoGrow ? 1 : undefined}
        disabled={disabled}
        style={{
          width: '100%',
          fontWeight: bold ? 700 : 400,
          borderRadius: '5px',
          padding: autoGrow ? '5px 8px' : '0 8px',
          outline: 'none',
          background: '#fff',
          color: '#1a1a1a',
          textAlign: align ?? 'left',
          fontVariantNumeric: numeric ? 'tabular-nums' : undefined,
          boxSizing: 'border-box',
          display: autoGrow ? 'block' : undefined,
          lineHeight: autoGrow ? 1.4 : undefined,
          resize: autoGrow ? 'none' : undefined,
          overflow: 'hidden',
          whiteSpace: autoGrow ? 'pre-wrap' : 'nowrap',
          wordBreak: autoGrow ? 'break-all' : undefined,
          textOverflow: autoGrow ? undefined : 'ellipsis',
        } as React.CSSProperties}
      />
      {flash && (
        <span style={{ position: 'absolute', right: '-15px', top: autoGrow ? '5px' : '50%', transform: autoGrow ? undefined : 'translateY(-50%)', color: '#16a34a', fontSize: '13px', fontWeight: 700, pointerEvents: 'none' }}>✓</span>
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

  // "수익률 기준" 상태(화면 전용, DB 미저장 — 새로고침하면 해제): 잠긴 행 id와, 그때 입력한 목표 수익률(%)
  const [yieldLocked, setYieldLocked] = useState<Set<string>>(new Set());
  const [yieldTargets, setYieldTargets] = useState<Record<string, number>>({});

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

  // PC 표의 열 폭 — %의 합이 항상 100. 사진 버튼을 작게 줄이면서 생긴 여유 공간은 메모 칸에 배분했다.
  // 표 자체의 가로 스크롤 여부는 이 %가 아니라 아래 .pu-table의 min-width(1000px/1100px 미만에서는
  // 900px)로 결정된다 — 컨테이너가 그보다 좁으면 표는 min-width로 고정되고 가로 스크롤이 생긴다.
  const COL_WIDTH: Record<string, string> = {
    check: '3%', unit: '5%', business: '11%', area: '8%', deposit: '7%',
    monthly: '6%', sale: '8%', yield: '6%', status: '8%', note: '9%', memo: '22%', photo: '7%',
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

  const th = (width: string): React.CSSProperties => ({
    width, padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#555',
    whiteSpace: 'nowrap', background: '#f8f8f8', borderBottom: '2px solid #e0e0e0',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', padding: '24px 20px', paddingBottom: selectedUnits.length > 0 ? '150px' : '24px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .pu-field { border: 1px solid #e3e3e3; transition: border-color 0.15s, background 0.15s; height: 30px; font-size: 13px; }
        .pu-field.pu-area { height: auto; }
        .pu-field.pu-select { font-size: 12px; }
        .pu-field:hover { border-color: #bbb; }
        .pu-field:focus { border-color: #c47c30; background: #fffdf8; }
        .pu-field:disabled { opacity: 0.55; cursor: not-allowed; }
        .pu-field::placeholder { color: #bbb; }
        .pu-checkbox { width: 20px; height: 20px; cursor: pointer; }
        .pu-cell { padding: 8px 6px; }
        .pu-table { min-width: 1000px; }
        /* 1100px 미만: 입력칸/체크박스/셀 패딩을 줄이고, 표는 900px 아래로는 안 줄어들게 해서
           그보다 좁은 화면에서는 .pu-table-wrap의 overflow-x: auto로 가로 스크롤이 생기게 한다. */
        @media (max-width: 1099px) {
          .pu-field { height: 26px; font-size: 12px; }
          .pu-field.pu-area { height: auto; }
          .pu-checkbox { width: 18px; height: 18px; }
          .pu-cell { padding: 4px 3px; }
          .pu-table { min-width: 900px; }
          /* 가로 스크롤 중에도 호실/체크박스 열이 항상 보이게 왼쪽에 고정.
             left 값은 compact 모드 min-width(900px) 기준 체크(3%=27px) 열 폭에 맞춘 것 — 이 모드에서만
             실제로 스크롤이 발생하므로(1100px 이상에서는 표가 컨테이너에 맞춰져 스크롤이 생기지 않음)
             이 고정폭 가정이 항상 유효하다. */
          .pu-sticky-check, .pu-sticky-unit { position: sticky; z-index: 5; }
          .pu-sticky-check { left: 0; }
          .pu-sticky-unit { left: 27px; }
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

        {/* 모든 화면 폭에서 같은 표 — 좁은 화면에서는 아래 overflow-x: auto로 가로 스크롤 */}
        <div className="pu-table-wrap" style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>불러오는 중...</p>
          ) : (
            <table className="pu-table" style={{ width: `${TABLE_WIDTH_PCT}%`, borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="pu-sticky-check" style={th(COL_WIDTH.check)}></th>
                  <th className="pu-sticky-unit" style={th(COL_WIDTH.unit)}>호실</th>
                  <th style={th(COL_WIDTH.business)}>업종(상호)</th>
                  <th style={th(COL_WIDTH.area)}>계약/전용(평)</th>
                  <th style={{ ...th(COL_WIDTH.deposit), textAlign: 'right' }}>보증금(만원)</th>
                  <th style={{ ...th(COL_WIDTH.monthly), textAlign: 'right' }}>월세(만원)</th>
                  <th style={{ ...th(COL_WIDTH.sale), textAlign: 'right' }}>분양가(만원)</th>
                  <th style={{ ...th(COL_WIDTH.yield), textAlign: 'right' }}>수익률(%)</th>
                  <th style={th(COL_WIDTH.status)}>상태</th>
                  <th style={th(COL_WIDTH.note)}>비고</th>
                  <th style={th(COL_WIDTH.memo)}>메모(비공개)</th>
                  <th style={th(COL_WIDTH.photo)}>사진</th>
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
                          <td className="pu-sticky-check pu-cell" style={{ background: '#eef1f5', borderBottom: '1px solid #e0e0e0', borderTop: '2px solid #d7dbe0', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              className="pu-checkbox"
                              checked={floorAllSelected}
                              ref={el => { if (el) el.indeterminate = floorSomeSelected; }}
                              onChange={() => toggleFloorSelect(floorUnits)}
                              title={`${u.floor} 전체 선택/해제`}
                            />
                          </td>
                          <td colSpan={11} style={{ padding: '8px 12px', background: '#eef1f5', fontWeight: 800, fontSize: '13px', color: '#1a1a1a', borderBottom: '1px solid #e0e0e0', borderTop: '2px solid #d7dbe0' }}>
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
                    const photoCount = photoCounts[u.id] ?? 0;
                    const rowBg = isSelected ? '#fff7ec' : isLeased ? '#f6f6f6' : i % 2 === 0 ? '#fff' : '#fafafa';

                    rows.push(
                      <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0', background: rowBg }}>
                        <td className="pu-sticky-check pu-cell" style={{ textAlign: 'center', background: rowBg }}>
                          <input
                            type="checkbox"
                            className="pu-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(u.id)}
                          />
                        </td>
                        <td className="pu-sticky-unit pu-cell" style={{ fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: rowBg }}>{u.unit_no}</td>
                        <td className="pu-cell">
                          <AutoField
                            value={u.memo ?? ''}
                            commit={commitBusiness(u)}
                            placeholder="미입력"
                            disabled={isSaving}
                            bold={isLeased}
                            autoGrow
                          />
                        </td>
                        <td className="pu-cell" style={{ color: '#333', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {u.contract_area_py.toFixed(1)} / {u.exclusive_area_py.toFixed(1)}
                        </td>
                        <td className="pu-cell">
                          <AutoField value={toManStr(u.deposit_krw)} commit={commitDeposit(u)} numeric align="right" disabled={isSaving} />
                        </td>
                        <td className="pu-cell">
                          <AutoField value={toManStr(u.monthly_rent_krw)} commit={commitMonthly(u)} numeric align="right" disabled={isSaving} />
                        </td>
                        <td className="pu-cell">
                          <AutoField value={toManStr(u.sale_price)} commit={commitSalePrice(u)} numeric align="right" disabled={isSaving} />
                        </td>
                        <td className="pu-cell">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <AutoField value={yieldStr} commit={commitYield(u)} align="right" disabled={isSaving} placeholder="-" />
                            {isYieldLocked && <span title="수익률 기준으로 월세가 자동 계산되는 호실입니다" style={{ flexShrink: 0 }}>🔒</span>}
                          </div>
                        </td>
                        <td className="pu-cell">
                          <select
                            value={u.status}
                            onChange={e => updateStatus(u.id, e.target.value)}
                            disabled={isSaving}
                            className="pu-field pu-select"
                            style={{
                              width: '100%', borderRadius: '5px', padding: '0 2px',
                              fontWeight: 600, cursor: 'pointer', outline: 'none',
                              background: STATUS_BG[u.status] ?? '#f3f4f6',
                              color: STATUS_COLOR[u.status] ?? '#374151',
                            }}
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                          </select>
                        </td>
                        <td className="pu-cell">
                          <AutoField value={u.sale_note ?? ''} commit={commitSaleNote(u)} placeholder="-" list="sale-note-suggestions" disabled={isSaving} autoGrow />
                        </td>
                        <td className="pu-cell">
                          <AutoField
                            value={u.admin_memo ?? ''}
                            commit={commitAdminMemo(u)}
                            placeholder="-"
                            disabled={isSaving}
                            autoGrow
                          />
                        </td>
                        <td className="pu-cell">
                          <button
                            onClick={() => setPhotoModalUnit(u)}
                            className="pu-field"
                            style={{ width: 'auto', height: '24px', padding: '0 6px', fontSize: '11px', fontWeight: 600, background: '#fff', color: '#555', cursor: 'pointer', borderRadius: '5px', whiteSpace: 'nowrap' }}
                          >
                            {photoCount > 0 ? `사진 ${photoCount}` : '사진 추가'}
                          </button>
                        </td>
                      </tr>
                    );
                  });

                  return rows;
                })()}
              </tbody>
            </table>
          )}
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
            <span>계약 {formatPyAndM2(contractPySum)}</span>
            <span>전용 {formatPyAndM2(exclusivePySum)}</span>
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
