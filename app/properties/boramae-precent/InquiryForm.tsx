'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const inSt: React.CSSProperties = {
  width: '100%', height: '44px', border: '1px solid #ddd', borderRadius: '6px',
  padding: '0 14px', fontSize: '15px', outline: 'none', background: '#fff',
  color: '#333', boxSizing: 'border-box',
};
const labelSt: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#444', marginBottom: '6px' };

export default function InquiryForm() {
  const [businessType, setBusinessType] = useState('');
  const [area, setArea] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [memo, setMemo] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { alert('개인정보 수집 및 이용에 동의해주세요.'); return; }
    if (!name.trim() || !phone.trim()) { alert('이름과 연락처는 필수입니다.'); return; }

    setSubmitting(true);
    const message = [
      '[보라매역 프리센트 임대 문의]',
      businessType.trim() ? `희망 업종: ${businessType.trim()}` : '',
      area ? `희망 면적: ${area}평` : '',
      memo ? `추가 문의: ${memo}` : '',
    ].filter(Boolean).join('\n');

    const { error } = await supabase.from('inquiries').insert({
      inquiry_type: '임차 의뢰',
      name: name.trim(),
      phone: phone.trim(),
      property_type: '상가',
      transaction_type: '월세',
      message,
    });

    if (error) { alert(`제출 실패: ${error.message}`); setSubmitting(false); return; }
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
        <p style={{ fontSize: '20px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 8px' }}>문의가 접수됐습니다</p>
        <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>헤르만부동산에서 곧 연락드리겠습니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={labelSt}>희망 업종</label>
        <input type="text" value={businessType} onChange={e => setBusinessType(e.target.value)} placeholder="예: 카페, 학원, 병원" style={inSt} />
      </div>
      <div>
        <label style={labelSt}>희망 면적 (평)</label>
        <input type="text" value={area} onChange={e => setArea(e.target.value)} placeholder="예: 10~15평" style={inSt} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={labelSt}>이름 *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" required style={inSt} />
        </div>
        <div>
          <label style={labelSt}>연락처 *</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" required style={inSt} />
        </div>
      </div>
      <div>
        <label style={labelSt}>추가 문의사항</label>
        <textarea
          value={memo} onChange={e => setMemo(e.target.value)}
          placeholder="업종, 원하는 조건 등 자유롭게 남겨주세요"
          rows={3}
          style={{ ...inSt, height: 'auto', padding: '10px 14px', resize: 'vertical' }}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#555' }}>
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: '2px', flexShrink: 0 }} />
        개인정보(이름·연락처)를 임대 상담 목적으로 수집·이용함에 동의합니다.
      </label>
      <button
        type="submit"
        disabled={submitting}
        style={{ height: '52px', background: '#c47c30', color: '#fff', fontWeight: 800, fontSize: '16px', border: 'none', borderRadius: '6px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
      >
        {submitting ? '제출 중...' : '임대 문의 접수하기'}
      </button>
    </form>
  );
}
