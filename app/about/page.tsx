'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window { kakao: any; }
}

const COMPANY_LAT = 37.5040479677868;
const COMPANY_LNG = 126.77522691726;
const COMPANY_ADDRESS = '경기도 부천시 신흥로 223 신중동역 랜드마크 푸르지오시티 101동 712호';

export default function AboutPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const createMap = () => {
      if (cancelled || !mapRef.current || mapObjRef.current) return;
      const pos = new window.kakao.maps.LatLng(COMPANY_LAT, COMPANY_LNG);
      const map = new window.kakao.maps.Map(mapRef.current, { center: pos, level: 3 });
      mapObjRef.current = map;

      const markerSvg = encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 32 40"><ellipse cx="16" cy="37" rx="6" ry="3" fill="rgba(0,0,0,0.2)"/><path d="M16 0C9.4 0 4 5.4 4 12c0 9 12 24 12 24S28 21 28 12C28 5.4 22.6 0 16 0z" fill="#e2a06e"/><circle cx="16" cy="12" r="5" fill="#fff"/></svg>`
      );
      const markerImage = new window.kakao.maps.MarkerImage(
        `data:image/svg+xml;charset=utf-8,${markerSvg}`,
        new window.kakao.maps.Size(40, 50),
        { offset: new window.kakao.maps.Point(20, 50) }
      );
      new window.kakao.maps.Marker({ map, position: pos, image: markerImage });

      // 인포윈도우
      const iwContent = `<div style="padding:8px 12px;font-family:Pretendard,sans-serif;font-size:13px;font-weight:600;color:#1a1a1a;white-space:nowrap;">헤르만부동산</div>`;
      const infowindow = new window.kakao.maps.InfoWindow({ content: iwContent });
      infowindow.open(map, new window.kakao.maps.Marker({ position: pos }));

      setTimeout(() => { map.relayout(); map.setCenter(pos); }, 100);
    };

    if (typeof window.kakao?.maps?.Map === 'function') {
      createMap();
      return () => { cancelled = true; };
    }

    const existing = document.querySelector('script[src*="dapi.kakao.com/v2/maps/sdk"]');
    if (existing) {
      const t = setInterval(() => {
        if (typeof window.kakao?.maps?.Map === 'function') { clearInterval(t); createMap(); }
        else if (window.kakao?.maps?.load) { clearInterval(t); window.kakao.maps.load(() => { if (!cancelled) createMap(); }); }
      }, 200);
      return () => { cancelled = true; clearInterval(t); };
    }

    const script = document.createElement('script');
    script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=8a478b4b6ea5e02722a33f6ac2fa34b6&autoload=false';
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => { if (!cancelled) createMap(); });
    document.head.appendChild(script);

    return () => { cancelled = true; };
  }, []);

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '32px 16px' }}>

      <style dangerouslySetInnerHTML={{ __html: `
        .about-info-row {
          text-align: left !important;
          justify-content: flex-start !important;
        }
        .about-info-label {
          text-align: left !important;
        }
        @media (max-width: 767px) {
          .about-page h1 { font-size: 24px !important; }
          .about-section { padding: 20px 16px !important; }
          .about-info-row { flex-direction: column !important; gap: 6px !important; align-items: flex-start !important; }
          .about-info-row .about-info-label { min-width: auto !important; font-size: 12px !important; }
          .about-link-grid { grid-template-columns: 1fr !important; }
          .about-map { height: 280px !important; }
        }
      ` }} />

      <div className="about-page" style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* 페이지 타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px' }}>회사소개</h1>
          <p style={{ fontSize: '15px', color: '#888' }}>믿을 수 있는 부동산 파트너, 헤르만부동산</p>
        </div>

        {/* ════════════ 섹션 1: 회사 소개 ════════════ */}
        <section className="about-section" style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '32px', marginBottom: '20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
            <img src="/logo.png" alt="헤르만부동산 로고" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
            <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#e2a06e', margin: 0 }}>헤르만공인중개사사무소</h2>
          </div>
          <p style={{ fontSize: '13px', letterSpacing: '0.2em', color: '#999', marginBottom: '24px' }}>HERMANN REALTY &amp; INVESTMENTS</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '480px', margin: '0 auto', textAlign: 'left' }}>
            <div className="about-info-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="about-info-label" style={{ minWidth: '90px', fontSize: '13px', color: '#888', fontWeight: 600 }}>회사명</span>
              <span style={{ fontSize: '15px', color: '#1a1a1a' }}>헤르만공인중개사사무소</span>
            </div>
            <div className="about-info-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="about-info-label" style={{ minWidth: '90px', fontSize: '13px', color: '#888', fontWeight: 600 }}>대표자</span>
              <span style={{ fontSize: '15px', color: '#1a1a1a' }}>황정아</span>
            </div>
            <div className="about-info-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="about-info-label" style={{ minWidth: '90px', fontSize: '13px', color: '#888', fontWeight: 600 }}>등록번호</span>
              <span style={{ fontSize: '15px', color: '#1a1a1a' }}>제41192-2024-00113호</span>
            </div>
          </div>

          <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.8, marginTop: '24px', maxWidth: '600px', margin: '24px auto 0' }}>
            헤르만부동산은 신중동역 인근에서 상가, 사무실, 주거용 부동산까지<br />
            고객의 니즈에 맞는 최적의 매물을 정직하게 중개합니다.<br />
            오랜 경험과 신뢰를 바탕으로 안전한 거래를 약속드립니다.
          </p>
        </section>

        {/* ════════════ 섹션 2: 오시는 길 ════════════ */}
        <section className="about-section" style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '32px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e' }}>📍 오시는 길</h2>
          <p style={{ fontSize: '15px', color: '#333', marginBottom: '16px', lineHeight: 1.6 }}>
            {COMPANY_ADDRESS}
          </p>
          <div ref={mapRef} className="about-map" style={{ width: '100%', height: '400px', background: '#ebebeb', borderRadius: '8px', overflow: 'hidden' }} />
        </section>

        {/* ════════════ 섹션 3: 주차 안내 ════════════ */}
        <section className="about-section" style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '32px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e' }}>🅿️ 주차 안내</h2>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: '#fff8f2', borderRadius: '6px', border: '1px solid #f0e0c8' }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>🚗</span>
            <div>
              <p style={{ fontSize: '14px', color: '#1a1a1a', fontWeight: 600, marginBottom: '4px' }}>건물 내 주차 가능</p>
              <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.7 }}>
                신중동역 랜드마크 푸르지오시티 지하 주차장을 이용하실 수 있습니다.<br />
                방문 시 사무실에 말씀해 주시면 주차 등록을 도와드립니다.
              </p>
            </div>
          </div>
        </section>

        {/* ════════════ 섹션 4: 운영 정보 ════════════ */}
        <section className="about-section" style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '32px', marginBottom: '20px', textAlign: 'left' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e', textAlign: 'left' }}>📞 운영 정보</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
            <div className="about-info-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
              <p className="about-info-label" style={{ minWidth: '90px', fontSize: '13px', color: '#888', fontWeight: 600, margin: 0, textAlign: 'left' }}>전화</p>
              <a href="tel:010-8680-8151" style={{ fontSize: '18px', color: '#e2a06e', fontWeight: 700, textDecoration: 'none', textAlign: 'left', display: 'block' }}>010-8680-8151</a>
            </div>
            <div className="about-info-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
              <p className="about-info-label" style={{ minWidth: '90px', fontSize: '13px', color: '#888', fontWeight: 600, margin: 0, textAlign: 'left' }}>이메일</p>
              <a href="mailto:hermann2024@naver.com" style={{ fontSize: '15px', color: '#1a1a1a', textDecoration: 'none', textAlign: 'left', display: 'block' }}>hermann2024@naver.com</a>
            </div>
            <div className="about-info-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', textAlign: 'left' }}>
              <p className="about-info-label" style={{ minWidth: '90px', fontSize: '13px', color: '#888', fontWeight: 600, marginTop: '2px', margin: 0, textAlign: 'left' }}>영업시간</p>
              <div style={{ fontSize: '15px', color: '#1a1a1a', lineHeight: 1.7, textAlign: 'left' }}>
                평일 10:00 ~ 19:00<br />
                토요일 10:00 ~ 19:00
              </div>
            </div>
          </div>
        </section>

        {/* ════════════ 섹션 5: 외부 링크 ════════════ */}
        <section className="about-section" style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '32px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e' }}>🔗 바로가기</h2>
          <div className="about-link-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <a
              href="https://blog.naver.com/hermann2025"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: '#03C75A', color: '#fff', borderRadius: '8px', fontSize: '15px', fontWeight: 700, textDecoration: 'none', transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <span style={{ fontSize: '16px', fontWeight: 900 }}>N</span> 블로그
            </a>
            <a
              href="https://map.naver.com/p/entry/place/1028024077?c=15.00,0,0,0,dh&placePath=/home?from=map&fromPanelNum=1&additionalHeight=76&timestamp=202604101441&locale=ko&svcName=map_pcv5"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: '#fff', color: '#03C75A', border: '2px solid #03C75A', borderRadius: '8px', fontSize: '15px', fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#03C75A'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#03C75A'; }}
            >
              <span style={{ fontSize: '16px', fontWeight: 900 }}>N</span> 플레이스
            </a>
            <a
              href="https://open.kakao.com/o/s3lwiwsh"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: '#FEE500', color: '#3C1E1E', borderRadius: '8px', fontSize: '15px', fontWeight: 700, textDecoration: 'none', transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#3C1E1E"><path d="M12 3C6.48 3 2 6.58 2 10.94c0 2.8 1.86 5.27 4.68 6.67-.15.56-.97 3.6-.99 3.83 0 0-.02.17.09.24.11.06.24.01.24.01.32-.04 3.7-2.42 4.28-2.83.55.08 1.11.12 1.7.12 5.52 0 10-3.58 10-7.94S17.52 3 12 3z"/></svg>
              카카오톡 문의
            </a>
          </div>
        </section>

      </div>
    </main>
  );
}
