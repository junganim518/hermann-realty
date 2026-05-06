'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, MessageSquare, Pencil, Trash2, Plus, X, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { findMatches, hasConditions, type DesiredConditions, type MatchedProperty } from '@/lib/matchProperties';
import ThemeBadges from '@/components/ThemeBadges';
import PropertyCard from '@/components/PropertyCard';

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

  // 픽 매물 (사장님이 직접 선택한 매물 — customer_recommendations.is_recommended=true)
  const [picked, setPicked] = useState<any[]>([]);
  const [pickedImages, setPickedImages] = useState<Record<string, string>>({});
  const [pickEditingId, setPickEditingId] = useState<string | null>(null);
  const [pickMemoDraft, setPickMemoDraft] = useState('');

  // 매물 추가 모달
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('전체');
  const [filterTx, setFilterTx] = useState('전체');
  const [includeSold, setIncludeSold] = useState(false);
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addMemos, setAddMemos] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(`/login?redirect=/admin/customers/${customerId}`); return; }
      setAuthChecked(true);
      fetchAll();
    });
  }, []);

  // 모달 열릴 때 body 스크롤 잠금 (배경 페이지가 스크롤되지 않게)
  useEffect(() => {
    if (addModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [addModalOpen]);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').eq('id', customerId).single();
    if (!data) { alert('손님 정보를 찾을 수 없습니다.'); router.push('/admin/customers'); return; }
    setCustomer(data);
    setLoading(false);
    setMatchedLoading(true);

    // 모든 매물 + 손님 추천 정보를 한 번에 로드 (맞춤 매칭, 픽 매물, 모달 검색이 공통 사용)
    const [{ data: props }, { data: recsRows }] = await Promise.all([
      supabase.from('properties').select('*'),
      supabase.from('customer_recommendations').select('property_id, is_recommended, reason_memo').eq('customer_id', customerId),
    ]);
    const propsList = props ?? [];
    setAllProperties(propsList);

    const recMap: Record<string, { is_recommended: boolean; reason_memo: string }> = {};
    (recsRows ?? []).forEach((r: any) => {
      recMap[r.property_id] = { is_recommended: !!r.is_recommended, reason_memo: r.reason_memo ?? '' };
    });
    setRecs(recMap);

    // 픽 매물: is_recommended=true 인 추천 row와 매물 join
    const pickedIds = (recsRows ?? []).filter((r: any) => r.is_recommended).map((r: any) => r.property_id);
    const pickedList = propsList.filter(p => pickedIds.includes(p.id));
    setPicked(pickedList);

    // 픽 + 맞춤 매물 모두에 사용할 이미지 조회
    const dc: DesiredConditions = (data.desired_conditions ?? {}) as DesiredConditions;
    let allRelevantIds = [...pickedIds];
    if (hasConditions(dc)) {
      const matchResults = findMatches(propsList, dc);
      setMatched(matchResults);
      allRelevantIds = Array.from(new Set([...allRelevantIds, ...matchResults.map(m => m.property.id)]));
    }
    if (allRelevantIds.length > 0) {
      const { data: imgs } = await supabase
        .from('property_images')
        .select('property_id, image_url, order_index')
        .in('property_id', allRelevantIds)
        .order('order_index', { ascending: true });
      const imgMap: Record<string, string> = {};
      (imgs ?? []).forEach(img => { if (!imgMap[img.property_id]) imgMap[img.property_id] = img.image_url; });
      setPropImages(imgMap);
      setPickedImages(imgMap);
    }
    setMatchedLoading(false);
  };

  // 픽 매물 추가 (선택한 매물들을 customer_recommendations에 upsert)
  const addPicks = async () => {
    if (selectedIds.size === 0) return;
    setAdding(true);
    const rows = Array.from(selectedIds).map(propertyId => ({
      customer_id: customerId,
      property_id: propertyId,
      is_recommended: true,
      reason_memo: addMemos[propertyId]?.trim() || null,
    }));
    const { error } = await supabase
      .from('customer_recommendations')
      .upsert(rows, { onConflict: 'customer_id,property_id' });
    setAdding(false);
    if (error) { alert(`추가 실패: ${error.message}`); return; }

    // 로컬 state 갱신
    const newRecs = { ...recs };
    rows.forEach(r => {
      newRecs[r.property_id] = { is_recommended: true, reason_memo: r.reason_memo ?? '' };
    });
    setRecs(newRecs);
    const newPicked = [...picked];
    Array.from(selectedIds).forEach(pid => {
      if (!newPicked.find(p => p.id === pid)) {
        const prop = allProperties.find(p => p.id === pid);
        if (prop) newPicked.push(prop);
      }
    });
    setPicked(newPicked);

    // 추가된 매물 이미지 보충
    const missingIds = Array.from(selectedIds).filter(pid => !pickedImages[pid]);
    if (missingIds.length > 0) {
      const { data: imgs } = await supabase
        .from('property_images')
        .select('property_id, image_url, order_index')
        .in('property_id', missingIds)
        .order('order_index', { ascending: true });
      const additions: Record<string, string> = {};
      (imgs ?? []).forEach(img => { if (!additions[img.property_id]) additions[img.property_id] = img.image_url; });
      setPickedImages(prev => ({ ...prev, ...additions }));
      setPropImages(prev => ({ ...prev, ...additions }));
    }

    // 모달 닫고 초기화
    setAddModalOpen(false);
    setSelectedIds(new Set());
    setAddMemos({});
    setSearchQuery('');
  };

  // 픽 매물 제거 (is_recommended=false 로 set, 메모는 유지)
  const removePick = async (propertyId: string) => {
    if (!confirm('이 매물을 픽에서 제거하시겠습니까?')) return;
    const cur = recs[propertyId] ?? { is_recommended: true, reason_memo: '' };
    const { error } = await supabase.from('customer_recommendations').upsert(
      { customer_id: customerId, property_id: propertyId, is_recommended: false, reason_memo: cur.reason_memo || null },
      { onConflict: 'customer_id,property_id' }
    );
    if (error) { alert(`제거 실패: ${error.message}`); return; }
    setRecs(prev => ({ ...prev, [propertyId]: { ...cur, is_recommended: false } }));
    setPicked(prev => prev.filter(p => p.id !== propertyId));
  };

  // 픽 매물 메모 저장
  const savePickMemo = async (propertyId: string) => {
    const cur = recs[propertyId] ?? { is_recommended: true, reason_memo: '' };
    setRecs(prev => ({ ...prev, [propertyId]: { ...cur, reason_memo: pickMemoDraft } }));
    setPickEditingId(null);
    const { error } = await supabase.from('customer_recommendations').upsert(
      { customer_id: customerId, property_id: propertyId, is_recommended: true, reason_memo: pickMemoDraft || null },
      { onConflict: 'customer_id,property_id' }
    );
    if (error) alert(`메모 저장 실패: ${error.message}`);
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
            <button
              onClick={() => {
                if (window.history.length > 1) router.back();
                else router.push('/admin/customers');
              }}
              style={{ color: '#888', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >← 손님 목록</button>
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

        {/* ⭐ 픽 매물 (사장님이 직접 선택한 매물) */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>
            <span>⭐ 픽 매물 <span style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>({picked.length}개)</span></span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={14} /> 매물 추가
              </button>
              <button
                type="button"
                onClick={() => router.push(`/admin/customers/${customerId}/print`)}
                disabled={picked.length === 0}
                title={picked.length === 0 ? '픽한 매물이 없습니다' : '픽 매물 리스트를 가로 표로 인쇄'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '6px 12px',
                  background: '#fff',
                  color: picked.length === 0 ? '#bbb' : '#1a1a1a',
                  border: `1px solid ${picked.length === 0 ? '#ddd' : '#1a1a1a'}`,
                  borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                  cursor: picked.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <Printer size={14} /> 리스트 인쇄
              </button>
            </div>
          </h2>
          {picked.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>아직 픽한 매물이 없습니다</p>
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={16} /> 매물 추가하기
              </button>
            </div>
          ) : (
            <div className="pick-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {picked.map(p => {
                const memo = recs[p.id]?.reason_memo ?? '';
                const isEditing = pickEditingId === p.id;
                const propWithImage = { ...p, image: pickedImages[p.id] };
                return (
                  <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <PropertyCard property={propWithImage} isAdmin showNewBadge={false} />
                    <div style={{ padding: '8px 10px', background: '#fff8f2', borderRadius: '6px', border: '1px solid #f3d4b8' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input
                            value={pickMemoDraft}
                            onChange={e => setPickMemoDraft(e.target.value)}
                            placeholder="추천 이유"
                            autoFocus
                            style={{ flex: 1, height: '28px', fontSize: '12px', padding: '0 8px', border: '1px solid #ddd', borderRadius: '4px', outline: 'none' }}
                          />
                          <button type="button" onClick={() => savePickMemo(p.id)} style={{ fontSize: '11px', padding: '0 10px', background: '#1a1a1a', color: '#e2a06e', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
                          <button type="button" onClick={() => setPickEditingId(null)} style={{ fontSize: '11px', padding: '0 10px', background: '#fff', color: '#888', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <p style={{ flex: 1, fontSize: '12px', color: memo ? '#1a1a1a' : '#aaa', margin: 0, fontStyle: memo ? 'normal' : 'italic', lineHeight: 1.5, minHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={memo}>
                            {memo ? `📌 ${memo}` : '추천 이유 없음 (편집)'}
                          </p>
                          <button
                            type="button"
                            onClick={() => { setPickEditingId(p.id); setPickMemoDraft(memo); }}
                            title="메모 수정"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#e2a06e' }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removePick(p.id)}
                            title="픽에서 제거"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#e05050' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
              {(dc.desired_themes?.length ?? 0) > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={labelTextSt}>원하는 테마</div>
                  <ThemeBadges themeType={dc.desired_themes!} variant="detail" />
                </div>
              )}
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
                      <ThemeBadges themeType={(p as any).theme_type} variant="card" />
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
          .pick-grid { grid-template-columns: 1fr !important; }
        }
      ` }} />

      {/* ⭐ 픽 매물 추가 모달 */}
      {addModalOpen && (() => {
        const q = searchQuery.trim().toLowerCase();
        const filteredResults = allProperties.filter(p => {
          if (!includeSold && p.is_sold) return false;
          if (filterType !== '전체' && p.property_type !== filterType) return false;
          if (filterTx !== '전체' && p.transaction_type !== filterTx) return false;
          if (q) {
            const hay = `${p.property_number ?? ''} ${p.address ?? ''} ${p.title ?? ''} ${p.theme_type ?? ''} ${p.building_name ?? ''} ${p.business_name ?? ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        }).slice(0, 80);

        const toggleSelect = (pid: string) => {
          setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(pid)) next.delete(pid);
            else next.add(pid);
            return next;
          });
        };

        return (
          <div
            onClick={() => setAddModalOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px', overflow: 'auto' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '760px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: 'auto' }}
            >
              {/* 헤더 */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                  매물 추가 <span style={{ fontSize: '13px', fontWeight: 500, color: '#888' }}>({selectedIds.size}개 선택)</span>
                </h3>
                <button type="button" onClick={() => setAddModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#666' }}>
                  <X size={20} />
                </button>
              </div>

              {/* 검색/필터 */}
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="매물번호 / 주소 / 건물명 / 키워드"
                  style={{ height: '36px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ height: '32px', padding: '0 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    {['전체', '상가', '사무실', '오피스텔', '아파트', '건물', '기타'].map(t => <option key={t} value={t}>{t === '전체' ? '매물종류 전체' : t}</option>)}
                  </select>
                  <select value={filterTx} onChange={e => setFilterTx(e.target.value)} style={{ height: '32px', padding: '0 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    {['전체', '월세', '전세', '매매'].map(t => <option key={t} value={t}>{t === '전체' ? '거래유형 전체' : t}</option>)}
                  </select>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#555', cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeSold} onChange={e => setIncludeSold(e.target.checked)} />
                    거래완료 포함
                  </label>
                  <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#888' }}>
                    {filteredResults.length === 80 ? '80개 (이상 일부)' : `${filteredResults.length}개`}
                  </span>
                </div>
              </div>

              {/* 결과 */}
              <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
                {filteredResults.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '40px 0', color: '#aaa', fontSize: '13px' }}>일치하는 매물이 없습니다</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {filteredResults.map(p => {
                      const isSelected = selectedIds.has(p.id);
                      const isAlreadyPicked = !!recs[p.id]?.is_recommended;
                      const priceStr = (() => {
                        if (p.transaction_type === '매매') {
                          const v = p.sale_price || p.deposit;
                          return v ? `매매 ${(v).toLocaleString()}` : '-';
                        }
                        const parts: string[] = [];
                        if (p.deposit) parts.push(`보 ${(p.deposit).toLocaleString()}`);
                        if (p.monthly_rent) parts.push(`월 ${(p.monthly_rent).toLocaleString()}`);
                        return parts.length ? parts.join('/') : '-';
                      })();
                      return (
                        <div
                          key={p.id}
                          onClick={() => !isAlreadyPicked && toggleSelect(p.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '8px 10px', borderRadius: '6px',
                            background: isAlreadyPicked ? '#f5f5f5' : isSelected ? '#fff8f2' : '#fff',
                            border: `1px solid ${isAlreadyPicked ? '#e5e5e5' : isSelected ? '#e2a06e' : '#eee'}`,
                            cursor: isAlreadyPicked ? 'not-allowed' : 'pointer',
                            opacity: isAlreadyPicked ? 0.55 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isAlreadyPicked}
                            onChange={() => !isAlreadyPicked && toggleSelect(p.id)}
                            onClick={e => e.stopPropagation()}
                            style={{ width: '16px', height: '16px', accentColor: '#e2a06e', cursor: isAlreadyPicked ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700 }}>{p.property_number}</span>
                              {p.transaction_type && <span style={{ fontSize: '10px', color: '#e2a06e', fontWeight: 700 }}>{p.transaction_type}</span>}
                              {p.property_type && <span style={{ fontSize: '10px', color: '#666', padding: '1px 5px', background: '#f5f5f5', borderRadius: '3px' }}>{p.property_type}</span>}
                              <span style={{ fontSize: '11px', fontWeight: 600 }}>{priceStr}</span>
                              {p.is_sold && <span style={{ fontSize: '10px', color: '#e05050', fontWeight: 700 }}>거래완료</span>}
                              {isAlreadyPicked && <span style={{ fontSize: '10px', color: '#888', fontWeight: 700, padding: '1px 5px', background: '#f0f0f0', borderRadius: '3px' }}>이미 추가됨</span>}
                            </div>
                            <p style={{ fontSize: '11px', color: '#666', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.address ?? '-'}
                              {p.building_name && <span style={{ color: '#e2a06e', marginLeft: '4px' }}>{p.building_name}</span>}
                            </p>
                            {isSelected && (
                              <input
                                value={addMemos[p.id] ?? ''}
                                onChange={e => setAddMemos(prev => ({ ...prev, [p.id]: e.target.value }))}
                                onClick={e => e.stopPropagation()}
                                placeholder="추천 이유 (선택)"
                                style={{ marginTop: '4px', width: '100%', height: '26px', fontSize: '11px', padding: '0 8px', border: '1px solid #e2a06e', borderRadius: '4px', outline: 'none', background: '#fff' }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 푸터 */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => { setAddModalOpen(false); setSelectedIds(new Set()); setAddMemos({}); }}
                  style={{ padding: '8px 14px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >취소</button>
                <button
                  type="button"
                  onClick={addPicks}
                  disabled={selectedIds.size === 0 || adding}
                  style={{
                    padding: '8px 18px',
                    background: selectedIds.size === 0 || adding ? '#ccc' : '#e2a06e',
                    color: '#fff', border: 'none', borderRadius: '6px',
                    fontSize: '13px', fontWeight: 700,
                    cursor: selectedIds.size === 0 || adding ? 'not-allowed' : 'pointer',
                  }}
                >{adding ? '추가 중...' : `${selectedIds.size}개 추가`}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
