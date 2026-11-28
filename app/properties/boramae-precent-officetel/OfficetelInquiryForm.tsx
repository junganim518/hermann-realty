'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const inSt: React.CSSProperties = {
  width: '100%', height: '52px', border: '1px solid #E7DAC4', borderRadius: '10px',
  padding: '0 16px', fontSize: '16px', outline: 'none', background: '#fff',
  color: '#3A2F26', boxSizing: 'border-box',
};
const labelSt: React.CSSProperties = { display: 'block', fontSize: '15px', fontWeight: 600, color: '#3A2F26', marginBottom: '8px' };

const INTEREST_OPTIONS = ['실거주', '투자', '기타'];

export default function OfficetelInquiryForm() {
  const [interest, setInterest] = useState('');
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
      '[오피스텔 특별분양]',
      interest ? `관심 구분: ${interest}` : '',
      memo.trim() ? `문의 내용: ${memo.trim()}` : '',
    ].filter(Boolean).join('\n');

    const { error } = await supabase.from('inquiries').insert({
      inquiry_type: '분양 문의',
      name: name.trim(),
      phone: phone.trim(),
      property_type: '오피스텔',
      transaction_type: '분양',
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
        <p style={{ fontSize: '20px', fontWeight: 800, color: '#3A2F26', margin: '0 0 8px' }}>문의가 접수됐습니다</p>
        <p style={{ fontSize: '15px', color: '#7A6B5B', margin: 0 }}>헤르만부동산에서 곧 연락드리겠습니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={labelSt}>관심 구분</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {INTEREST_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setInterest(prev => prev === opt ? '' : opt)}
              style={{
                flex: 1, height: '52px', borderRadius: '10px', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                border: interest === opt ? '1px solid #B8873B' : '1px solid #E7DAC4',
                background: interest === opt ? '#FBF2E3' : '#fff',
                color: interest === opt ? '#8a6425' : '#7A6B5B',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
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
        <label style={labelSt}>문의 내용</label>
        <textarea
          value={memo} onChange={e => setMemo(e.target.value)}
          placeholder="궁금하신 점을 자유롭게 남겨주세요"
          rows={3}
          style={{ ...inSt, height: 'auto', padding: '14px 16px', resize: 'vertical' }}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '15px', color: '#7A6B5B' }}>
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: '3px', flexShrink: 0, width: '18px', height: '18px' }} />
        개인정보(이름·연락처)를 분양 상담 목적으로 수집·이용함에 동의합니다.
      </label>
      <button
        type="submit"
        disabled={submitting}
        style={{ height: '56px', background: '#c47c30', color: '#fff', fontWeight: 800, fontSize: '17px', border: 'none', borderRadius: '10px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
      >
        {submitting ? '제출 중...' : '분양 문의 접수하기'}
      </button>
    </form>
  );
}
