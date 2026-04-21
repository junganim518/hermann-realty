'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { combineDateTime } from '@/lib/parseTime';

const STATUSES = ['상담중', '방문예정', '방문완료', '계약진행', '계약완료', '보류'];
const INTEREST_TYPES = ['상가', '사무실', '오피스텔', '아파트', '건물', '기타'];

export default function NewCustomerPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', interest_type: '', budget: '', region: '',
    consultation_date: '', consultation_time: '',
    visit_date: '', visit_time: '',
    memo: '', status: '상담중',
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/customers/new'); return; }
      setAuthChecked(true);
    });
  }, []);

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
    };
    const { error } = await supabase.from('customers').insert(payload);
    setSaving(false);
    if (error) { alert(`저장 실패: ${error.message}`); return; }
    alert('손님 정보가 등록되었습니다.');
    router.push('/admin/customers');
  };

  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>;

  const labelSt: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' };
  const inputSt: React.CSSProperties = { width: '100%', height: '40px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff' };
  const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' };
  const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '24px', marginBottom: '20px' };
  const sectionTitle: React.CSSProperties = { fontSize: '18px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e' };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a' }}>신규 손님 등록</h1>
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
        }}>
          {saving ? '저장 중...' : '손님 등록'}
        </button>
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
