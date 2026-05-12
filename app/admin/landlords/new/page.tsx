'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPhone } from '@/lib/phoneFormat';

declare global {
  interface Window { daum: any; }
}

export default function NewLandlordPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '',
    property_address: '', property_building_name: '', property_dong_ho: '',
    business_number: '', memo: '',
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/landlords/new'); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!document.getElementById('daum-postcode-script')) {
      const s = document.createElement('script');
      s.id = 'daum-postcode-script';
      s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      s.async = true;
      document.head.appendChild(s);
    }
  }, []);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const searchPropertyAddress = () => {
    if (!window.daum?.Postcode) {
      alert('주소검색 스크립트를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        const addr = data.userSelectedType === 'J'
          ? (data.jibunAddress || data.autoJibunAddress)
          : (data.roadAddress || data.autoRoadAddress);
        const buildingName = data.buildingName || '';
        setForm(prev => ({
          ...prev,
          property_address: addr,
          property_building_name: buildingName || prev.property_building_name,
        }));
      },
    }).open();
  };

  const handleSave = async () => {
    if (!form.name.trim() && !form.phone.trim()) { alert('이름 또는 전화번호를 입력해주세요.'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      property_address: form.property_address.trim() || null,
      property_building_name: form.property_building_name.trim() || null,
      property_dong_ho: form.property_dong_ho.trim() || null,
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
              <label style={labelSt}>이름</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="홍길동" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>연락처</label>
              <input value={form.phone} onChange={e => set('phone', formatPhone(e.target.value))} placeholder="010-0000-0000" style={inputSt} maxLength={13} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>주소 (임대 건물)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={form.property_address} readOnly placeholder="주소를 검색하세요" style={{ ...inputSt, flex: 1 }} />
                <button type="button" onClick={searchPropertyAddress} style={{ height: '40px', padding: '0 16px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>주소 검색</button>
              </div>
            </div>
            <div>
              <label style={labelSt}>건물명</label>
              <input value={form.property_building_name} onChange={e => set('property_building_name', e.target.value)} placeholder="예: 신중동역 랜드마크 푸르지오시티" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>동호수</label>
              <input value={form.property_dong_ho} onChange={e => set('property_dong_ho', e.target.value)} placeholder="예: 101동 711호" style={inputSt} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>주소 (실거주지/사무실)</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="실거주지 또는 사무실 주소" style={inputSt} />
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
          {saving ? '저장 중...' : '등록'}
        </button>
      </div>
    </main>
  );
}
