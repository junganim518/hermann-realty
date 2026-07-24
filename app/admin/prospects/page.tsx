'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Agent = { id: string; name: string };
type Row = {
  id: string;
  dong: string | null;
  lot_number: string | null;
  business_name: string | null;
  phone: string | null;
  floor_info: string | null;
  area_m2: number | null;
  deposit: number | null;
  monthly_rent: number | null;
  is_advertised: boolean;
  memo: string | null;
  agent_id: string | null;
  status: 'prospect' | 'registered';
  created_at: string;
};

export default function ProspectsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filterAgent, setFilterAgent] = useState('');
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState<{ id: string; field: string } | null>(null);
  const [editVal, setEditVal] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/prospects'); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      setLoading(true);
      const [{ data: r }, { data: a }] = await Promise.all([
        supabase.from('prospect_properties').select('*').order('created_at', { ascending: false }),
        supabase.from('agents').select('id, name').eq('is_active', true),
      ]);
      setRows(r ?? []);
      setAgents(a ?? []);
      setLoading(false);
    })();
  }, [authChecked]);

  const displayed = filterAgent ? rows.filter(r => r.agent_id === filterAgent) : rows;

  const startEdit = (id: string, field: string, val: any) => {
    setEditCell({ id, field });
    setEditVal(val != null ? String(val) : '');
  };

  const commit = async (id: string, field: string, raw: string) => {
    let value: any = raw === '' ? null : raw;
    if (['area_m2', 'deposit', 'monthly_rent'].includes(field)) {
      value = raw === '' ? null : Number(raw);
      if (isNaN(value as number)) value = null;
    }
    await supabase.from('prospect_properties').update({ [field]: value }).eq('id', id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    setEditCell(null);
  };

  const toggleAdvert = async (id: string, cur: boolean) => {
    await supabase.from('prospect_properties').update({ is_advertised: !cur }).eq('id', id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, is_advertised: !cur } : r));
  };

  const deleteRow = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from('prospect_properties').delete().eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
    showToast('삭제되었습니다.');
  };

  const addRow = async () => {
    const { data } = await supabase
      .from('prospect_properties')
      .insert({ status: 'prospect', is_advertised: false })
      .select().single();
    if (data) {
      setRows(prev => [data, ...prev]);
      setEditCell({ id: data.id, field: 'dong' });
      setEditVal('');
    }
  };

  const registerProperty = async (row: Row) => {
    const addrParts = [row.dong, row.lot_number].filter(Boolean).join(' ');
    sessionStorage.setItem('prospect_prefill', JSON.stringify({
      address: addrParts,
      business_name: row.business_name ?? '',
      landlord_phone: row.phone ?? '',
      current_floor: row.floor_info ?? '',
      exclusive_area: row.area_m2 != null ? String(row.area_m2) : '',
      deposit: row.deposit != null ? String(row.deposit) : '',
      monthly_rent: row.monthly_rent != null ? String(row.monthly_rent) : '',
    }));
    await supabase.from('prospect_properties').update({ status: 'registered' }).eq('id', row.id);
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'registered' } : r));
    router.push('/admin/properties/new');
  };

  if (!authChecked) return null;

  const agentName = (id: string | null) => agents.find(a => a.id === id)?.name ?? '-';
  const pyeong = (m2: number | null) => m2 != null ? (m2 / 3.3058).toFixed(1) : '';
  const fmt = (v: number | null) => v != null ? v.toLocaleString() : '';
  const isEd = (id: string, f: string) => editCell?.id === id && editCell.field === f;

  const tdBase: React.CSSProperties = { padding: '4px 6px', borderRight: '1px solid #eee', verticalAlign: 'middle' };

  // text/number cell (helper fn, not component — avoids unmount on re-render)
  const tc = (row: Row, field: keyof Row, type: 'text' | 'number', mw: number) => {
    const editing = isEd(row.id, field);
    const reg = row.status === 'registered';
    const raw = row[field];
    const disp = type === 'number' ? fmt(raw as number | null) : ((raw ?? '') as string);
    return (
      <td style={{ ...tdBase, minWidth: `${mw}px` }}
        className={reg ? '' : 'pcell'}
        onClick={() => !reg && !editing && startEdit(row.id, field, raw)}>
        {editing
          ? <input autoFocus type={type === 'number' ? 'number' : 'text'} value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onBlur={e => commit(row.id, field, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditCell(null); }}
              style={{ width: '100%', fontSize: '12px', border: '1px solid #c47c30', borderRadius: '3px', padding: '2px 4px', outline: 'none', boxSizing: 'border-box' }} />
          : <span style={{ fontSize: '12px', color: reg ? '#bbb' : '#222', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: '18px', cursor: reg ? 'default' : 'pointer' }}>{disp}</span>
        }
      </td>
    );
  };

  const HEADERS: [string, number][] = [
    ['동', 58], ['번지', 68], ['상호(업종)', 110], ['전화번호', 110], ['층(호수)', 74],
    ['㎡', 62], ['평', 54], ['보증금', 88], ['월세', 78], ['광고', 52],
    ['비고', 140], ['담당자', 78], ['', 130],
  ];

  return (
    <>
      <style>{`
        .pcell:hover { background: #fffbf5; }
        @media print {
          .no-print { display: none !important; }
          .ptitle { display: block !important; }
          body { padding: 0; font-size: 11px; }
          table { border-collapse: collapse !important; width: 100% !important; }
          th, td { border: 1px solid #aaa !important; padding: 4px 6px !important; font-size: 11px !important; }
          thead tr { background: #eee !important; print-color-adjust: exact; }
          input[type="checkbox"] { display: none; }
          .advert-label { display: inline !important; }
        }
      `}</style>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 16px 80px' }}>
        {/* 헤더 */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/admin')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', padding: 0 }}>←</button>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#1a1a1a' }}>임장 후보 매물</h1>
          <span style={{ fontSize: '13px', color: '#aaa', marginTop: '2px' }}>{displayed.length}건</span>
          <div style={{ flex: 1 }} />
          <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
            style={{ height: '34px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 10px', fontSize: '13px', cursor: 'pointer', outline: 'none' }}>
            <option value="">전체 담당자</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button onClick={() => window.print()}
            style={{ height: '34px', padding: '0 14px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#555', fontWeight: 600 }}>
            인쇄
          </button>
        </div>

        {/* 인쇄 전용 제목 */}
        <div className="ptitle" style={{ display: 'none', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>임장 후보 매물 목록</h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#aaa', fontSize: '14px' }}>로딩 중...</div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '920px' }}>
              <thead>
                <tr style={{ background: '#f8f8f8', borderBottom: '2px solid #ddd' }}>
                  {HEADERS.map(([label, w], i) => (
                    <th key={i} style={{ padding: '9px 8px', fontSize: '12px', fontWeight: 700, color: '#555', textAlign: (label === '광고' || label === '') ? 'center' : 'left', whiteSpace: 'nowrap', borderRight: '1px solid #eee', minWidth: `${w}px` }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '40px', color: '#aaa', fontSize: '13px' }}>
                      아래 "+ 추가" 버튼으로 추가하세요.
                    </td>
                  </tr>
                )}
                {displayed.map((row, idx) => {
                  const reg = row.status === 'registered';
                  return (
                    <tr key={row.id} style={{ background: reg ? '#f7f7f7' : idx % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #eee' }}>
                      {tc(row, 'dong', 'text', 58)}
                      {tc(row, 'lot_number', 'text', 68)}
                      {tc(row, 'business_name', 'text', 110)}
                      {tc(row, 'phone', 'text', 110)}
                      {tc(row, 'floor_info', 'text', 74)}
                      {tc(row, 'area_m2', 'number', 62)}
                      {/* 평 자동계산 (읽기전용) */}
                      <td style={{ ...tdBase, minWidth: '54px' }}>
                        <span style={{ fontSize: '12px', color: '#888' }}>{pyeong(row.area_m2)}</span>
                      </td>
                      {tc(row, 'deposit', 'number', 88)}
                      {tc(row, 'monthly_rent', 'number', 78)}
                      {/* 광고여부 */}
                      <td style={{ ...tdBase, textAlign: 'center', minWidth: '52px' }}>
                        <input type="checkbox" checked={row.is_advertised}
                          onChange={() => !reg && toggleAdvert(row.id, row.is_advertised)}
                          style={{ cursor: reg ? 'default' : 'pointer', accentColor: '#c47c30', width: '14px', height: '14px' }} />
                        <span className="advert-label" style={{ display: 'none', fontSize: '12px' }}>{row.is_advertised ? '●' : '○'}</span>
                      </td>
                      {tc(row, 'memo', 'text', 140)}
                      {/* 담당자 */}
                      <td style={{ ...tdBase, minWidth: '78px' }}
                        className={reg ? '' : 'pcell'}
                        onClick={() => !reg && !isEd(row.id, 'agent_id') && startEdit(row.id, 'agent_id', row.agent_id ?? '')}>
                        {isEd(row.id, 'agent_id')
                          ? <select autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={e => commit(row.id, 'agent_id', e.target.value)}
                              style={{ width: '100%', fontSize: '12px', border: '1px solid #c47c30', borderRadius: '3px', padding: '2px', outline: 'none' }}>
                              <option value="">-</option>
                              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                          : <span style={{ fontSize: '12px', color: reg ? '#bbb' : '#555', display: 'block', minHeight: '18px', cursor: reg ? 'default' : 'pointer' }}>{agentName(row.agent_id)}</span>
                        }
                      </td>
                      {/* 액션 */}
                      <td className="no-print" style={{ ...tdBase, textAlign: 'center', minWidth: '130px' }}>
                        {!reg ? (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button onClick={() => registerProperty(row)}
                              style={{ padding: '4px 8px', background: '#c47c30', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              매물 등록
                            </button>
                            <button onClick={() => deleteRow(row.id)}
                              style={{ padding: '4px 8px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                              삭제
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#bbb', background: '#f0f0f0', padding: '3px 10px', borderRadius: '10px' }}>등록완료</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* + 추가 버튼 */}
        <div className="no-print" style={{ marginTop: '12px' }}>
          <button onClick={addRow}
            style={{ padding: '10px 22px', background: '#1a1a1a', color: '#e2a06e', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            + 추가
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 22px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, zIndex: 200 }}>
          {toast}
        </div>
      )}
    </>
  );
}
