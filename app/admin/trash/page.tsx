'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function TrashPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<string | null>(null); // 현재 처리 중인 id

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/trash'); return; }
      setAuthChecked(true);
      fetchTrash();
    });
  }, []);

  const fetchTrash = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('properties')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    setProperties(data ?? []);
    setLoading(false);
  };

  const restoreProperty = async (p: any) => {
    if (!confirm(`매물 ${p.property_number}을 복구하시겠습니까?`)) return;
    setActing(p.id);
    const { error } = await supabase.from('properties').update({ deleted_at: null }).eq('id', p.id);
    setActing(null);
    if (error) { alert(`복구 실패: ${error.message}`); return; }
    setProperties(prev => prev.filter(x => x.id !== p.id));
  };

  const permanentDelete = async (p: any) => {
    if (!confirm(`매물 ${p.property_number}을 영구 삭제하시겠습니까?\n영구 삭제하면 복구할 수 없습니다.`)) return;
    setActing(p.id);
    // 이미지 삭제 (공유 안 된 파일만 R2에서 제거)
    const { data: imgs } = await supabase.from('property_images').select('id, image_url').eq('property_id', p.id);
    if (imgs && imgs.length > 0) {
      for (const img of imgs) {
        const { count } = await supabase
          .from('property_images')
          .select('*', { count: 'exact', head: true })
          .eq('image_url', img.image_url);
        if ((count ?? 1) <= 1) {
          try { await fetch('/api/delete-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: img.image_url }) }); } catch {}
        }
      }
      await supabase.from('property_images').delete().eq('property_id', p.id);
    }
    const { error } = await supabase.from('properties').delete().eq('id', p.id);
    setActing(null);
    if (error) { alert(`영구 삭제 실패: ${error.message}`); return; }
    setProperties(prev => prev.filter(x => x.id !== p.id));
  };

  const filtered = properties.filter(p => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (p.property_number ?? '').toLowerCase().includes(q) ||
      (p.address ?? '').toLowerCase().includes(q) ||
      (p.building_name ?? '').toLowerCase().includes(q)
    );
  });

  const fmtDeleted = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    } catch { return iso; }
  };

  const fmtPrice = (p: any) => {
    if (p.transaction_type === '매매') {
      const v = p.sale_price || p.deposit;
      if (!v) return '-';
      const uk = Math.floor(v / 10000);
      const man = v % 10000;
      return uk > 0 ? (man > 0 ? `매매 ${uk}억 ${man.toLocaleString()}만` : `매매 ${uk}억`) : `매매 ${v.toLocaleString()}만`;
    }
    const parts = [
      p.deposit ? `보${(p.deposit / 10000 >= 1 ? Math.floor(p.deposit / 10000) + '억' : '') + (p.deposit % 10000 > 0 || p.deposit < 10000 ? (p.deposit % 10000 || p.deposit).toLocaleString() + '만' : '')}` : null,
      p.monthly_rent ? `월${p.monthly_rent.toLocaleString()}만` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join('/') : '-';
  };

  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>;

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ marginBottom: '12px' }}>
          <button onClick={() => router.push('/admin')} style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>← 관리자 대시보드로</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>🗑️ 휴지통 {!loading && `(${properties.length})`}</h1>
          <span style={{ fontSize: '13px', color: '#888' }}>휴지통 매물은 복구하거나 영구 삭제할 수 있습니다.</span>
        </div>

        {/* 검색 */}
        <div style={{ marginBottom: '16px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="매물번호 / 주소 / 건물명 검색"
            style={{ width: '100%', maxWidth: '400px', height: '40px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
          />
        </div>

        {/* 목록 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#aaa', fontSize: '15px' }}>
            {search ? '검색 결과가 없습니다.' : '휴지통이 비어있습니다.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(p => {
              const isActing = acting === p.id;
              return (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  {/* 매물 정보 */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 500 }}>#{p.property_number}</span>
                      {p.transaction_type && (
                        <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', border: '1px solid #ddd', color: '#666' }}>{p.transaction_type}</span>
                      )}
                      {p.property_type && (
                        <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: '#f5f5f5', color: '#666' }}>{p.property_type}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a', marginBottom: '2px' }}>
                      {p.address ?? '-'}
                      {p.building_name && <span style={{ fontSize: '13px', color: '#666', fontWeight: 400, marginLeft: '6px' }}>{p.building_name}</span>}
                    </div>
                    <div style={{ fontSize: '13px', color: '#888' }}>
                      {fmtPrice(p)}
                      {p.deleted_at && <span style={{ marginLeft: '12px', color: '#bbb' }}>삭제일 {fmtDeleted(p.deleted_at)}</span>}
                    </div>
                  </div>

                  {/* 버튼 */}
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => restoreProperty(p)}
                      disabled={isActing}
                      style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, background: '#fff', border: '1px solid #4caf50', color: '#4caf50', borderRadius: '6px', cursor: isActing ? 'not-allowed' : 'pointer', opacity: isActing ? 0.6 : 1 }}
                    >복구</button>
                    <button
                      onClick={() => permanentDelete(p)}
                      disabled={isActing}
                      style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, background: '#fff', border: '1px solid #e05050', color: '#e05050', borderRadius: '6px', cursor: isActing ? 'not-allowed' : 'pointer', opacity: isActing ? 0.6 : 1 }}
                    >영구 삭제</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
