'use client';

export default function Footer() {
  return (
    <footer style={{ background: '#111', color: '#fff' }}>

      <style>{`
        .footer-inner { max-width: 900px; margin: 0 auto; padding: 48px 32px; }
        .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-bottom: 32px; }
        .footer-right { text-align: right; }
        .footer-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 24px; }

        @media (max-width: 768px) {
          .footer-inner { padding: 32px 20px; }
          .footer-grid { grid-template-columns: 1fr; gap: 24px; }
          .footer-right { text-align: left; }
          .footer-logo-text { font-size: 18px !important; }
          .footer-logo-img { width: 36px !important; height: 36px !important; }
          .footer-phone { font-size: 24px !important; }
          .footer-info p { font-size: 12px !important; }
          .footer-links { gap: 12px; }
          .footer-links a { font-size: 13px !important; }
        }
      `}</style>

      <div className="footer-inner">
        <div className="footer-grid">

          {/* 회사 정보 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <img className="footer-logo-img" src="/logo.png" alt="헤르만부동산 로고" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              <span className="footer-logo-text" style={{ fontSize: '20px', fontWeight: 700 }}>헤르만부동산</span>
            </div>
            <div className="footer-info" style={{ fontSize: '13px', color: '#bbb', lineHeight: 1.8 }}>
              <p>상호: 헤르만공인중개사사무소</p>
              <p>대표자: 황정아</p>
              <p>주소: 경기도 부천시 신흥로 223 신중동역 랜드마크 푸르지오시티 101동 712호</p>
              <p>등록번호: 제41192-2024-00113호</p>
              <p>전화: 010-8680-8151</p>
              <p>이메일: hermann2024@naver.com</p>
            </div>
          </div>

          {/* 대표전화 */}
          <div className="footer-right">
            <h4 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>대표전화 CALL CENTER</h4>
            <p className="footer-phone" style={{ fontSize: '30px', fontWeight: 700, color: '#e2a06e' }}>010-8680-8151</p>
            <p style={{ fontSize: '13px', color: '#bbb', marginTop: '8px', lineHeight: 1.8 }}>평일 10:00 - 19:00 (토요일 10:00 - 19:00)</p>
          </div>

        </div>

        {/* 하단 */}
        <div style={{ borderTop: '1px solid #444', paddingTop: '24px', textAlign: 'center' }}>
          <div className="footer-links" style={{ marginBottom: '16px' }}>
            {['회사소개', '매물 의뢰하기', '부동산 소식', '공지사항'].map((label) => (
              <a key={label} href="#" style={{ color: '#bbb', fontSize: '14px', textDecoration: 'none' }}
                onMouseEnter={e => (e.target as HTMLElement).style.color = '#fff'}
                onMouseLeave={e => (e.target as HTMLElement).style.color = '#bbb'}
              >
                {label}
              </a>
            ))}
          </div>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Powered by HERMANN &copy; 2026 헤르만부동산. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
