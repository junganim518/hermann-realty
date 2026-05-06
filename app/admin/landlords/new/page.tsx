'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function NewLandlordPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '', business_number: '', memo: '',
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/landlords/new'); return; }
      setAuthChecked(true);
    });
  }, []);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { alert('이름은 필수입니다.'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      business_number: form.business_number.trim() || null,
      memo: form.memo.trim() || null,
    };
    const { data: inserted, error } = await supabase.from('landlords').insert(payload).select('id').single();
    setSaving(false);
    if (error || !inserted) { alert(`등록 실패: ${error?.message ?? '알 수 없는 오류'}`); return; }
    alert('등록되었습니다.');
    router.push(`/admin/landlords/${inserted.id}`);
  };

  if (!authChecked) return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>인증 중...</main>;

  const labelSt: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' };
  const inputSt: React.CSSProperties = { width: '100%', height: '40px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff' };
  const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '24px', marginBottom: '20px' };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <button onClick={() => router.push('/admin/landlords')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '12px' }}>
          <ArrowLeft size={14} /> 임대인 목록
        </button>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', marginBottom: '20px' }}>새 임대인 등록</h1>

        <div style={sectionSt}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelSt}>이름 *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="홍길동" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>연락처</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010-0000-0000" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>이메일</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="example@email.com" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>사업자번호</label>
              <input value={form.business_number} onChange={e => set('business_number', e.target.value)} placeholder="000-00-00000" style={inputSt} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>주소</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="실거주지 또는 사무실 주소" style={inputSt} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>메모</label>
              <textarea value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="특이사항, 협의 내용" rows={4}
                style={{ width: '100%', border: '1px solid #ddd', borderRadius: '6px', padding: '10px 12px', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', height: '48px', background: saving ? '#ccc' : '#e2a06e', color: '#fff', fontSize: '15px', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '저장 중...' : '등록'}
        </button>
      </div>
    </main>
  );
}
