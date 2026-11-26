'use client';

import { useEffect, useState } from 'react';
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

// 원 단위 → "O억 O천만원" 표시 (기존 관리자 금액 표시 방식과 통일)
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

export default function PrecentUnitsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFloor, setFilterFloor] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editBusiness, setEditBusiness] = useState<Record<string, string>>({});
  const [editAdminMemo, setEditAdminMemo] = useState<Record<string, string>>({});
  const [editSaleNote, setEditSaleNote] = useState<Record<string, string>>({});
  const [editPrice, setEditPrice] = useState<Record<string, { deposit: string; monthly: string; salePrice: string; monthlyAtEditStart: string }>>({});
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [photoModalUnit, setPhotoModalUnit] = useState<Unit | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // "수익률 기준" 상태(화면 전용, DB 미저장 — 새로고침하면 해제): 잠긴 행 id와, 그때 입력한 목표 수익률(%)
  const [yieldLocked, setYieldLocked] = useState<Set<string>>(new Set());
  const [yieldTargets, setYieldTargets] = useState<Record<string, number>>({});
  // 수익률 칸에 타이핑 중인 값(커밋 전까지만 유지, blur/Enter 시 반영 후 비워짐)
  const [yieldInput, setYieldInput] = useState<Record<string, string>>({});
  // 포커스 시점의 원래 값 — blur했을 때 실제로 값이 바뀌었는지 판별용(그냥 클릭만 했다가 나가는 경우 저장 방지)
  const [yieldEditBaseline, setYieldEditBaseline] = useState<Record<string, string>>({});

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

  const updateStatus = async (id: string, status: string) => {
    setSavingId(id);
    await supabase.from('precent_units').update({ status }).eq('id', id);
    setUnits(prev => prev.map(u => u.id === id ? { ...u, status } : u));
    setSavingId(null);
    triggerPrecentRevalidate();
  };

  // ── 업종(상호) 수정 — DB 컬럼명은 memo 그대로 (방문자 화면 노출용) ──
  const startEditBusiness = (u: Unit) => {
    setEditBusiness(prev => ({ ...prev, [u.id]: u.memo ?? '' }));
  };

  const cancelEditBusiness = (id: string) => {
    setEditBusiness(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const saveBusiness = async (id: string) => {
    const value = (editBusiness[id] ?? '').trim();
    setSavingId(id);
    const { error } = await supabase.from('precent_units').update({ memo: value || null }).eq('id', id);
    setSavingId(null);
    if (error) {
      alert(`업종(상호) 저장 실패: ${error.message}`);
      return;
    }
    setUnits(prev => prev.map(u => u.id === id ? { ...u, memo: value || null } : u));
    cancelEditBusiness(id);
    triggerPrecentRevalidate();
  };

  // ── 메모(비공개) 수정 — admin_memo, 방문자에게 절대 노출되지 않음 ──
  const startEditAdminMemo = (u: Unit) => {
    setEditAdminMemo(prev => ({ ...prev, [u.id]: u.admin_memo ?? '' }));
  };

  const cancelEditAdminMemo = (id: string) => {
    setEditAdminMemo(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const saveAdminMemo = async (id: string) => {
    const value = (editAdminMemo[id] ?? '').trim();
    setSavingId(id);
    const { error } = await supabase.from('precent_units').update({ admin_memo: value || null }).eq('id', id);
    setSavingId(null);
    if (error) {
      alert(`메모 저장 실패: ${error.message}`);
      return;
    }
    setUnits(prev => prev.map(u => u.id === id ? { ...u, admin_memo: value || null } : u));
    cancelEditAdminMemo(id);
    triggerPrecentRevalidate();
  };

  // ── 가격 수정 (보증금/월세/분양가, 만원 단위 입력 → 원 단위 저장) ──
  const startEditPrice = (u: Unit) => {
    const monthly = u.monthly_rent_krw ? String(Math.round(u.monthly_rent_krw / 10000)) : '';
    setEditPrice(prev => ({
      ...prev,
      [u.id]: {
        deposit: u.deposit_krw ? String(Math.round(u.deposit_krw / 10000)) : '',
        monthly,
        salePrice: u.sale_price ? String(Math.round(u.sale_price / 10000)) : '',
        monthlyAtEditStart: monthly, // 월세를 실제로 고쳤는지 판별용(보증금/분양가만 바뀐 경우와 구분)
      },
    }));
  };

  const cancelEditPrice = (id: string) => {
    setEditPrice(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const savePrice = async (id: string) => {
    const edit = editPrice[id];
    if (!edit) return;

    const depositMan = edit.deposit.trim();
    const monthlyMan = edit.monthly.trim();
    const saleMan = edit.salePrice.trim();
    if ([depositMan, monthlyMan, saleMan].some(v => v && isNaN(Number(v)))) {
      alert('보증금/월세/분양가는 숫자(만원 단위)만 입력해주세요.');
      return;
    }

    const deposit_krw = depositMan ? Math.round(Number(depositMan) * 10000) : null;
    const sale_price = saleMan ? Math.round(Number(saleMan) * 10000) : null;

    // 월세 입력칸을 실제로 고쳤으면(=직접 수정) 그 값 그대로 저장하고 "수익률 기준" 상태를 해제.
    // 월세는 그대로 두고 보증금/분양가만 바꿨고, 이 행이 "수익률 기준" 상태면 목표 수익률로 월세를 다시 계산.
    const monthlyTouched = monthlyMan !== edit.monthlyAtEditStart;
    let monthly_rent_krw = monthlyMan ? Math.round(Number(monthlyMan) * 10000) : null;
    let nextLocked = yieldLocked.has(id);

    if (monthlyTouched) {
      nextLocked = false;
    } else if (nextLocked && sale_price != null) {
      const target = yieldTargets[id];
      const base = sale_price - (deposit_krw ?? 0);
      if (target != null && base > 0) {
        monthly_rent_krw = Math.round((((target / 100) * base) / 12) / RENT_ROUND_UNIT) * RENT_ROUND_UNIT;
      }
    }

    setSavingId(id);
    const { error } = await supabase.from('precent_units').update({ deposit_krw, monthly_rent_krw, sale_price }).eq('id', id);
    setSavingId(null);
    if (error) {
      alert(`가격 저장 실패: ${error.message}`);
      return;
    }
    setUnits(prev => prev.map(u => u.id === id ? { ...u, deposit_krw, monthly_rent_krw, sale_price } : u));
    setYieldLocked(prev => {
      const n = new Set(prev);
      if (nextLocked) n.add(id); else n.delete(id);
      return n;
    });
    if (!nextLocked) setYieldTargets(prev => { const n = { ...prev }; delete n[id]; return n; });
    cancelEditPrice(id);
    triggerPrecentRevalidate();
  };

  // ── 비고(sale_note) 수정 — 업종(상호)/비공개 메모와 별개 칸 ──
  const startEditSaleNote = (u: Unit) => {
    setEditSaleNote(prev => ({ ...prev, [u.id]: u.sale_note ?? '' }));
  };

  const cancelEditSaleNote = (id: string) => {
    setEditSaleNote(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const saveSaleNote = async (id: string) => {
    const value = (editSaleNote[id] ?? '').trim();
    setSavingId(id);
    const { error } = await supabase.from('precent_units').update({ sale_note: value || null }).eq('id', id);
    setSavingId(null);
    if (error) {
      alert(`비고 저장 실패: ${error.message}`);
      return;
    }
    setUnits(prev => prev.map(u => u.id === id ? { ...u, sale_note: value || null } : u));
    cancelEditSaleNote(id);
    triggerPrecentRevalidate();
  };

  // ── 수익률(%) 입력 — 커밋 시 목표 수익률에 맞춰 월세를 계산해서 저장하고, 그 행을 "수익률 기준"으로 잠근다 ──
  const clearYieldEdit = (id: string) => {
    setYieldInput(prev => { const n = { ...prev }; delete n[id]; return n; });
    setYieldEditBaseline(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const commitYield = async (u: Unit) => {
    const raw = (yieldInput[u.id] ?? '').trim();
    const baseline = yieldEditBaseline[u.id] ?? '';

    // 그냥 포커스만 들어갔다 나온 경우(값을 안 바꿈)는 아무 것도 저장/잠금하지 않는다
    if (raw === baseline) {
      clearYieldEdit(u.id);
      return;
    }
    if (raw === '') {
      clearYieldEdit(u.id);
      return;
    }
    const target = Number(raw);
    if (isNaN(target)) {
      alert('수익률은 숫자만 입력해주세요.');
      clearYieldEdit(u.id);
      return;
    }
    if (!u.sale_price) {
      alert('분양가가 없어 계산할 수 없습니다.');
      clearYieldEdit(u.id);
      return;
    }
    const base = u.sale_price - (u.deposit_krw ?? 0);
    if (base <= 0) {
      alert('분양가가 보증금보다 작거나 같아 계산할 수 없습니다.');
      clearYieldEdit(u.id);
      return;
    }

    const monthly_rent_krw = Math.round(((target / 100) * base / 12) / RENT_ROUND_UNIT) * RENT_ROUND_UNIT;

    setSavingId(u.id);
    const { error } = await supabase.from('precent_units').update({ monthly_rent_krw }).eq('id', u.id);
    setSavingId(null);
    if (error) {
      alert(`수익률 저장 실패: ${error.message}`);
      clearYieldEdit(u.id);
      return;
    }
    setUnits(prev => prev.map(x => x.id === u.id ? { ...x, monthly_rent_krw } : x));
    setYieldLocked(prev => new Set(prev).add(u.id));
    setYieldTargets(prev => ({ ...prev, [u.id]: target }));
    clearYieldEdit(u.id);
    triggerPrecentRevalidate();
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

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', padding: '24px 20px', paddingBottom: selectedUnits.length > 0 ? '150px' : '24px' }}>
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

        {/* 테이블 */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>불러오는 중...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8f8f8', borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '10px', width: '42px' }}></th>
                  {['호실', '층', '업종(상호)', '전용(평)', '계약(평)', '보증금', '월세', '분양가', '수익률(%)', '상태', '메모(비공개)', '비고', '사진'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#555', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: React.ReactNode[] = [];
                  let lastFloor: string | null = null;
                  let rowIndex = 0;

                  // 층별 "전체 선택" 체크칸이 참조할, 화면에 보이는(필터 적용된) 호실 목록
                  const floorGroups = new Map<string, Unit[]>();
                  filtered.forEach(u => {
                    if (!floorGroups.has(u.floor)) floorGroups.set(u.floor, []);
                    floorGroups.get(u.floor)!.push(u);
                  });

                  filtered.forEach(u => {
                    if (u.floor !== lastFloor) {
                      lastFloor = u.floor;
                      const floorUnits = floorGroups.get(u.floor) ?? [];
                      const floorAllSelected = floorUnits.length > 0 && floorUnits.every(fu => selectedIds.has(fu.id));
                      const floorSomeSelected = !floorAllSelected && floorUnits.some(fu => selectedIds.has(fu.id));
                      rows.push(
                        <tr key={`floor-${u.floor}`}>
                          <td style={{ padding: '10px', background: '#eef1f5', borderBottom: '1px solid #e0e0e0', borderTop: '2px solid #d7dbe0', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={floorAllSelected}
                              ref={el => { if (el) el.indeterminate = floorSomeSelected; }}
                              onChange={() => toggleFloorSelect(floorUnits)}
                              title={`${u.floor} 전체 선택/해제`}
                              style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                            />
                          </td>
                          <td colSpan={10} style={{ padding: '8px 12px', background: '#eef1f5', fontWeight: 800, fontSize: '13px', color: '#1a1a1a', borderBottom: '1px solid #e0e0e0', borderTop: '2px solid #d7dbe0' }}>
                            {u.floor}
                          </td>
                        </tr>
                      );
                    }

                    const businessEditing = u.id in editBusiness;
                    const adminMemoEditing = u.id in editAdminMemo;
                    const priceEditing = u.id in editPrice;
                    const saleNoteEditing = u.id in editSaleNote;
                    const i = rowIndex++;
                    const isSelected = selectedIds.has(u.id);
                    const isYieldLocked = yieldLocked.has(u.id);
                    const yieldDisplay = calcYieldPct(u.sale_price, u.deposit_krw, u.monthly_rent_krw);
                    const yieldValue = yieldInput[u.id] ?? (yieldDisplay != null ? yieldDisplay.toFixed(1) : '-');

                    rows.push(
                      <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0', background: isSelected ? '#fff7ec' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(u.id)}
                            style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap' }}>{u.unit_no}</td>
                        <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>{u.floor}</td>
                        <td style={{ padding: '10px 12px', minWidth: '140px' }}>
                          {businessEditing ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <input
                                value={editBusiness[u.id]}
                                onChange={e => setEditBusiness(prev => ({ ...prev, [u.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') saveBusiness(u.id); if (e.key === 'Escape') cancelEditBusiness(u.id); }}
                                placeholder="예: 스타벅스"
                                autoFocus
                                style={{ flex: 1, height: '26px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', padding: '0 6px', outline: 'none' }}
                              />
                              <button onClick={() => saveBusiness(u.id)} disabled={savingId === u.id} style={{ fontSize: '11px', padding: '0 8px', height: '26px', background: '#1a1a1a', color: '#e2a06e', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
                              <button onClick={() => cancelEditBusiness(u.id)} disabled={savingId === u.id} style={{ fontSize: '11px', padding: '0 8px', height: '26px', background: '#f3f4f6', color: '#555', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
                            </div>
                          ) : (
                            <span onClick={() => startEditBusiness(u)} style={{ fontSize: '12px', color: u.memo ? '#333' : '#bbb', cursor: 'pointer' }} title="클릭해서 수정">
                              {u.memo || '미입력'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#333', whiteSpace: 'nowrap' }}>{u.exclusive_area_py.toFixed(1)}</td>
                        <td style={{ padding: '10px 12px', color: '#333', whiteSpace: 'nowrap' }}>{u.contract_area_py.toFixed(1)}</td>
                        <td style={{ padding: '10px 12px', color: '#333', whiteSpace: 'nowrap' }}>
                          {priceEditing ? (
                            <input
                              type="number"
                              value={editPrice[u.id].deposit}
                              onChange={e => setEditPrice(prev => ({ ...prev, [u.id]: { ...prev[u.id], deposit: e.target.value } }))}
                              onKeyDown={e => { if (e.key === 'Enter') savePrice(u.id); if (e.key === 'Escape') cancelEditPrice(u.id); }}
                              placeholder="만원"
                              autoFocus
                              style={{ width: '80px', height: '26px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', padding: '0 6px', outline: 'none' }}
                            />
                          ) : (
                            <span onClick={() => startEditPrice(u)} style={{ cursor: 'pointer' }} title="클릭해서 수정">
                              {formatKRW(u.deposit_krw)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#333', whiteSpace: 'nowrap' }}>
                          {priceEditing ? (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <input
                                type="number"
                                value={editPrice[u.id].monthly}
                                onChange={e => setEditPrice(prev => ({ ...prev, [u.id]: { ...prev[u.id], monthly: e.target.value } }))}
                                onKeyDown={e => { if (e.key === 'Enter') savePrice(u.id); if (e.key === 'Escape') cancelEditPrice(u.id); }}
                                placeholder="만원"
                                style={{ width: '80px', height: '26px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', padding: '0 6px', outline: 'none' }}
                              />
                              <button onClick={() => savePrice(u.id)} disabled={savingId === u.id} style={{ fontSize: '11px', padding: '0 8px', height: '26px', background: '#1a1a1a', color: '#e2a06e', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
                              <button onClick={() => cancelEditPrice(u.id)} disabled={savingId === u.id} style={{ fontSize: '11px', padding: '0 8px', height: '26px', background: '#f3f4f6', color: '#555', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
                            </div>
                          ) : (
                            <span onClick={() => startEditPrice(u)} style={{ cursor: 'pointer' }} title="클릭해서 수정">
                              {formatKRW(u.monthly_rent_krw)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#333', whiteSpace: 'nowrap' }}>
                          {priceEditing ? (
                            <input
                              type="number"
                              value={editPrice[u.id].salePrice}
                              onChange={e => setEditPrice(prev => ({ ...prev, [u.id]: { ...prev[u.id], salePrice: e.target.value } }))}
                              onKeyDown={e => { if (e.key === 'Enter') savePrice(u.id); if (e.key === 'Escape') cancelEditPrice(u.id); }}
                              placeholder="만원"
                              style={{ width: '90px', height: '26px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', padding: '0 6px', outline: 'none' }}
                            />
                          ) : (
                            <span onClick={() => startEditPrice(u)} style={{ cursor: 'pointer' }} title="클릭해서 수정">
                              {formatKRW(u.sale_price)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#333', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={yieldValue}
                              onChange={e => setYieldInput(prev => ({ ...prev, [u.id]: e.target.value }))}
                              onFocus={() => {
                                if (u.id in yieldInput) return;
                                const baseline = yieldDisplay != null ? yieldDisplay.toFixed(1) : '';
                                setYieldInput(prev => ({ ...prev, [u.id]: baseline }));
                                setYieldEditBaseline(prev => ({ ...prev, [u.id]: baseline }));
                              }}
                              onBlur={() => commitYield(u)}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              placeholder="-"
                              style={{ width: '64px', height: '26px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', padding: '0 6px', outline: 'none' }}
                            />
                            {isYieldLocked && <span title="수익률 기준으로 월세가 자동 계산되는 호실입니다">🔒</span>}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <select
                            value={u.status}
                            onChange={e => updateStatus(u.id, e.target.value)}
                            disabled={savingId === u.id}
                            style={{
                              height: '28px', border: '1px solid #ddd', borderRadius: '5px', padding: '0 6px',
                              fontSize: '12px', fontWeight: 600, cursor: 'pointer', outline: 'none',
                              background: STATUS_BG[u.status] ?? '#f3f4f6',
                              color: STATUS_COLOR[u.status] ?? '#374151',
                            }}
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '10px 12px', minWidth: '160px' }}>
                          {adminMemoEditing ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <input
                                value={editAdminMemo[u.id]}
                                onChange={e => setEditAdminMemo(prev => ({ ...prev, [u.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') saveAdminMemo(u.id); if (e.key === 'Escape') cancelEditAdminMemo(u.id); }}
                                autoFocus
                                style={{ flex: 1, height: '26px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', padding: '0 6px', outline: 'none' }}
                              />
                              <button onClick={() => saveAdminMemo(u.id)} disabled={savingId === u.id} style={{ fontSize: '11px', padding: '0 8px', height: '26px', background: '#1a1a1a', color: '#e2a06e', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
                              <button onClick={() => cancelEditAdminMemo(u.id)} disabled={savingId === u.id} style={{ fontSize: '11px', padding: '0 8px', height: '26px', background: '#f3f4f6', color: '#555', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
                            </div>
                          ) : (
                            <span
                              onClick={() => startEditAdminMemo(u)}
                              style={{ fontSize: '12px', color: u.admin_memo ? '#333' : '#bbb', cursor: 'pointer' }}
                              title="클릭해서 편집"
                            >
                              {u.admin_memo || '메모 없음'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', minWidth: '140px' }}>
                          {saleNoteEditing ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <input
                                list="sale-note-suggestions"
                                value={editSaleNote[u.id]}
                                onChange={e => setEditSaleNote(prev => ({ ...prev, [u.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') saveSaleNote(u.id); if (e.key === 'Escape') cancelEditSaleNote(u.id); }}
                                placeholder="예: 미분양"
                                autoFocus
                                style={{ flex: 1, height: '26px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', padding: '0 6px', outline: 'none' }}
                              />
                              <button onClick={() => saveSaleNote(u.id)} disabled={savingId === u.id} style={{ fontSize: '11px', padding: '0 8px', height: '26px', background: '#1a1a1a', color: '#e2a06e', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
                              <button onClick={() => cancelEditSaleNote(u.id)} disabled={savingId === u.id} style={{ fontSize: '11px', padding: '0 8px', height: '26px', background: '#f3f4f6', color: '#555', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
                            </div>
                          ) : (
                            <span onClick={() => startEditSaleNote(u)} style={{ fontSize: '12px', color: u.sale_note ? '#333' : '#bbb', cursor: 'pointer' }} title="클릭해서 수정">
                              {u.sale_note || '-'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => setPhotoModalUnit(u)}
                            style={{ height: '26px', padding: '0 10px', fontSize: '12px', fontWeight: 600, border: '1px solid #ddd', borderRadius: '5px', background: '#fff', color: '#555', cursor: 'pointer' }}
                          >
                            사진 {photoCounts[u.id] ?? 0}장
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
