'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatMaintenance } from '@/lib/formatProperty';

const TX_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  '월세': { bg: '#fff8f2', border: '#e2a06e', text: '#e2a06e' },
  '전세': { bg: '#eef4ff', border: '#4a80e8', text: '#4a80e8' },
  '매매': { bg: '#fff0f0', border: '#e05050', text: '#e05050' },
};

const formatPrice = (v: number) => {
  if (!v) return '-';
  const uk = Math.floor(v / 10000);
  const man = v % 10000;
  if (uk > 0) return man > 0 ? `${uk}억 ${man.toLocaleString()}만` : `${uk}억`;
  return `${v.toLocaleString()}만`;
};

const buildPriceStr = (p: any) => {
  if (p.transaction_type === '매매') return p.sale_price ? formatPrice(p.sale_price) : '-';
  if (p.transaction_type === '전세') return p.deposit ? formatPrice(p.deposit) : '-';
  const parts = [
    p.deposit ? `보 ${formatPrice(p.deposit)}` : null,
    p.monthly_rent ? `월 ${formatPrice(p.monthly_rent)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '-';
};

const formatAddr = (p: any) => {
  const addr = p.address || '';
  const extra = [p.building_name, p.dong_ho].filter(Boolean).join(' ');
  return extra ? `${addr} ${extra}` : addr || '-';
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

export default function BrokerShareEditPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params?.id as string;

  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listName, setListName] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [properties, setProperties] = useState<any[]>([]);
  const [propImages, setPropImages] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace(`/login?redirect=/admin/broker-share/${listId}`);
        return;
      }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    loadData();
  }, [authChecked]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: listData }, { data: items }] = await Promise.all([
      supabase.from('broker_share_lists').select('name, created_at').eq('id', listId).single(),
      supabase
        .from('broker_share_list_items')
        .select('property_id, created_at')
        .eq('list_id', listId)
        .order('created_at', { ascending: true }),
    ]);

    if (!listData) {
      alert('리스트를 찾을 수 없습니다.');
      router.push('/admin/broker-share');
      return;
    }
    setListName(listData.name);
    setCreatedAt(listData.created_at);

    const rows = items ?? [];
    console.log('[브로커편집] items 개수:', rows.length, rows.map(r => r.property_id));
    if (rows.length === 0) {
      setProperties([]);
      setLoading(false);
      return;
    }

    const ids = rows.map(r => r.property_id);
    const { data: props, error: propsErr } = await supabase
      .from('properties')
      .select('*')
      .in('id', ids)
      .is('deleted_at', null);
    console.log('[브로커편집] properties 조회 결과:', props?.length ?? 0, '/ error:', propsErr?.message);

    const propMap = new Map<string, any>((props ?? []).map(p => [p.id, p]));
    const merged = rows.map(r => propMap.get(r.property_id)).filter(Boolean);
    console.log('[브로커편집] merged 최종:', merged.length);
    setProperties(merged);

    if (merged.length > 0) {
      const { data: imgs } = await supabase
        .from('property_images')
        .select('property_id, image_url, order_index')
        .in('property_id', merged.map(p => p.id))
        .order('order_index', { ascending: true });
      const imgMap: Record<string, string> = {};
      (imgs ?? []).forEach(img => {
        if (!imgMap[img.property_id]) imgMap[img.property_id] = img.image_url;
      });
      setPropImages(imgMap);
    }
    setLoading(false);
  };

  const handleRemove = async (propertyId: string) => {
    if (!confirm('이 매물을 리스트에서 제거할까요?')) return;
    setRemoving(propertyId);
    const { error } = await supabase
      .from('broker_share_list_items')
      .delete()
      .eq('list_id', listId)
      .eq('property_id', propertyId);
    setRemoving(null);
    if (error) { alert(`제거 실패: ${error.message}`); return; }
    setProperties(prev => prev.filter(p => p.id !== propertyId));
  };

  if (!authChecked || loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#888' }}>
        로딩 중...
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8f8f8', padding: '24px 16px 80px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <button
                type="button"
                onClick={() => router.push('/admin/broker-share')}
                style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                ← 목록
              </button>
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 4px' }}>{listName}</h1>
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
              총 <strong style={{ color: '#e2a06e' }}>{properties.length}개</strong> 매물
              {createdAt && ` · 생성일 ${fmtDate(createdAt)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/admin/broker-share/${listId}/print`)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#1a1a1a', color: '#e2a06e', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            🖨 인쇄하기
          </button>
        </div>

        {/* 매물 목록 */}
        {properties.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #eee', padding: '60px 0', textAlign: 'center', color: '#aaa', fontSize: '15px' }}>
            담긴 매물이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {properties.map(p => {
              const tx = TX_COLORS[p.transaction_type] ?? { bg: '#f5f5f5', border: '#ccc', text: '#666' };
              const isSold = p.is_sold || p.status === '거래완료';
              const isHold = p.status === '보류';
              const thumb = propImages[p.id];

              return (
                <div
                  key={p.id}
                  style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  {/* 썸네일 */}
                  <Link
                    href={`/item/view/${p.property_number}`}
                    prefetch={false}
                    style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#f0f0f0', display: 'block' }}
                  >
                    {thumb ? (
                      <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#bbb' }}>없음</div>
                    )}
                    {isSold && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                        <span style={{ color: '#e04a4a', fontSize: '9px', fontWeight: 900, letterSpacing: '0.5px', border: '1.5px solid #e04a4a', padding: '1px 4px', transform: 'rotate(-15deg)', background: 'transparent' }}>거래완료</span>
                      </div>
                    )}
                    {isHold && !isSold && (
                      <div style={{ position: 'absolute', top: '2px', right: '2px', background: '#f59e0b', color: '#fff', fontSize: '8px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', zIndex: 2 }}>보류</div>
                    )}
                  </Link>

                  {/* 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <Link
                        href={`/item/view/${p.property_number}`}
                        prefetch={false}
                        style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a', textDecoration: 'none' }}
                      >
                        {p.property_number}
                      </Link>
                      {p.property_type && (
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '3px', background: '#f5f5f5', color: '#666', border: '1px solid #e0e0e0' }}>{p.property_type}</span>
                      )}
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', background: tx.bg, border: `1px solid ${tx.border}`, color: tx.text }}>{p.transaction_type}</span>
                      {p.business_name && (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: p.business_name_public ? '#374151' : '#92400e' }}>
                          {p.business_name_public ? '🏪' : '🔒'} {p.business_name}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: '#555', marginBottom: '3px' }}>{formatAddr(p)}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '13px' }}>
                      {p.exclusive_area && (
                        <span style={{ color: '#555' }}>{p.exclusive_area}㎡ ({(parseFloat(p.exclusive_area) / 3.3058).toFixed(1)}평)</span>
                      )}
                      {p.current_floor && (
                        <span style={{ color: '#555' }}>{String(p.current_floor).trim().endsWith('층') ? p.current_floor : `${p.current_floor}층`}</span>
                      )}
                      <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{buildPriceStr(p)}</span>
                      <span style={{ color: '#e05050' }}>{p.premium ? `권리금 ${formatPrice(p.premium)}` : '무권리'}</span>
                      <span style={{ color: '#888' }}>관리비 {formatMaintenance(p.maintenance_fee)}</span>
                    </div>
                  </div>

                  {/* 제거 버튼 */}
                  <button
                    type="button"
                    disabled={removing === p.id}
                    onClick={() => handleRemove(p.id)}
                    style={{
                      flexShrink: 0,
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: '#fff',
                      color: '#e05050',
                      border: '1px solid #fca5a5',
                      borderRadius: '6px',
                      cursor: removing === p.id ? 'not-allowed' : 'pointer',
                      opacity: removing === p.id ? 0.5 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {removing === p.id ? '제거 중…' : '제거'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
