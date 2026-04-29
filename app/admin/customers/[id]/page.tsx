'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { findMatches, hasConditions, type DesiredConditions, type MatchedProperty } from '@/lib/matchProperties';

const STATUS_COLORS: Record<string, string> = {
  '상담중': '#2196F3', '방문예정': '#e2a06e', '방문완료': '#4caf50',
  '계약진행': '#ff9800', '계약완료': '#9c27b0', '보류': '#999',
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return '-'; }
};

const labelTextSt: React.CSSProperties = { fontSize: '12px', color: '#888', fontWeight: 500, marginBottom: '2px' };
const valueTextSt: React.CSSProperties = { fontSize: '14px', color: '#1a1a1a', fontWeight: 500 };
const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', marginBottom: '16px' };
const sectionTitleSt: React.CSSProperties = { fontSize: '17px', fontWeight: 700, color: '#1a1a1a', marginBottom: '14px', paddingBottom: '8px', borderBottom: '2px solid #e2a06e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params?.id as string;

  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [matched, setMatched] = useState<MatchedProperty[]>([]);
  const [matchedLoading, setMatchedLoading] = useState(false);
  const [propImages, setPropImages] = useState<Record<string, string>>({});
  const [recs, setRecs] = useState<Record<string, { is_recommended: boolean; reason_memo: string }>>({});
  const [memoEditingId, setMemoEditingId] = useState<string | null>(null);
  const [memoDraft, setMemoDraft] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(`/login?redirect=/admin/customers/${customerId}`); return; }
      setAuthChecked(true);
      fetchAll();
    });
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').eq('id', customerId).single();
    if (!data) { alert('손님 정보를 찾을 수 없습니다.'); router.push('/admin/customers'); return; }
    setCustomer(data);
    setLoading(false);

    const dc: DesiredConditions = (data.desired_conditions ?? {}) as DesiredConditions;
    if (hasConditions(dc)) await runMatching(dc);
  };

  const runMatching = async (dc: DesiredConditions) => {
    setMatchedLoading(true);
    const [{ data: props }, { data: recsRows }] = await Promise.all([
      supabase.from('properties').select('*'),
      supabase.from('customer_recommendations').select('property_id, is_recommended, reason_memo').eq('customer_id', customerId),
    ]);
    const allProps = props ?? [];
    const results = findMatches(allProps, dc);
    setMatched(results);

    if (results.length > 0) {
      const ids = results.map(m => m.property.id);
      const { data: imgs } = await supabase
        .from('property_images')
        .select('property_id, image_url, order_index')
        .in('property_id', ids)
        .order('order_index', { ascending: true });
      const imgMap: Record<string, string> = {};
      (imgs ?? []).forEach(img => { if (!imgMap[img.property_id]) imgMap[img.property_id] = img.image_url; });
      setPropImages(imgMap);
    }

    const recMap: Record<string, { is_recommended: boolean; reason_memo: string }> = {};
    (recsRows ?? []).forEach((r: any) => {
      recMap[r.property_id] = { is_recommended: !!r.is_recommended, reason_memo: r.reason_memo ?? '' };
    });
    setRecs(recMap);
    setMatchedLoading(false);
  };

  const toggleStar = async (propertyId: string) => {
    const cur = recs[propertyId] ?? { is_recommended: false, reason_memo: '' };
    const next = { is_recommended: !cur.is_recommended, reason_memo: cur.reason_memo };
    setRecs(prev => ({ ...prev, [propertyId]: next }));
    const { error } = await supabase.from('customer_recommendations').upsert(
      { customer_id: customerId, property_id: propertyId, is_recommended: next.is_recommended, reason_memo: next.reason_memo || null },
      { onConflict: 'customer_id,property_id' }
    );
    if (error) {
      setRecs(prev => ({ ...prev, [propertyId]: cur }));
      alert(`별표 저장 실패: ${error.message}`);
    }
  };

  const saveMemo = async (propertyId: string) => {
    const cur = recs[propertyId] ?? { is_recommended: false, reason_memo: '' };
    setRecs(prev => ({ ...prev, [propertyId]: { ...cur, reason_memo: memoDraft } }));
    setMemoEditingId(null);
    const { error } = await supabase.from('customer_recommendations').upsert(
      { customer_id: customerId, property_id: propertyId, is_recommended: cur.is_recommended, reason_memo: memoDraft || null },
      { onConflict: 'customer_id,property_id' }
    );
    if (error) alert(`메모 저장 실패: ${error.message}`);
  };

  const handleDelete = async () => {
    if (!confirm(`${customer?.name ?? '손님'} 정보를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('customers').delete().eq('id', customerId);
    if (error) { alert(`삭제 실패: ${error.message}`); return; }
    alert('삭제되었습니다.');
    router.push('/admin/customers');
  };

  if (!authChecked || loading || !customer) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>;
  }

  const dc: DesiredConditions = (customer.desired_conditions ?? {}) as DesiredConditions;
  const conditionsExist = hasConditions(dc);
  const statusColor = STATUS_COLORS[customer.status] ?? '#999';

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px 16px 60px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Link href="/admin/customers" style={{ color: '#888', fontSize: '13px', textDecoration: 'none' }}>← 손님 목록</Link>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{customer.name}</h1>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', border: `1px solid ${statusColor}`, background: statusColor + '18', color: statusColor }}>
              {customer.status ?? '상담중'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href={`/admin/customers/${customerId}/edit`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 14px', background: '#1a1a1a', color: '#e2a06e', borderRadius: '6px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              <Pencil size={14} /> 정보 수정
            </Link>
            <button onClick={handleDelete} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 14px', background: '#fff', color: '#e05050', border: '1px solid #e05050', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        </div>

        {/* 기본 정보 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}><span>👤 기본 정보</span></h2>
          <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
            <div><div style={labelTextSt}>연락처</div><div style={valueTextSt}>{customer.phone || '-'}</div></div>
            <div><div style={labelTextSt}>관심 매물종류</div><div style={valueTextSt}>{customer.interest_type || '-'}</div></div>
            <div><div style={labelTextSt}>예산</div><div style={valueTextSt}>{customer.budget || '-'}</div></div>
            <div><div style={labelTextSt}>지역</div><div style={valueTextSt}>{customer.region || '-'}</div></div>
            <div><div style={labelTextSt}>상담일</div><div style={valueTextSt}>{fmtDate(customer.consultation_date)}</div></div>
            <div><div style={labelTextSt}>방문일</div><div style={valueTextSt}>{fmtDate(customer.visit_date)}</div></div>
          </div>
          {customer.memo && (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #f0f0f0' }}>
              <div style={labelTextSt}>메모</div>
              <p style={{ fontSize: '13px', color: '#333', whiteSpace: 'pre-line', lineHeight: 1.6, margin: '4px 0 0' }}>{customer.memo}</p>
            </div>
          )}
        </div>

        {/* 원하는 조건 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>
            <span>🎯 원하는 매물 조건</span>
            <Link href={`/admin/customers/${customerId}/edit`} style={{ fontSize: '12px', color: '#e2a06e', textDecoration: 'none', fontWeight: 600 }}>편집 →</Link>
          </h2>
          {!conditionsExist ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>조건이 설정되지 않았습니다</p>
              <Link href={`/admin/customers/${customerId}/edit`} style={{ display: 'inline-block', padding: '8px 18px', background: '#e2a06e', color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
                조건 설정하기
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {(dc.property_types?.length ?? 0) > 0 && (<div><div style={labelTextSt}>매물종류</div><div style={valueTextSt}>{dc.property_types!.join(', ')}</div></div>)}
              {(dc.transaction_types?.length ?? 0) > 0 && (<div><div style={labelTextSt}>거래유형</div><div style={valueTextSt}>{dc.transaction_types!.join(', ')}</div></div>)}
              {(dc.deposit_min != null || dc.deposit_max != null) && (<div><div style={labelTextSt}>보증금 (만원)</div><div style={valueTextSt}>{dc.deposit_min ?? '∞'} ~ {dc.deposit_max ?? '∞'}</div></div>)}
              {(dc.monthly_rent_min != null || dc.monthly_rent_max != null) && (<div><div style={labelTextSt}>월세 (만원)</div><div style={valueTextSt}>{dc.monthly_rent_min ?? '∞'} ~ {dc.monthly_rent_max ?? '∞'}</div></div>)}
              {(dc.sale_price_min != null || dc.sale_price_max != null) && (<div><div style={labelTextSt}>매매가 (만원)</div><div style={valueTextSt}>{dc.sale_price_min ?? '∞'} ~ {dc.sale_price_max ?? '∞'}</div></div>)}
              {(dc.area_min != null || dc.area_max != null) && (<div><div style={labelTextSt}>면적 (평)</div><div style={valueTextSt}>{dc.area_min ?? '∞'} ~ {dc.area_max ?? '∞'}</div></div>)}
              {(dc.floor_min != null || dc.floor_max != null) && (<div><div style={labelTextSt}>층수</div><div style={valueTextSt}>{dc.floor_min ?? '∞'} ~ {dc.floor_max ?? '∞'}</div></div>)}
              {dc.region && dc.region.trim() && (<div><div style={labelTextSt}>지역</div><div style={valueTextSt}>{dc.region}</div></div>)}
              {dc.no_premium && (<div><div style={labelTextSt}>특이사항</div><div style={valueTextSt}>무권리 원함</div></div>)}
              {dc.additional_memo && dc.additional_memo.trim() && (<div style={{ gridColumn: '1 / -1' }}><div style={labelTextSt}>추가 메모</div><div style={valueTextSt}>{dc.additional_memo}</div></div>)}
            </div>
          )}
        </div>

        {/* 맞춤 매물 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>
            <span>🎯 맞춤 매물</span>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>
              {conditionsExist ? `매칭 ${matched.length}개 (50% 이상)` : '조건 미입력'}
            </span>
          </h2>
          {!conditionsExist ? (
            <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              조건을 설정하면 맞춤 매물이 표시됩니다.
            </p>
          ) : matchedLoading ? (
            <p style={{ color: '#aaa', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>매칭 중...</p>
          ) : matched.length === 0 ? (
            <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              조건에 맞는 매물이 없습니다. 조건을 조정해보세요.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {matched.map(({ property: p, score }) => {
                const rec = recs[p.id] ?? { is_recommended: false, reason_memo: '' };
                const img = propImages[p.id];
                const priceStr = (() => {
                  if (p.transaction_type === '매매') {
                    const v = p.sale_price || p.deposit;
                    return v ? `매매가 ${(v).toLocaleString()}만원` : '-';
                  }
                  const parts: string[] = [];
                  if (p.deposit) parts.push(`보증 ${(p.deposit).toLocaleString()}`);
                  if (p.monthly_rent) parts.push(`월 ${(p.monthly_rent).toLocaleString()}`);
                  return parts.length ? parts.join(' / ') + '만원' : '-';
                })();
                const sqm = parseFloat(p.exclusive_area || '0');
                const pyeong = sqm > 0 ? (sqm / 3.3058).toFixed(1) : null;
                const isMemoEditing = memoEditingId === p.id;
                const scoreColors = score >= 80 ? { bg: '#dcfce7', color: '#166534' } : score >= 65 ? { bg: '#fef9c3', color: '#854d0e' } : { bg: '#fed7aa', color: '#9a3412' };
                return (
                  <div key={p.id} className="match-card" style={{ display: 'flex', gap: '10px', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px', background: '#fff' }}>
                    <a href={`/item/view/${p.property_number}`} target="_blank" rel="noreferrer" style={{ width: '90px', height: '90px', flexShrink: 0, borderRadius: '4px', overflow: 'hidden', background: '#f0f0f0', display: 'block' }}>
                      {img ? (
                        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#bbb' }}>없음</div>
                      )}
                    </a>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>{p.property_number}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px', background: scoreColors.bg, color: scoreColors.color }}>
                          {score}% 일치
                        </span>
                        {p.property_type && <span style={{ fontSize: '10px', color: '#666', padding: '1px 6px', background: '#f5f5f5', borderRadius: '3px' }}>{p.property_type}</span>}
                        {p.transaction_type && <span style={{ fontSize: '10px', color: '#e2a06e', fontWeight: 700 }}>{p.transaction_type}</span>}
                      </div>
                      {p.title && <p style={{ fontSize: '12px', color: '#e2a06e', fontWeight: 600, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.title}>{p.title}</p>}
                      <p style={{ fontSize: '11px', color: '#666', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address ?? '-'}</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px', color: '#555' }}>
                        <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{priceStr}</span>
                        {pyeong && <span>{pyeong}평</span>}
                        {p.current_floor && <span>{p.current_floor}층</span>}
                      </div>
                      {isMemoEditing ? (
                        <div style={{ marginTop: '6px', display: 'flex', gap: '4px' }}>
                          <input
                            value={memoDraft}
                            onChange={e => setMemoDraft(e.target.value)}
                            placeholder="추천 사유 메모"
                            autoFocus
                            style={{ flex: 1, height: '28px', fontSize: '12px', padding: '0 8px', border: '1px solid #ddd', borderRadius: '4px', outline: 'none' }}
                          />
                          <button type="button" onClick={() => saveMemo(p.id)} style={{ fontSize: '11px', padding: '0 10px', background: '#1a1a1a', color: '#e2a06e', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
                          <button type="button" onClick={() => setMemoEditingId(null)} style={{ fontSize: '11px', padding: '0 10px', background: '#fff', color: '#888', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
                        </div>
                      ) : rec.reason_memo ? (
                        <p style={{ marginTop: '6px', fontSize: '11px', color: '#888', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.reason_memo}>📌 {rec.reason_memo}</p>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                      <button type="button" onClick={() => toggleStar(p.id)} title={rec.is_recommended ? '추천 해제' : '추천하기'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                        <Star size={20} fill={rec.is_recommended ? '#facc15' : 'none'} color={rec.is_recommended ? '#facc15' : '#bbb'} strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => { setMemoEditingId(p.id); setMemoDraft(rec.reason_memo ?? ''); }} title="추천 메모" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                        <MessageSquare size={18} color={rec.reason_memo ? '#e2a06e' : '#bbb'} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          main { padding: 12px 8px 60px !important; }
          main h1 { font-size: 20px !important; }
          .match-card { flex-direction: column !important; }
          .match-card > a { width: 100% !important; height: 160px !important; }
        }
      ` }} />
    </main>
  );
}
