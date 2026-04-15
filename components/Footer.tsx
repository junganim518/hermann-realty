'use client';

export default function Footer() {
  return (
    <footer style={{ background: '#111', color: '#fff' }}>

      <style dangerouslySetInnerHTML={{ __html: `
        .footer-inner { max-width: 900px; margin: 0 auto; padding: 48px 32px; }
        .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-bottom: 32px; }
        .footer-right { text-align: right; }
        .footer-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 24px; }
        .footer-hours-mobile { display: none; }

        @media (max-width: 767px) {
          .footer-inner { padding: 24px 16px !important; }
          .footer-grid { grid-template-columns: 1fr !important; gap: 20px !important; margin-bottom: 16px !important; }
          .footer-right { text-align: left !important; }
          .footer-logo-row { margin-bottom: 8px !important; gap: 8px !important; }
          .footer-logo-text { font-size: 17px !important; }
          .footer-logo-img { width: 30px !important; height: 30px !important; }
          .footer-info { line-height: 1.6 !important; }
          .footer-info p { font-size: 11px !important; margin: 0 !important; }
          .footer-call-title { display: none !important; }
          .footer-phone-big { display: none !important; }
          .footer-hours-desktop { display: none !important; }
          .footer-hours-mobile { display: block !important; font-size: 11px !important; line-height: 1.6 !important; color: #bbb !important; }
          .footer-call-num { font-size: 18px !important; font-weight: 700 !important; color: #e2a06e !important; }
          .footer-bottom { padding-top: 16px !important; }
          .footer-links { gap: 10px !important; margin-bottom: 10px !important; }
          .footer-links a { font-size: 12px !important; }
          .footer-copy { font-size: 11px !important; }
        }
      ` }} />

      <div className="footer-inner">
        <div className="footer-grid">

          {/* 회사 정보 */}
          <div>
            <div className="footer-logo-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <img className="footer-logo-img" src="/logo.png" alt="헤르만부동산 로고" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              <span className="footer-logo-text" style={{ fontSize: '20px', fontWeight: 700 }}>헤르만부동산</span>
            </div>
            <div className="footer-info" style={{ fontSize: '13px', color: '#bbb', lineHeight: 1.8 }}>
              <p>상호: 헤르만공인중개사사무소</p>
              <p>대표자: 황정아</p>
              <p>주소: 경기도 부천시 신흥로 223 신중동역 랜드마크 푸르지오시티 101동 712호</p>
              <p>등록번호: 제41192-2024-00113호</p>
              <p>전화: <span className="footer-call-num">010-8680-8151</span></p>
              <p>이메일: hermann2024@naver.com</p>
              <p className="footer-hours-mobile">평일 10:00 - 19:00 (토요일 10:00 - 19:00)</p>
            </div>
          </div>

          {/* 대표전화 */}
          <div className="footer-right">
            <h4 className="footer-call-title" style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>대표전화 CALL CENTER</h4>
            <p className="footer-phone-big" style={{ fontSize: '30px', fontWeight: 700, color: '#e2a06e' }}>010-8680-8151</p>
            <p className="footer-hours-desktop" style={{ fontSize: '13px', color: '#bbb', marginTop: '8px', lineHeight: 1.8 }}>평일 10:00 - 19:00 (토요일 10:00 - 19:00)</p>
          </div>

        </div>

        {/* 하단 */}
        <div className="footer-bottom" style={{ borderTop: '1px solid #444', paddingTop: '24px', textAlign: 'center' }}>
          <div className="footer-links" style={{ marginBottom: '16px' }}>
            {[
              { label: '매물 의뢰하기', href: '/inquiry' },
              { label: '부동산 소식', href: '/news' },
              { label: '회사소개', href: '/about' },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{ color: '#bbb', fontSize: '14px', textDecoration: 'none' }}
                onMouseEnter={e => (e.target as HTMLElement).style.color = '#fff'}
                onMouseLeave={e => (e.target as HTMLElement).style.color = '#bbb'}
              >
                {label}
              </a>
            ))}
          </div>
          <p className="footer-copy" style={{ fontSize: '12px', color: '#666' }}>
            Powered by HERMANN &copy; 2026 헤르만부동산. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
