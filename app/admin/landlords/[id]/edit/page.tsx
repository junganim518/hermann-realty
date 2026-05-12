'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function EditLandlordPage() {
  const router = useRouter();
  const params = useParams();
  const landlordId = params?.id as string;

  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '', property_address: '', business_number: '', memo: '',
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(`/login?redirect=/admin/landlords/${landlordId}/edit`); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      const { data } = await supabase.from('landlords').select('*').eq('id', landlordId).single();
      if (!data) { alert('임대인을 찾을 수 없습니다.'); router.push('/admin/landlords'); return; }
      setForm({
        name: data.name ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        address: data.address ?? '',
        property_address: data.property_address ?? '',
        business_number: data.business_number ?? '',
        memo: data.memo ?? '',
      });
      // 기존에 이메일/사업자번호 입력값이 있으면 자동으로 펼침
      if ((data.email ?? '').trim() || (data.business_number ?? '').trim()) setShowExtras(true);
      setLoading(false);
    })();
  }, [authChecked]);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { alert('이름은 필수입니다.'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      property_address: form.property_address.trim() || null,
      business_number: form.business_number.trim() || null,
      memo: form.memo.trim() || null,
    };
    const { error } = await supabase.from('landlords').update(payload).eq('id', landlordId);
    setSaving(false);
    if (error) { alert(`저장 실패: ${error.message}`); return; }
    alert('수정되었습니다.');
    if (window.history.length > 1) router.back();
    else router.push(`/admin/landlords/${landlordId}`);
  };

  if (!authChecked || loading) return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</main>;

  const labelSt: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' };
  const inputSt: React.CSSProperties = { width: '100%', height: '40px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff' };
  const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '24px', marginBottom: '20px' };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <button
          onClick={() => { if (window.history.length > 1) router.back(); else router.push(`/admin/landlords/${landlordId}`); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '12px' }}
        >
          <ArrowLeft size={14} /> 임대인 정보로 돌아가기
        </button>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', marginBottom: '20px' }}>임대인 수정</h1>

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
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>주소</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="실거주지 또는 사무실 주소" style={inputSt} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>건물/호수 (임대 건물 주소 및 호수)</label>
              <input value={form.property_address} onChange={e => set('property_address', e.target.value)} placeholder="예: 신중동역 랜드마크 푸르지오 시티 201호" style={inputSt} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>메모</label>
              <textarea value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="특이사항, 협의 내용" rows={4}
                style={{ width: '100%', border: '1px solid #ddd', borderRadius: '6px', padding: '10px 12px', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          </div>

          {/* 추가 정보 토글 (이메일 / 사업자번호) */}
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #eee' }}>
            <button
              type="button"
              onClick={() => setShowExtras(s => !s)}
              style={{ background: 'none', border: 'none', color: '#666', fontSize: '12px', cursor: 'pointer', padding: 0, fontWeight: 600 }}
            >
              {showExtras ? '▲ 추가 정보 접기' : '▼ 추가 정보 (이메일 / 사업자번호)'}
            </button>
            {showExtras && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '12px' }}>
                <div>
                  <label style={labelSt}>이메일</label>
                  <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="example@email.com" style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>사업자번호</label>
                  <input value={form.business_number} onChange={e => set('business_number', e.target.value)} placeholder="000-00-00000" style={inputSt} />
                </div>
              </div>
            )}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', height: '48px', background: saving ? '#ccc' : '#e2a06e', color: '#fff', fontSize: '15px', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '저장 중...' : '수정 저장'}
        </button>
      </div>
    </main>
  );
}
