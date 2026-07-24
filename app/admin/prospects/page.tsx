'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

declare global { interface Window { daum: any; } }

type Agent = { id: string; name: string };
type Row = {
  id: string;
  dong: string | null;
  lot_number: string | null;
  building_name: string | null;
  business_name: string | null;
  phone: string | null;
  floor_info: string | null;
  area_m2: number | null;
  deposit: number | null;
  monthly_rent: number | null;
  memo: string | null;
  agent_id: string | null;
  status: 'prospect' | 'registered';
  created_at: string;
};

type FormState = {
  dong: string; lot_number: string; building_name: string;
  business_name: string; phone: string; floor_info: string;
  area_m2: string; deposit: string; monthly_rent: string;
  memo: string; agent_id: string;
};

const emptyForm = (): FormState => ({
  dong: '', lot_number: '', building_name: '',
  business_name: '', phone: '', floor_info: '',
  area_m2: '', deposit: '', monthly_rent: '', memo: '', agent_id: '',
});

const fmtPhone = (val: string) => {
  const d = val.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.startsWith('02')) {
    if (d.length <= 6) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  }
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

export default function ProspectsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filterAgent, setFilterAgent] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRow, setModalRow] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/prospects'); return; }
      setAuthChecked(true);
    });
    // Daum Postcode 스크립트 사전 로드
    if (!document.getElementById('daum-postcode-script')) {
      const s = document.createElement('script');
      s.id = 'daum-postcode-script';
      s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      s.async = true;
      document.head.appendChild(s);
    }
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

  const openDaumPostcode = () => {
    if (!window.daum?.Postcode) {
      alert('주소검색 준비 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        const buildingName = data.buildingName || data.apartment || '';
        const dong = data.bname || '';
        const jibun = data.jibunAddress || data.autoJibunAddress || '';
        const lotNumber = jibun.split(' ').pop() || '';
        setForm(prev => ({
          ...prev,
          ...(dong && { dong }),
          ...(lotNumber && { lot_number: lotNumber }),
          ...(buildingName && { building_name: buildingName }),
        }));
      },
    }).open();
  };

  const openNew = () => {
    setModalRow(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (row: Row) => {
    if (row.status === 'registered') return;
    setModalRow(row);
    setForm({
      dong: row.dong ?? '',
      lot_number: row.lot_number ?? '',
      building_name: row.building_name ?? '',
      business_name: row.business_name ?? '',
      phone: row.phone ?? '',
      floor_info: row.floor_info ?? '',
      area_m2: row.area_m2 != null ? String(row.area_m2) : '',
      deposit: row.deposit != null ? String(row.deposit) : '',
      monthly_rent: row.monthly_rent != null ? String(row.monthly_rent) : '',
      memo: row.memo ?? '',
      agent_id: row.agent_id ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setModalRow(null); };

  const saveModal = async () => {
    setSaving(true);
    const payload = {
      dong: form.dong || null,
      lot_number: form.lot_number || null,
      building_name: form.building_name || null,
      business_name: form.business_name || null,
      phone: form.phone || null,
      floor_info: form.floor_info || null,
      area_m2: form.area_m2 !== '' ? Number(form.area_m2) : null,
      deposit: form.deposit !== '' ? Number(form.deposit) : null,
      monthly_rent: form.monthly_rent !== '' ? Number(form.monthly_rent) : null,
      memo: form.memo || null,
      agent_id: form.agent_id || null,
    };
    if (modalRow) {
      await supabase.from('prospect_properties').update(payload).eq('id', modalRow.id);
      setRows(prev => prev.map(r => r.id === modalRow.id ? { ...r, ...payload } : r));
      showToast('수정되었습니다.');
    } else {
      const { data } = await supabase
        .from('prospect_properties')
        .insert({ ...payload, status: 'prospect' })
        .select().single();
      if (data) setRows(prev => [data, ...prev]);
      showToast('추가되었습니다.');
    }
    setSaving(false);
    closeModal();
  };

  const deleteRow = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from('prospect_properties').delete().eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
    showToast('삭제되었습니다.');
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
  const fmtNum = (v: number | null) => v != null ? v.toLocaleString() : '';
  const printDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  const tdS: React.CSSProperties = {
    padding: '8px 10px', borderRight: '1px solid #eee', verticalAlign: 'middle',
    fontSize: '13px', color: '#333',
  };
  const inpS: React.CSSProperties = {
    width: '100%', border: '1px solid #ddd', borderRadius: '5px',
    padding: '8px 10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };
  const labelS: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '4px',
  };

  const HEADERS = ['동', '번지', '건물명', '상호(업종)', '전화번호', '층(호수)', '㎡', '평', '보증금', '월세', '비고', '담당자', ''];

  return (
    <>
      <style>{`
        .prow:hover { background: #fffbf5 !important; cursor: pointer; }
        .print-only { display: none; }
        @page { size: A4 landscape; margin: 15mm; }
        @media print {
          .no-print { display: none !important; }
          .print-header { display: block !important; }
          .print-footer { display: block !important; }
          header, footer, nav, .MobileTabBar { display: none !important; }
          body { padding: 0; margin: 0; background: #fff; }
          .print-container { max-width: 100% !important; padding: 0 !important; }
          .print-wrap { overflow: visible !important; border: none !important; border-radius: 0 !important; }
          .print-table {
            min-width: 0 !important; width: 100% !important;
            table-layout: fixed; border-collapse: collapse !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #bbb !important;
            padding: 4px 5px !important;
            font-size: 10px !important;
            word-break: break-word !important;
            overflow: visible !important;
            white-space: normal !important;
          }
          .print-table thead tr {
            background: #f0f0f0 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print-table thead th { font-weight: 700 !important; color: #222 !important; }
          /* 담당자(13번째) 숨김, 액션(14번째)은 .no-print */
          .print-table th:nth-child(13), .print-table td:nth-child(13) { display: none !important; }
          /* 컬럼 너비 (A4 landscape, # 숨김 기준) */
          .print-table th:nth-child(2)  { width: 4%; }
          .print-table th:nth-child(3)  { width: 5%; }
          .print-table th:nth-child(4)  { width: 8%; }
          .print-table th:nth-child(5)  { width: 10%; }
          .print-table th:nth-child(6)  { width: 11%; }
          .print-table th:nth-child(7)  { width: 7%; }
          .print-table th:nth-child(8)  { width: 4%; }
          .print-table th:nth-child(9)  { width: 4%; }
          .print-table th:nth-child(10) { width: 6%; }
          .print-table th:nth-child(11) { width: 5%; }
          .print-table th:nth-child(12) { width: 36%; }
          .print-table td span {
            white-space: normal !important; overflow: visible !important;
            text-overflow: clip !important; display: inline !important;
            -webkit-line-clamp: unset !important;
          }
          .prow:hover { background: inherit !important; }
        }
      `}</style>

      <div className="print-container" style={{ maxWidth: '1600px', margin: '0 auto', padding: '20px 8px 80px' }}>

        {/* 화면 헤더 */}
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

        {/* 인쇄 전용 헤더 */}
        <div className="print-header" style={{ display: 'none', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#111' }}>임장 후보 매물 목록</h2>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>헤르만부동산</div>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>출력일: {printDate}</div>
            </div>
          </div>
          <div style={{ marginTop: '8px', paddingBottom: '8px', borderBottom: '2px solid #222', fontSize: '12px', color: '#444' }}>
            담당자: <strong>{filterAgent ? agentName(filterAgent) : '전체'}</strong>
            &nbsp;&nbsp;|&nbsp;&nbsp;총 <strong>{displayed.length}건</strong>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#aaa', fontSize: '14px' }}>로딩 중...</div>
        ) : (
          <div className="print-wrap" style={{ overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff' }}>
            <table className="print-table" style={{ borderCollapse: 'collapse', width: '100%', minWidth: '960px' }}>
              <thead>
                <tr style={{ background: '#f8f8f8', borderBottom: '2px solid #ddd' }}>
                  <th className="print-only" style={{ padding: '9px 6px', fontSize: '12px', fontWeight: 700, color: '#555', textAlign: 'center', borderRight: '1px solid #eee' }}>#</th>
                  {HEADERS.map((h, i) => (
                    <th key={i} style={{ padding: '9px 10px', fontSize: '12px', fontWeight: 700, color: '#555', textAlign: h === '' ? 'center' : 'left', whiteSpace: 'nowrap', borderRight: '1px solid #eee' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={15} style={{ textAlign: 'center', padding: '40px', color: '#aaa', fontSize: '13px' }}>
                      아래 "+ 추가" 버튼으로 추가하세요.
                    </td>
                  </tr>
                )}
                {displayed.map((row, idx) => {
                  const reg = row.status === 'registered';
                  const tc = reg ? '#bbb' : '#333';
                  const cell = (val: string | number | null, minW?: number) => (
                    <td style={{ ...tdS, color: tc, ...(minW ? { minWidth: `${minW}px` } : {}) }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val ?? ''}</span>
                    </td>
                  );
                  return (
                    <tr key={row.id} className={reg ? '' : 'prow'}
                      style={{ background: reg ? '#f7f7f7' : idx % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #eee' }}
                      onClick={() => !reg && openEdit(row)}>
                      <td className="print-only" style={{ ...tdS, textAlign: 'center', color: '#555', fontSize: '11px' }}>{idx + 1}</td>
                      {cell(row.dong)}
                      {cell(row.lot_number)}
                      {cell(row.building_name)}
                      {cell(row.business_name)}
                      {cell(row.phone, 130)}
                      {cell(row.floor_info)}
                      {cell(row.area_m2)}
                      <td style={{ ...tdS, color: '#888' }}>{pyeong(row.area_m2)}</td>
                      {cell(fmtNum(row.deposit))}
                      {cell(fmtNum(row.monthly_rent))}
                      <td style={{ ...tdS, color: tc, maxWidth: '260px', minWidth: '200px' }} title={row.memo ?? undefined}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal', lineHeight: '1.4', wordBreak: 'break-all' }}>{row.memo ?? ''}</span>
                      </td>
                      {cell(agentName(row.agent_id))}
                      <td className="no-print" style={{ ...tdS, textAlign: 'center', whiteSpace: 'nowrap' }}
                        onClick={e => e.stopPropagation()}>
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

        <div className="no-print" style={{ marginTop: '12px' }}>
          <button onClick={openNew}
            style={{ padding: '10px 22px', background: '#1a1a1a', color: '#e2a06e', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            + 추가
          </button>
        </div>

        {/* 인쇄 전용 푸터 */}
        <div className="print-footer" style={{ display: 'none', marginTop: '16px', borderTop: '1px solid #ccc', paddingTop: '8px', textAlign: 'center', fontSize: '11px', color: '#555' }}>
          헤르만부동산 &nbsp;·&nbsp; 010-8680-8151
        </div>
      </div>

      {/* 입력/수정 모달 */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500 }}>
          <div style={{
            position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
            width: '560px', maxWidth: 'calc(100vw - 40px)', maxHeight: 'calc(100vh - 100px)',
            display: 'flex', flexDirection: 'column',
            background: '#fff', borderRadius: '12px', overflow: 'hidden',
          }}>

            {/* 상단 고정: 제목 + 주소 검색 */}
            <div style={{ flexShrink: 0, padding: '20px 24px 16px', borderBottom: '2px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#1a1a1a' }}>
                  {modalRow ? '임장 매물 수정' : '임장 매물 추가'}
                </h2>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#999', lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
              <div>
                <label style={labelS}>주소</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input readOnly value={[form.dong, form.lot_number].filter(Boolean).join(' ') || ''}
                    placeholder="주소를 검색하세요"
                    style={{ ...inpS, flex: 1, background: '#f9f9f9', color: '#555', cursor: 'default' }} />
                  <button type="button" onClick={openDaumPostcode}
                    style={{ height: '40px', padding: '0 20px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    주소 검색
                  </button>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#aaa' }}>동·번지·건물명 자동입력</p>
              </div>
            </div>

            {/* 스크롤 가능한 본문 */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* 동 / 번지 */}
                <div>
                  <label style={labelS}>동</label>
                  <input style={inpS} value={form.dong} onChange={e => setForm(p => ({ ...p, dong: e.target.value }))} placeholder="예: 중동" />
                </div>
                <div>
                  <label style={labelS}>번지</label>
                  <input style={inpS} value={form.lot_number} onChange={e => setForm(p => ({ ...p, lot_number: e.target.value }))} placeholder="예: 123-4" />
                </div>
                {/* 건물명 */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelS}>건물명</label>
                  <input style={inpS} value={form.building_name}
                    onChange={e => setForm(p => ({ ...p, building_name: e.target.value }))} placeholder="예: 삼성빌딩" />
                </div>
                {/* 상호/업종 */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelS}>상호 / 업종</label>
                  <input style={inpS} value={form.business_name} onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))} placeholder="예: 카페, 편의점" />
                </div>
                {/* 전화번호 */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelS}>전화번호</label>
                  <input style={inpS} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: fmtPhone(e.target.value) }))} placeholder="010-0000-0000" inputMode="tel" />
                </div>
                {/* 층/호수 / 면적 */}
                <div>
                  <label style={labelS}>층 / 호수</label>
                  <input style={inpS} value={form.floor_info} onChange={e => setForm(p => ({ ...p, floor_info: e.target.value }))} placeholder="예: 1층, 201호" />
                </div>
                <div>
                  <label style={labelS}>
                    면적 (㎡)
                    {form.area_m2 !== '' && !isNaN(Number(form.area_m2)) && (
                      <span style={{ color: '#c47c30', fontWeight: 400, marginLeft: '6px' }}>
                        ≈ {(Number(form.area_m2) / 3.3058).toFixed(1)}평
                      </span>
                    )}
                  </label>
                  <input style={inpS} type="number" value={form.area_m2} onChange={e => setForm(p => ({ ...p, area_m2: e.target.value }))} placeholder="㎡" />
                </div>
                {/* 보증금 / 월세 */}
                <div>
                  <label style={labelS}>보증금 (만원)</label>
                  <input style={inpS} type="number" value={form.deposit} onChange={e => setForm(p => ({ ...p, deposit: e.target.value }))} placeholder="만원" />
                </div>
                <div>
                  <label style={labelS}>월세 (만원)</label>
                  <input style={inpS} type="number" value={form.monthly_rent} onChange={e => setForm(p => ({ ...p, monthly_rent: e.target.value }))} placeholder="만원" />
                </div>
                {/* 비고 */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelS}>비고</label>
                  <textarea rows={4} style={{ ...inpS, resize: 'vertical', lineHeight: '1.5' }} value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} placeholder="메모" />
                </div>
                {/* 담당자 */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelS}>담당자</label>
                  <select style={inpS} value={form.agent_id} onChange={e => setForm(p => ({ ...p, agent_id: e.target.value }))}>
                    <option value="">-</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* 하단 고정: 취소/저장 */}
            <div style={{ flexShrink: 0, padding: '14px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={closeModal}
                style={{ padding: '10px 20px', background: '#fff', border: '1px solid #ddd', borderRadius: '7px', fontSize: '14px', cursor: 'pointer', color: '#555' }}>
                취소
              </button>
              <button onClick={saveModal} disabled={saving}
                style={{ padding: '10px 24px', background: '#1a1a1a', color: '#e2a06e', border: 'none', borderRadius: '7px', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 22px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, zIndex: 600 }}>
          {toast}
        </div>
      )}
    </>
  );
}
