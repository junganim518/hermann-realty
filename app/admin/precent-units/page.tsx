'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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

function fmt(n: number | null) {
  if (!n) return '-';
  return (n / 10000).toLocaleString() + '만';
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
  const [editMemo, setEditMemo] = useState<Record<string, string>>({});

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
  }, [authChecked]);

  const updateStatus = async (id: string, status: string) => {
    setSavingId(id);
    await supabase.from('precent_units').update({ status }).eq('id', id);
    setUnits(prev => prev.map(u => u.id === id ? { ...u, status } : u));
    setSavingId(null);
  };

  const saveMemo = async (id: string) => {
    setSavingId(id);
    const memo = editMemo[id] ?? '';
    await supabase.from('precent_units').update({ memo: memo || null }).eq('id', id);
    setUnits(prev => prev.map(u => u.id === id ? { ...u, memo: memo || null } : u));
    setEditMemo(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSavingId(null);
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
                  {['호실', '층', '존', '전용(평)', '계약(평)', '보증금', '월세', '상태', '메모'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#555', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => {
                  const memoEditing = u.id in editMemo;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap' }}>{u.unit_no}</td>
                      <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>{u.floor}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#f3f4f6', color: '#374151', fontWeight: 600 }}>
                          {ZONE_LABEL[u.zone] ?? u.zone}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#333', whiteSpace: 'nowrap' }}>{u.exclusive_area_py.toFixed(1)}</td>
                      <td style={{ padding: '10px 12px', color: '#333', whiteSpace: 'nowrap' }}>{u.contract_area_py.toFixed(1)}</td>
                      <td style={{ padding: '10px 12px', color: '#333', whiteSpace: 'nowrap' }}>{fmt(u.deposit_krw)}</td>
                      <td style={{ padding: '10px 12px', color: '#333', whiteSpace: 'nowrap' }}>{fmt(u.monthly_rent_krw)}</td>
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
                        {memoEditing ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                              value={editMemo[u.id]}
                              onChange={e => setEditMemo(prev => ({ ...prev, [u.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') saveMemo(u.id); if (e.key === 'Escape') setEditMemo(prev => { const n = { ...prev }; delete n[u.id]; return n; }); }}
                              autoFocus
                              style={{ flex: 1, height: '26px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', padding: '0 6px', outline: 'none' }}
                            />
                            <button onClick={() => saveMemo(u.id)} disabled={savingId === u.id} style={{ fontSize: '11px', padding: '0 8px', background: '#1a1a1a', color: '#e2a06e', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
                          </div>
                        ) : (
                          <span
                            onClick={() => setEditMemo(prev => ({ ...prev, [u.id]: u.memo ?? '' }))}
                            style={{ fontSize: '12px', color: u.memo ? '#333' : '#bbb', cursor: 'pointer' }}
                            title="클릭해서 편집"
                          >
                            {u.memo || '메모 없음'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
