'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const STATUS_LIST = ['미처리', '처리중', '완료'];

const formatPrice = (v: number | null) => {
  if (!v) return null;
  const uk = Math.floor(v / 10000);
  const man = v % 10000;
  if (uk > 0) return man > 0 ? `${uk}억 ${man.toLocaleString()}만` : `${uk}억`;
  return `${v.toLocaleString()}만`;
};

const buildPriceStr = (q: any) => {
  if (q.sale_price) return `매매가 ${formatPrice(q.sale_price)}`;
  const parts = [
    q.deposit ? `보증금 ${formatPrice(q.deposit)}` : null,
    q.monthly_rent ? `월세 ${formatPrice(q.monthly_rent)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '-';
};

const statusColor = (status: string) => {
  if (status === '완료') return { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' };
  if (status === '처리중') return { bg: '#fff8e1', border: '#ffa726', text: '#e67e22' };
  return { bg: '#fff0f0', border: '#e05050', text: '#c0392b' };
};

export default function AdminInquiriesPage() {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // 로그인 체크
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login?redirect=/admin/inquiries');
      } else {
        setAuthChecked(true);
      }
    });
  }, []);

  // fetch
  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false });
    setInquiries(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (authChecked) fetchAll();
  }, [authChecked]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('inquiries').update({ status }).eq('id', id);
    if (error) { alert(`상태 변경 실패: ${error.message}`); return; }
    setInquiries(prev => prev.map(q => q.id === id ? { ...q, status } : q));
  };

  if (!authChecked) {
    return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#888' }}>인증 확인 중...</p></main>;
  }

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '24px 16px' }}>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1024px) {
          .inq-table { display: none !important; }
          .inq-cards { display: flex !important; }
        }
        @media (min-width: 1025px) {
          .inq-cards { display: none !important; }
        }
        @media (max-width: 767px) {
          .inq-page { padding: 16px 8px !important; }
          .inq-page h1 { font-size: 22px !important; }
        }
      ` }} />

      <div className="inq-page" style={{ maxWidth: '1280px', margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a' }}>매물 의뢰 목록</h1>
            <p style={{ fontSize: '14px', color: '#888', marginTop: '4px' }}>
              총 <strong style={{ color: '#e2a06e' }}>{inquiries.length}</strong>건
              {' · '}
              미처리 <strong style={{ color: '#e05050' }}>{inquiries.filter(q => (q.status ?? '미처리') === '미처리').length}</strong>건
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>불러오는 중...</div>
        ) : inquiries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>📭</p>
            <p style={{ fontSize: '15px', color: '#666' }}>접수된 의뢰가 없습니다</p>
          </div>
        ) : (
          <>
            {/* 데스크톱 테이블 */}
            <div className="inq-table" style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8f8f8', borderBottom: '2px solid #e0e0e0' }}>
                    {['접수일시', '유형', '이름', '연락처', '매물종류', '주소', '희망조건', '요청사항', '상태'].map(h => (
                      <th key={h} style={{ padding: '12px 10px', textAlign: 'left', color: '#555', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map(q => {
                    const status = q.status ?? '미처리';
                    const c = statusColor(status);
                    return (
                      <tr key={q.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px', color: '#666', whiteSpace: 'nowrap' }}>
                          {q.created_at ? new Date(q.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td style={{ padding: '10px', color: '#333', whiteSpace: 'nowrap' }}>
                          <span style={{ background: '#fff8f2', border: '1px solid #e2a06e', color: '#e2a06e', padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 700 }}>{q.inquiry_type}</span>
                        </td>
                        <td style={{ padding: '10px', color: '#333', fontWeight: 600 }}>{q.name}</td>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                          <a href={`tel:${q.phone}`} style={{ color: '#4a7cdc', fontWeight: 600, textDecoration: 'none' }}>📞 {q.phone}</a>
                        </td>
                        <td style={{ padding: '10px', color: '#666' }}>{q.property_type ?? '-'}</td>
                        <td style={{ padding: '10px', color: '#666', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.address ?? ''}>{q.address ?? '-'}</td>
                        <td style={{ padding: '10px', color: '#1a1a1a', fontWeight: 600, whiteSpace: 'nowrap' }}>{buildPriceStr(q)}</td>
                        <td style={{ padding: '10px', color: '#666', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.message ?? ''}>{q.message ?? '-'}</td>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                          <select
                            value={status}
                            onChange={e => updateStatus(q.id, e.target.value)}
                            style={{ padding: '4px 8px', fontSize: '12px', fontWeight: 700, border: `1px solid ${c.border}`, background: c.bg, color: c.text, borderRadius: '4px', cursor: 'pointer' }}
                          >
                            {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 */}
            <div className="inq-cards" style={{ display: 'none', flexDirection: 'column', gap: '12px' }}>
              {inquiries.map(q => {
                const status = q.status ?? '미처리';
                const c = statusColor(status);
                return (
                  <div key={q.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ background: '#fff8f2', border: '1px solid #e2a06e', color: '#e2a06e', padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 700 }}>{q.inquiry_type}</span>
                      <select
                        value={status}
                        onChange={e => updateStatus(q.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '12px', fontWeight: 700, border: `1px solid ${c.border}`, background: c.bg, color: c.text, borderRadius: '4px', cursor: 'pointer' }}
                      >
                        {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px' }}>
                      {q.created_at ? new Date(q.created_at).toLocaleString('ko-KR') : '-'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>{q.name}</span>
                      <a href={`tel:${q.phone}`} style={{ color: '#4a7cdc', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>📞 {q.phone}</a>
                    </div>
                    {q.property_type && <p style={{ fontSize: '13px', color: '#666', margin: '2px 0' }}>매물: {q.property_type}</p>}
                    {q.address && <p style={{ fontSize: '13px', color: '#666', margin: '2px 0' }}>주소: {q.address}</p>}
                    {(q.deposit || q.monthly_rent || q.sale_price) && <p style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 600, margin: '4px 0' }}>{buildPriceStr(q)}</p>}
                    {q.message && <p style={{ fontSize: '12px', color: '#888', margin: '6px 0 0', padding: '8px', background: '#f8f8f8', borderRadius: '4px', whiteSpace: 'pre-line' }}>{q.message}</p>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
