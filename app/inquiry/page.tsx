'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

declare global {
  interface Window { daum: any; }
}

const INQUIRY_TYPES = [
  { id: '임대 의뢰', desc: '내 매물 임대' },
  { id: '매매 의뢰', desc: '내 매물 판매' },
  { id: '임차 의뢰', desc: '매물 구함' },
  { id: '매수 의뢰', desc: '매물 구매' },
];

const PROP_TYPES = ['상가', '사무실', '오피스텔', '아파트', '건물', '기타'];

const labelSt: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' };
const inputSt: React.CSSProperties = { width: '100%', height: '44px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 14px', fontSize: '15px', outline: 'none', background: '#fff', color: '#333', boxSizing: 'border-box' };

export default function InquiryPage() {
  const [form, setForm] = useState({
    inquiry_type: '임대 의뢰',
    name: '', phone: '', email: '',
    property_type: '', address: '',
    deposit: '', monthly_rent: '', sale_price: '',
    area: '', message: '',
  });
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (document.getElementById('daum-postcode-script')) return;
    const s = document.createElement('script');
    s.id = 'daum-postcode-script';
    s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const searchAddress = () => {
    if (!window.daum?.Postcode) { alert('주소검색 스크립트를 불러오는 중입니다.'); return; }
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        const addr = data.userSelectedType === 'J'
          ? (data.jibunAddress || data.autoJibunAddress)
          : (data.roadAddress || data.autoRoadAddress);
        set('address', addr);
      },
    }).open();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { alert('개인정보 수집 및 이용에 동의해주세요.'); return; }
    if (!form.name.trim() || !form.phone.trim()) { alert('이름과 연락처는 필수입니다.'); return; }

    setSubmitting(true);
    const { error } = await supabase.from('inquiries').insert({
      inquiry_type: form.inquiry_type,
      name: form.name,
      phone: form.phone,
      email: form.email || null,
      property_type: form.property_type || null,
      address: form.address || null,
      deposit: form.deposit ? parseInt(form.deposit) : null,
      monthly_rent: form.monthly_rent ? parseInt(form.monthly_rent) : null,
      sale_price: form.sale_price ? parseInt(form.sale_price) : null,
      area: form.area || null,
      message: form.message || null,
    });

    if (error) {
      alert(`제출 실패: ${error.message}`);
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <main style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '48px 32px', textAlign: 'center', maxWidth: '480px', width: '100%' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px' }}>의뢰가 접수되었습니다</h1>
          <p style={{ fontSize: '15px', color: '#666', marginBottom: '24px', lineHeight: 1.6 }}>
            소중한 의뢰 감사합니다.<br />
            담당자가 빠른 시일 내에 연락드리겠습니다.
          </p>
          <a href="/" style={{ display: 'inline-block', padding: '12px 32px', background: '#e2a06e', color: '#fff', fontSize: '15px', fontWeight: 700, borderRadius: '6px', textDecoration: 'none' }}>
            홈으로 이동
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '32px 16px' }}>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          .inq-container { padding: 24px 16px !important; }
          .inq-title { font-size: 22px !important; }
          .inq-subtitle { font-size: 13px !important; }
          .inq-grid { grid-template-columns: 1fr !important; }
          .inq-type-grid { grid-template-columns: 1fr 1fr !important; }
        }
      ` }} />

      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 className="inq-title" style={{ fontSize: '30px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px' }}>매물 의뢰하기</h1>
          <p className="inq-subtitle" style={{ fontSize: '15px', color: '#888' }}>헤르만부동산에 매물을 의뢰해주세요</p>
        </div>

        <form onSubmit={handleSubmit} className="inq-container" style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '32px' }}>

          {/* 의뢰 유형 */}
          <div style={{ marginBottom: '24px' }}>
            <label style={labelSt}>의뢰 유형 <span style={{ color: '#e05050' }}>*</span></label>
            <div className="inq-type-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {INQUIRY_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set('inquiry_type', t.id)}
                  style={{
                    padding: '12px 8px',
                    border: form.inquiry_type === t.id ? '2px solid #e2a06e' : '1px solid #ddd',
                    background: form.inquiry_type === t.id ? '#fff8f2' : '#fff',
                    color: form.inquiry_type === t.id ? '#e2a06e' : '#555',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: form.inquiry_type === t.id ? 700 : 500,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '14px', marginBottom: '2px' }}>{t.id}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 기본 정보 */}
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#333', marginBottom: '14px', paddingBottom: '8px', borderBottom: '2px solid #e2a06e' }}>기본 정보</h3>
          <div className="inq-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
            <div>
              <label style={labelSt}>이름 <span style={{ color: '#e05050' }}>*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="홍길동" style={inputSt} required />
            </div>
            <div>
              <label style={labelSt}>연락처 <span style={{ color: '#e05050' }}>*</span></label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010-1234-5678" style={inputSt} required />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>이메일</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="example@email.com" style={inputSt} />
            </div>
          </div>

          {/* 매물 정보 */}
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#333', marginBottom: '14px', paddingBottom: '8px', borderBottom: '2px solid #e2a06e' }}>매물 정보</h3>
          <div className="inq-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={labelSt}>매물종류</label>
              <select value={form.property_type} onChange={e => set('property_type', e.target.value)} style={{ ...inputSt, cursor: 'pointer' }}>
                <option value="">선택하세요</option>
                {PROP_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>면적</label>
              <input value={form.area} onChange={e => set('area', e.target.value)} placeholder="예: 85.5㎡ 또는 25평" style={inputSt} />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelSt}>주소</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={form.address} readOnly placeholder="주소를 검색하세요" style={{ ...inputSt, flex: 1, background: '#f9f9f9' }} />
              <button type="button" onClick={searchAddress} style={{ height: '44px', padding: '0 18px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>주소 검색</button>
            </div>
          </div>

          <div className="inq-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={labelSt}>보증금 (만원)</label>
              <input type="number" value={form.deposit} onChange={e => set('deposit', e.target.value)} placeholder="예: 5000" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>월세 (만원)</label>
              <input type="number" value={form.monthly_rent} onChange={e => set('monthly_rent', e.target.value)} placeholder="예: 200" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>매매가 (만원)</label>
              <input type="number" value={form.sale_price} onChange={e => set('sale_price', e.target.value)} placeholder="예: 100000" style={inputSt} />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={labelSt}>기타 요청사항</label>
            <textarea
              value={form.message}
              onChange={e => set('message', e.target.value)}
              placeholder="추가로 전달하고 싶은 내용을 자유롭게 작성해주세요."
              rows={5}
              style={{ width: '100%', border: '1px solid #ddd', borderRadius: '6px', padding: '12px 14px', fontSize: '15px', outline: 'none', resize: 'vertical', lineHeight: '1.7', fontFamily: 'inherit', color: '#333', background: '#fff', boxSizing: 'border-box' }}
            />
          </div>

          {/* 개인정보 동의 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '24px', padding: '14px', background: '#f8f8f8', borderRadius: '6px' }}>
            <input
              type="checkbox"
              id="agree"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#e2a06e', cursor: 'pointer', marginTop: '2px', flexShrink: 0 }}
            />
            <label htmlFor="agree" style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, cursor: 'pointer' }}>
              <strong style={{ color: '#333' }}>개인정보 수집 및 이용에 동의합니다.</strong><br />
              수집 항목: 이름, 연락처, 이메일 / 이용 목적: 매물 의뢰 응답 / 보유 기간: 의뢰 처리 완료 후 1년
            </label>
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', height: '52px',
              background: submitting ? '#ccc' : '#e2a06e',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '17px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {submitting ? '제출 중...' : '의뢰하기'}
          </button>
        </form>

      </div>
    </main>
  );
}
