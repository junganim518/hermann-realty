'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Star, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { combineDateTime, isoToDateString, isoToTimeString } from '@/lib/parseTime';
import CustomerConditionsForm from '@/components/CustomerConditionsForm';
import { findMatches, hasConditions, type DesiredConditions, type MatchedProperty } from '@/lib/matchProperties';

const STATUSES = ['상담중', '방문예정', '방문완료', '계약진행', '계약완료', '보류'];
const INTEREST_TYPES = ['상가', '사무실', '오피스텔', '아파트', '건물', '기타'];

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params?.id as string;

  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', interest_type: '', budget: '', region: '',
    consultation_date: '', consultation_time: '',
    visit_date: '', visit_time: '',
    memo: '', status: '상담중',
  });
  const [conditions, setConditions] = useState<DesiredConditions>({});
  const [matched, setMatched] = useState<MatchedProperty[]>([]);
  const [matchedLoading, setMatchedLoading] = useState(false);
  const [propImages, setPropImages] = useState<Record<string, string>>({});
  // recommendation state: customer_id+property_id 별 별표/메모
  const [recs, setRecs] = useState<Record<string, { is_recommended: boolean; reason_memo: string }>>({});
  const [memoEditingId, setMemoEditingId] = useState<string | null>(null);
  const [memoDraft, setMemoDraft] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(`/login?redirect=/admin/customers/${customerId}/edit`); return; }
      setAuthChecked(true);
      fetchCustomer();
    });
  }, []);

  const fetchCustomer = async () => {
    const { data } = await supabase.from('customers').select('*').eq('id', customerId).single();
    if (!data) { alert('손님 정보를 찾을 수 없습니다.'); router.push('/admin/customers'); return; }
    setForm({
      name: data.name ?? '',
      phone: data.phone ?? '',
      interest_type: data.interest_type ?? '',
      budget: data.budget ?? '',
      region: data.region ?? '',
      consultation_date: isoToDateString(data.consultation_date),
      consultation_time: isoToTimeString(data.consultation_date),
      visit_date: isoToDateString(data.visit_date),
      visit_time: isoToTimeString(data.visit_date),
      memo: data.memo ?? '',
      status: data.status ?? '상담중',
    });
    const dc: DesiredConditions = (data.desired_conditions ?? {}) as DesiredConditions;
    setConditions(dc);
    setLoading(false);
    // 조건이 있으면 매칭 실행
    if (hasConditions(dc)) await runMatching(dc);
  };

  // 매물 + 추천 기록 fetch + 매칭
  const runMatching = async (dc: DesiredConditions) => {
    setMatchedLoading(true);
    const [{ data: props }, { data: recsRows }] = await Promise.all([
      supabase.from('properties').select('*'),
      supabase.from('customer_recommendations').select('property_id, is_recommended, reason_memo').eq('customer_id', customerId),
    ]);
    const allProps = props ?? [];
    const results = findMatches(allProps, dc);
    setMatched(results);

    // 매칭된 매물의 대표 이미지 1장씩 fetch
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

    // 추천 기록 매핑
    const recMap: Record<string, { is_recommended: boolean; reason_memo: string }> = {};
    (recsRows ?? []).forEach((r: any) => {
      recMap[r.property_id] = { is_recommended: !!r.is_recommended, reason_memo: r.reason_memo ?? '' };
    });
    setRecs(recMap);

    setMatchedLoading(false);
  };

  // 별표 토글
  const toggleStar = async (propertyId: string) => {
    const cur = recs[propertyId] ?? { is_recommended: false, reason_memo: '' };
    const next = { is_recommended: !cur.is_recommended, reason_memo: cur.reason_memo };
    setRecs(prev => ({ ...prev, [propertyId]: next }));
    const { error } = await supabase.from('customer_recommendations').upsert(
      { customer_id: customerId, property_id: propertyId, is_recommended: next.is_recommended, reason_memo: next.reason_memo || null },
      { onConflict: 'customer_id,property_id' }
    );
    if (error) {
      console.warn('[추천] 별표 저장 실패:', error.message);
      // 롤백
      setRecs(prev => ({ ...prev, [propertyId]: cur }));
      alert(`별표 저장 실패: ${error.message}`);
    }
  };

  // 메모 저장
  const saveMemo = async (propertyId: string) => {
    const cur = recs[propertyId] ?? { is_recommended: false, reason_memo: '' };
    const next = { ...cur, reason_memo: memoDraft };
    setRecs(prev => ({ ...prev, [propertyId]: next }));
    setMemoEditingId(null);
    const { error } = await supabase.from('customer_recommendations').upsert(
      { customer_id: customerId, property_id: propertyId, is_recommended: cur.is_recommended, reason_memo: memoDraft || null },
      { onConflict: 'customer_id,property_id' }
    );
    if (error) {
      console.warn('[추천] 메모 저장 실패:', error.message);
      alert(`메모 저장 실패: ${error.message}`);
    }
  };

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { alert('이름을 입력해주세요.'); return; }

    const consult = combineDateTime(form.consultation_date, form.consultation_time);
    if (consult.error) { alert(`상담 시간: ${consult.error}\n예) 14:00, 오후 2시`); return; }
    const visit = combineDateTime(form.visit_date, form.visit_time);
    if (visit.error) { alert(`방문 시간: ${visit.error}\n예) 14:00, 오후 2시`); return; }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      interest_type: form.interest_type || null,
      budget: form.budget.trim() || null,
      region: form.region.trim() || null,
      consultation_date: consult.iso,
      visit_date: visit.iso,
      memo: form.memo.trim() || null,
      status: form.status,
      desired_conditions: conditions,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('customers').update(payload).eq('id', customerId);
    setSaving(false);
    if (error) { alert(`저장 실패: ${error.message}`); return; }
    alert('손님 정보가 수정되었습니다.');
    router.push('/admin/customers');
  };

  if (!authChecked || loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>;

  const labelSt: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' };
  const inputSt: React.CSSProperties = { width: '100%', height: '40px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff' };
  const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' };
  const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '24px', marginBottom: '20px' };
  const sectionTitle: React.CSSProperties = { fontSize: '18px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e' };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a' }}>손님 정보 수정</h1>
          <a href="/admin/customers" onClick={() => window.scrollTo(0, 0)} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#666', textDecoration: 'none' }}>목록으로</a>
        </div>

        {/* 기본 정보 */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>기본 정보</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelSt}>이름 *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="손님 이름" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>연락처</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010-0000-0000" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>관심 매물종류</label>
              <select value={form.interest_type} onChange={e => set('interest_type', e.target.value)} style={selectSt}>
                <option value="">선택</option>
                {INTEREST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>예산</label>
              <input value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="예: 보증금 5000/월세 100" style={inputSt} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>지역</label>
              <input value={form.region} onChange={e => set('region', e.target.value)} placeholder="예: 부천시 상동" style={inputSt} />
            </div>
          </div>
        </div>

        {/* 일정 & 상태 */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>일정 & 상태</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelSt}>상담날짜</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <input type="date" value={form.consultation_date} onChange={e => set('consultation_date', e.target.value)} style={inputSt} />
                <input type="text" value={form.consultation_time} onChange={e => set('consultation_time', e.target.value)} placeholder="예) 14:00, 오후 2시" style={inputSt} />
              </div>
            </div>
            <div>
              <label style={labelSt}>방문날짜</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <input type="date" value={form.visit_date} onChange={e => set('visit_date', e.target.value)} style={inputSt} />
                <input type="text" value={form.visit_time} onChange={e => set('visit_time', e.target.value)} placeholder="예) 14:00, 오후 2시" style={inputSt} />
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>진행상태</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <button key={s} type="button" onClick={() => set('status', s)} style={{
                    padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: form.status === s ? 700 : 400, cursor: 'pointer',
                    background: form.status === s ? '#1a1a1a' : '#fff', color: form.status === s ? '#e2a06e' : '#666',
                    border: form.status === s ? '1px solid #1a1a1a' : '1px solid #ddd',
                  }}>{s}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 원하는 매물 조건 */}
        <CustomerConditionsForm value={conditions} onChange={setConditions} defaultOpen={true} />

        {/* 메모 */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>메모</h2>
          <textarea value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="손님 관련 메모..." rows={6}
            style={{ width: '100%', border: '1px solid #ddd', borderRadius: '6px', padding: '12px', fontSize: '14px', outline: 'none', resize: 'vertical', background: '#fff' }} />
        </div>

        {/* 저장 버튼 */}
        <button onClick={handleSave} disabled={saving} style={{
          width: '100%', height: '50px', background: saving ? '#ccc' : '#e2a06e', color: '#fff',
          fontSize: '16px', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer',
          marginBottom: '24px',
        }}>
          {saving ? '저장 중...' : '수정 저장'}
        </button>

        {/* 🎯 맞춤 매물 (저장 후 매칭 결과) */}
        <div style={sectionSt}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #e2a06e' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a1a' }}>🎯 맞춤 매물</h2>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>
              {hasConditions(conditions) ? `매칭 ${matched.length}개 (50% 이상)` : '조건 미입력'}
            </span>
          </div>
          {!hasConditions(conditions) ? (
            <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
              "원하는 매물 조건"을 입력 후 <strong>저장</strong>하면 매칭 매물이 표시됩니다.
            </p>
          ) : matchedLoading ? (
            <p style={{ color: '#aaa', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>매칭 중...</p>
          ) : matched.length === 0 ? (
            <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
              조건에 맞는 매물이 없습니다. 조건을 조정해보세요.
            </p>
          ) : (
            <div className="matched-grid" style={{ display: 'grid', gap: '12px' }}>
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
                return (
                  <div key={p.id} style={{ display: 'flex', gap: '10px', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px', background: '#fff', position: 'relative' }}>
                    {/* 썸네일 */}
                    <a href={`/item/view/${p.property_number}`} target="_blank" rel="noreferrer" style={{ width: '90px', height: '90px', flexShrink: 0, borderRadius: '4px', overflow: 'hidden', background: '#f0f0f0', display: 'block' }}>
                      {img ? (
                        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#bbb' }}>없음</div>
                      )}
                    </a>
                    {/* 정보 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>{p.property_number}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px', background: score >= 80 ? '#dcfce7' : score >= 65 ? '#fef9c3' : '#fed7aa', color: score >= 80 ? '#166534' : score >= 65 ? '#854d0e' : '#9a3412' }}>
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
                      {/* 메모 인라인 편집 */}
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
                    {/* 별표 + 메모 버튼 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => toggleStar(p.id)}
                        title={rec.is_recommended ? '추천 해제' : '추천하기'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      >
                        <Star size={20} fill={rec.is_recommended ? '#facc15' : 'none'} color={rec.is_recommended ? '#facc15' : '#bbb'} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMemoEditingId(p.id); setMemoDraft(rec.reason_memo ?? ''); }}
                        title="추천 메모"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      >
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
          main { padding: 12px 8px !important; }
          main h1 { font-size: 22px !important; }
          .admin-section { padding: 16px !important; }
          .admin-section h2 { font-size: 16px !important; }
          main > div > div > div { grid-template-columns: 1fr !important; }
        }
      ` }} />
    </main>
  );
}
