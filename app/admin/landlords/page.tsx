'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Landlord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  business_number: string | null;
  memo: string | null;
  created_at: string;
};

export default function LandlordsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [contractCounts, setContractCounts] = useState<Record<string, { active: number; total: number }>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/landlords'); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      const [{ data: lands }, { data: contracts }] = await Promise.all([
        supabase.from('landlords').select('*').order('created_at', { ascending: false }),
        supabase.from('contracts').select('landlord_id, status'),
      ]);
      setLandlords(lands ?? []);
      const counts: Record<string, { active: number; total: number }> = {};
      (contracts ?? []).forEach(c => {
        if (!c.landlord_id) return;
        if (!counts[c.landlord_id]) counts[c.landlord_id] = { active: 0, total: 0 };
        counts[c.landlord_id].total++;
        if (c.status !== '종료' && c.status !== '재계약') counts[c.landlord_id].active++;
      });
      setContractCounts(counts);
      setLoading(false);
    })();
  }, [authChecked]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 임대인을 삭제하시겠습니까? (계약은 유지되고 참조만 끊깁니다)`)) return;
    const { error } = await supabase.from('landlords').delete().eq('id', id);
    if (error) { alert(`삭제 실패: ${error.message}`); return; }
    setLandlords(prev => prev.filter(l => l.id !== id));
  };

  const filtered = landlords.filter(l => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (l.name ?? '').toLowerCase().includes(q) ||
      (l.phone ?? '').toLowerCase().includes(q) ||
      (l.business_number ?? '').toLowerCase().includes(q)
    );
  });

  if (!authChecked || loading) {
    return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</main>;
  }

  const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', marginBottom: '16px' };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px 16px 60px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.push('/admin')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
              <ArrowLeft size={14} /> 대시보드
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>👥 임대인 관리 ({landlords.length})</h1>
          </div>
          <Link href="/admin/landlords/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 14px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
            <Plus size={14} /> 새 임대인
          </Link>
        </div>

        {/* 검색 */}
        <div style={sectionSt}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름 / 전화번호 / 사업자번호 검색"
            style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
          />
        </div>

        {/* 임대인 목록 */}
        {filtered.length === 0 ? (
          <div style={{ ...sectionSt, textAlign: 'center', padding: '60px 0', color: '#888' }}>
            <p style={{ fontSize: '14px', marginBottom: '12px' }}>{search ? '검색 결과가 없습니다' : '등록된 임대인이 없습니다'}</p>
            {!search && (
              <Link href="/admin/landlords/new" style={{ display: 'inline-block', padding: '10px 20px', background: '#e2a06e', color: '#fff', borderRadius: '6px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
                + 첫 임대인 등록하기
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(l => {
              const cnt = contractCounts[l.id] ?? { active: 0, total: 0 };
              return (
                <Link
                  key={l.id}
                  href={`/admin/landlords/${l.id}`}
                  style={{ display: 'block', padding: '14px 18px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', textDecoration: 'none', color: '#1a1a1a' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>{l.name}</span>
                        {l.phone && <span style={{ fontSize: '13px', color: '#666' }}>{l.phone}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#888' }}>
                        {l.business_number && <span>사업자 {l.business_number}</span>}
                        {l.email && <span>{l.email}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: cnt.active > 0 ? '#dcfce7' : '#f3f4f6', color: cnt.active > 0 ? '#166534' : '#888' }}>
                        진행중 {cnt.active}
                      </span>
                      <span style={{ fontSize: '11px', color: '#888' }}>총 {cnt.total}건</span>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(l.id, l.name); }}
                        style={{ fontSize: '11px', padding: '4px 10px', background: '#fff', color: '#e05050', border: '1px solid #e05050', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      >삭제</button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
