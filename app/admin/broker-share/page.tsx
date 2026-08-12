'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type ListRow = {
  id: string;
  name: string;
  created_at: string;
  item_count: number;
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

export default function BrokerShareListPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/broker-share'); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    fetchLists();
  }, [authChecked]);

  const fetchLists = async () => {
    setLoading(true);
    const { data: lists } = await supabase
      .from('broker_share_lists')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });

    if (!lists || lists.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const ids = lists.map(l => l.id);
    const { data: counts } = await supabase
      .from('broker_share_list_items')
      .select('list_id')
      .in('list_id', ids);

    const countMap: Record<string, number> = {};
    (counts ?? []).forEach(r => {
      countMap[r.list_id] = (countMap[r.list_id] ?? 0) + 1;
    });

    setRows(lists.map(l => ({ ...l, item_count: countMap[l.id] ?? 0 })));
    setLoading(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 리스트를 삭제할까요?\n(담긴 매물 목록도 함께 삭제됩니다)`)) return;
    setDeleting(id);
    const { error } = await supabase.from('broker_share_lists').delete().eq('id', id);
    setDeleting(null);
    if (error) { alert(`삭제 실패: ${error.message}`); return; }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  if (!authChecked || loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#888' }}>
        로딩 중...
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8f8f8', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>공동중개 매물 리스트</h1>
            <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0' }}>총 {rows.length}개 리스트</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            style={{ fontSize: '13px', fontWeight: 600, padding: '7px 14px', background: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}
          >
            ← 대시보드
          </button>
        </div>

        {/* 안내 */}
        <div style={{ background: '#fff8f2', border: '1px solid #e2a06e33', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400e' }}>
          💡 매물을 선택한 뒤 <strong>관리자 대시보드</strong>에서 "공동중개 리스트 만들기"로 새 리스트를 추가할 수 있습니다.
        </div>

        {/* 목록 */}
        {rows.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #eee', padding: '60px 0', textAlign: 'center', color: '#aaa', fontSize: '15px' }}>
            아직 생성된 공동중개 리스트가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rows.map(row => (
              <div
                key={row.id}
                onClick={() => router.push(`/admin/broker-share/${row.id}/print`)}
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  (e.currentTarget as HTMLElement).style.borderColor = '#e2a06e';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb';
                }}
              >
                {/* 왼쪽: 이름 + 날짜 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    생성일 {fmtDate(row.created_at)}
                  </div>
                </div>

                {/* 가운데: 매물 수 뱃지 */}
                <div style={{
                  background: '#f3f4f6', borderRadius: '20px',
                  padding: '4px 12px', fontSize: '13px', fontWeight: 700, color: '#374151',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {row.item_count}개 매물
                </div>

                {/* 오른쪽: 삭제 버튼 */}
                <button
                  type="button"
                  disabled={deleting === row.id}
                  onClick={e => { e.stopPropagation(); handleDelete(row.id, row.name); }}
                  style={{
                    flexShrink: 0,
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: '#fff',
                    color: '#e05050',
                    border: '1px solid #fca5a5',
                    borderRadius: '5px',
                    cursor: deleting === row.id ? 'not-allowed' : 'pointer',
                    opacity: deleting === row.id ? 0.5 : 1,
                  }}
                >
                  {deleting === row.id ? '삭제 중…' : '삭제'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
