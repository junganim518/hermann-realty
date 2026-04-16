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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 손님 정보를 삭제하시겠습니까?`)) return;
    await supabase.from('customers').delete().eq('id', id);
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const filtered = filter === '전체' ? customers : customers.filter(c => c.status === filter);

  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>;

  const thSt: React.CSSProperties = { padding: '12px 10px', fontSize: '13px', fontWeight: 600, color: '#888', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid #e2a06e' };
  const tdSt: React.CSSProperties = { padding: '12px 10px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ko-KR') : '-';
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

        {/* 테이블 */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>등록된 손님이 없습니다</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr>
                  <th style={thSt}>이름</th>
                  <th style={thSt}>연락처</th>
                  <th style={thSt}>관심매물</th>
                  <th style={thSt}>예산</th>
                  <th style={thSt}>지역</th>
                  <th style={thSt}>상담날짜</th>
                  <th style={thSt}>방문날짜</th>
                  <th style={thSt}>진행상태</th>
                  <th style={{ ...thSt, textAlign: 'center' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ ...tdSt, fontWeight: 700 }}>{c.name}</td>
                    <td style={tdSt}>{c.phone || '-'}</td>
                    <td style={tdSt}>{c.interest_type || '-'}</td>
                    <td style={tdSt}>{c.budget || '-'}</td>
                    <td style={tdSt}>{c.region || '-'}</td>
                    <td style={{ ...tdSt, fontSize: '13px' }}>{formatDateTime(c.consultation_date)}</td>
                    <td style={{ ...tdSt, fontSize: '13px' }}>{formatDateTime(c.visit_date)}</td>
                    <td style={tdSt}>
                      <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '10px', background: STATUS_COLORS[c.status] ?? '#999', color: '#fff', fontWeight: 600 }}>{c.status}</span>
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
    </main>
  );
}
