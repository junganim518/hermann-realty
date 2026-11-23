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
};

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

// 원 단위 → "O억 O천만원" 표시 (기존 관리자 금액 표시 방식과 통일)
function formatKRW(won: number | null) {
  if (!won) return '-';
  const man = Math.round(won / 10000);
  const uk = Math.floor(man / 10000);
  const rest = man % 10000;
  if (uk > 0) return rest > 0 ? `${uk}억 ${rest.toLocaleString()}만원` : `${uk}억`;
  return `${man.toLocaleString()}만원`;
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
  const [editPrice, setEditPrice] = useState<Record<string, { deposit: string; monthly: string }>>({});
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [photoModalUnit, setPhotoModalUnit] = useState<Unit | null>(null);

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

  // ── 가격 수정 (보증금/월세, 만원 단위 입력 → 원 단위 저장) ──
  const startEditPrice = (u: Unit) => {
    setEditPrice(prev => ({
      ...prev,
      [u.id]: {
        deposit: u.deposit_krw ? String(Math.round(u.deposit_krw / 10000)) : '',
        monthly: u.monthly_rent_krw ? String(Math.round(u.monthly_rent_krw / 10000)) : '',
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
    if ((depositMan && isNaN(Number(depositMan))) || (monthlyMan && isNaN(Number(monthlyMan)))) {
      alert('보증금/월세는 숫자(만원 단위)만 입력해주세요.');
      return;
    }

    const deposit_krw = depositMan ? Math.round(Number(depositMan) * 10000) : null;
    const monthly_rent_krw = monthlyMan ? Math.round(Number(monthlyMan) * 10000) : null;

    setSavingId(id);
    const { error } = await supabase.from('precent_units').update({ deposit_krw, monthly_rent_krw }).eq('id', id);
    setSavingId(null);
    if (error) {
      alert(`가격 저장 실패: ${error.message}`);
      return;
    }
    setUnits(prev => prev.map(u => u.id === id ? { ...u, deposit_krw, monthly_rent_krw } : u));
    cancelEditPrice(id);
    triggerPrecentRevalidate();
  };

  if (!authChecked) return null;

  const filtered = units.filter(u =>
    (!filterFloor || u.floor === filterFloor) &&
    (!filterZone || u.zone === filterZone) &&
    (!filterStatus || u.status === filterStatus)
  );

  const vacantCount = filtered.filter(u => u.status === 'vacant').length;

  const selSt: React.CSSProperties = { height: '34px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 10px', fontSize: '13px', outline: 'none', background: '#fff', color: '#333' };

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', padding: '24px 20px' }}>
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
                  {['호실', '층', '업종(상호)', '전용(평)', '계약(평)', '보증금', '월세', '상태', '메모(비공개)', '사진'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#555', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
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
                      rows.push(
                        <tr key={`floor-${u.floor}`}>
                          <td colSpan={10} style={{ padding: '8px 12px', background: '#eef1f5', fontWeight: 800, fontSize: '13px', color: '#1a1a1a', borderBottom: '1px solid #e0e0e0', borderTop: '2px solid #d7dbe0' }}>
                            {u.floor}
                          </td>
                        </tr>
                      );
                    }

                    const businessEditing = u.id in editBusiness;
                    const adminMemoEditing = u.id in editAdminMemo;
                    const priceEditing = u.id in editPrice;
                    const i = rowIndex++;

                    rows.push(
                      <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
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
    </div>
  );
}
