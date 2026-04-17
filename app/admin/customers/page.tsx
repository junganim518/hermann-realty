'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const STATUSES = ['전체', '상담중', '방문예정', '방문완료', '계약진행', '계약완료', '보류'];
const STATUS_COLORS: Record<string, string> = {
  '상담중': '#2196F3', '방문예정': '#e2a06e', '방문완료': '#4caf50',
  '계약진행': '#ff9800', '계약완료': '#9c27b0', '보류': '#999',
};

export default function CustomersPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [filter, setFilter] = useState('전체');
  const [loading, setLoading] = useState(true);
  const [modalCustomer, setModalCustomer] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/customers'); return; }
      setAuthChecked(true);
      fetchCustomers();
    });
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data ?? []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('customers').update({ status }).eq('id', id);
    if (error) { alert(`상태 변경 실패: ${error.message}`); return; }
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 손님 정보를 삭제하시겠습니까?`)) return;
    await supabase.from('customers').delete().eq('id', id);
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const filtered = filter === '전체' ? customers : customers.filter(c => c.status === filter);

  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>;

  const thSt: React.CSSProperties = { padding: '12px 10px', fontSize: '13px', fontWeight: 600, color: '#888', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid #e2a06e' };
  const tdSt: React.CSSProperties = { padding: '12px 10px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    const dt = new Date(d);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}.${pad(dt.getMonth() + 1)}.${pad(dt.getDate())}`;
  };
  const formatDateTime = (d: string | null) => {
    if (!d) return '-';
    const dt = new Date(d);
    return `${dt.toLocaleDateString('ko-KR')} ${dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a' }}>손님 관리</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/admin" style={{ padding: '10px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#666', textDecoration: 'none' }}>대시보드</a>
            <a href="/admin/customers/new" style={{ padding: '10px 20px', background: '#e2a06e', color: '#fff', borderRadius: '6px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', border: 'none' }}>+ 신규 손님 등록</a>
          </div>
        </div>

        {/* 필터 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: filter === s ? 700 : 400, cursor: 'pointer',
              background: filter === s ? '#1a1a1a' : '#fff', color: filter === s ? '#e2a06e' : '#666',
              border: filter === s ? '1px solid #1a1a1a' : '1px solid #ddd',
            }}>{s} {s !== '전체' ? `(${customers.filter(c => c.status === s).length})` : `(${customers.length})`}</button>
          ))}
        </div>

        {/* PC 테이블 */}
        <div className="cust-table" style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>등록된 손님이 없습니다</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1050px' }}>
              <thead>
                <tr>
                  <th style={thSt}>상담날짜</th>
                  <th style={thSt}>이름</th>
                  <th style={thSt}>연락처</th>
                  <th style={thSt}>관심매물</th>
                  <th style={thSt}>예산</th>
                  <th style={thSt}>지역</th>
                  <th style={thSt}>방문날짜</th>
                  <th style={thSt}>메모</th>
                  <th style={thSt}>진행상태</th>
                  <th style={{ ...thSt, textAlign: 'center' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ ...tdSt, fontSize: '13px', whiteSpace: 'nowrap' }}>{formatDate(c.consultation_date)}</td>
                    <td style={{ ...tdSt, fontWeight: 700 }}>{c.name}</td>
                    <td style={tdSt}>{c.phone || '-'}</td>
                    <td style={tdSt}>{c.interest_type || '-'}</td>
                    <td style={tdSt}>{c.budget || '-'}</td>
                    <td style={tdSt}>{c.region || '-'}</td>
                    <td style={{ ...tdSt, fontSize: '13px', whiteSpace: 'nowrap' }}>{formatDate(c.visit_date)}</td>
                    <td style={{ ...tdSt, maxWidth: '200px' }}>
                      {c.memo ? (
                        <span onClick={() => setModalCustomer(c)} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', whiteSpace: 'pre-line', lineHeight: 1.4, fontSize: '12px', color: '#666', cursor: 'pointer' }} title="클릭하여 전체 보기">{c.memo}</span>
                      ) : <span style={{ color: '#ccc', fontSize: '12px' }}>-</span>}
                    </td>
                    <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
                      <select
                        value={c.status}
                        onChange={e => updateStatus(c.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '12px', fontWeight: 700, borderRadius: '4px', cursor: 'pointer', border: `1px solid ${STATUS_COLORS[c.status] ?? '#999'}`, background: (STATUS_COLORS[c.status] ?? '#999') + '18', color: STATUS_COLORS[c.status] ?? '#999' }}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ ...tdSt, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <a href={`/admin/customers/${c.id}/edit`} style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #e2a06e', borderRadius: '4px', color: '#e2a06e', textDecoration: 'none', fontWeight: 600 }}>수정</a>
                        <button onClick={() => handleDelete(c.id, c.name)} style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #e05050', borderRadius: '4px', color: '#e05050', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

        {/* 모바일 카드 */}
        <div className="cust-cards" style={{ display: 'none', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>등록된 손님이 없습니다</p>
          ) : filtered.map(c => (
            <div key={c.id} onClick={() => setModalCustomer(c)} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px' }}>{c.name}</span>
                  <span style={{ fontSize: '13px', color: '#888' }}>{c.phone || ''}</span>
                </div>
                <select value={c.status} onClick={e => e.stopPropagation()} onChange={e => updateStatus(c.id, e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '4px', cursor: 'pointer', border: `1px solid ${STATUS_COLORS[c.status] ?? '#999'}`, background: (STATUS_COLORS[c.status] ?? '#999') + '18', color: STATUS_COLORS[c.status] ?? '#999' }}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                {c.interest_type && <span>{c.interest_type}</span>}
                {c.budget && <span>· {c.budget}</span>}
                {c.region && <span>· {c.region}</span>}
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#888', marginBottom: c.memo ? '6px' : '0' }}>
                <span>상담 {formatDate(c.consultation_date)}</span>
                <span>방문 {formatDate(c.visit_date)}</span>
              </div>
              {c.memo && <p style={{ fontSize: '11px', color: '#999', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.memo}</p>}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                <a href={`/admin/customers/${c.id}/edit`} style={{ flex: 1, textAlign: 'center', padding: '6px', fontSize: '12px', border: '1px solid #e2a06e', borderRadius: '4px', color: '#e2a06e', textDecoration: 'none', fontWeight: 600 }}>수정</a>
                <button onClick={() => handleDelete(c.id, c.name)} style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #e05050', borderRadius: '4px', color: '#e05050', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>삭제</button>
              </div>
            </div>
          ))}
        </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          main { padding: 12px 8px !important; }
          main h1 { font-size: 22px !important; }
          .cust-table { display: none !important; }
          .cust-cards { display: flex !important; }
        }
        @media (min-width: 768px) {
          .cust-cards { display: none !important; }
        }
      ` }} />

      {/* 메모 모달 */}
      {modalCustomer && (
        <div onClick={() => setModalCustomer(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '12px', maxWidth: '520px', width: '100%', maxHeight: '80vh', overflow: 'auto', position: 'relative' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '2px solid #e2a06e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>손님 상세</h3>
              <button onClick={() => setModalCustomer(null)} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px 12px', fontSize: '14px', marginBottom: '20px' }}>
                <span style={{ color: '#888', fontWeight: 500 }}>이름</span>
                <span style={{ color: '#1a1a1a', fontWeight: 700 }}>{modalCustomer.name}</span>
                <span style={{ color: '#888', fontWeight: 500 }}>연락처</span>
                <span>{modalCustomer.phone || '-'}</span>
                <span style={{ color: '#888', fontWeight: 500 }}>관심매물</span>
                <span>{modalCustomer.interest_type || '-'}</span>
                <span style={{ color: '#888', fontWeight: 500 }}>예산</span>
                <span>{modalCustomer.budget || '-'}</span>
                <span style={{ color: '#888', fontWeight: 500 }}>지역</span>
                <span>{modalCustomer.region || '-'}</span>
                <span style={{ color: '#888', fontWeight: 500 }}>진행상태</span>
                <span><span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '10px', background: STATUS_COLORS[modalCustomer.status] ?? '#999', color: '#fff', fontWeight: 600 }}>{modalCustomer.status}</span></span>
              </div>
              <div style={{ background: '#f8f8f8', borderRadius: '8px', padding: '16px', border: '1px solid #f0f0f0' }}>
                <p style={{ fontSize: '12px', color: '#888', fontWeight: 600, marginBottom: '8px' }}>메모</p>
                <p style={{ fontSize: '14px', color: '#333', margin: 0, whiteSpace: 'pre-line', lineHeight: 1.7 }}>{modalCustomer.memo || '내용 없음'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
