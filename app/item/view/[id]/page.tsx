'use client';

import { useState, useEffect } from 'react';

const images = [
  'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80',
  'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=800&q=80',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
  'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
];

const thumbnails = [
  'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=200&q=80',
  'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=200&q=80',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&q=80',
  'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=200&q=80',
  'https://images.unsplash.com/photo-1534723452862-4c874956a9ba?w=200&q=80',
];

const infoRows = [
  { label: '주소',       value: '서울 마포구 망원동 123-45' },
  { label: '거래유형',   value: '월세' },
  { label: '매물종류',   value: '상가' },
  { label: '보증금',     value: '2,500만원', gold: true },
  { label: '월세',       value: '120만원', gold: true },
  { label: '관리비',     value: '90,000원' },
  { label: '권리금',     value: '협의가능', red: true },
  { label: '공급면적',   value: '40㎡' },
  { label: '전용면적',   value: '34.4㎡' },
  { label: '현재층',     value: '1층(지하)' },
  { label: '전체층',     value: '4층' },
  { label: '방향',       value: '남향' },
  { label: '주차',       value: '가능' },
  { label: '엘리베이터', value: '없음' },
  { label: '입주가능일', value: '즉시 입주 가능' },
  { label: '사용승인일', value: '2005년 3월' },
  { label: '테마종류',   value: '휴게음식점, 미용관련업, 소매점' },
];

const navTabs = ['매물번호', '매물 정보', '매물 설명', '주변 교통정보', '위치 및 주변시설', '다른 매물'];

const subwayLines = [
  { line: '2호선', bg: '#00A84D', station: '홍대입구역', dist: '350m' },
  { line: '6호선', bg: '#CD6A28', station: '망원역',     dist: '470m' },
];

const busLines = [
  { num: '271',  stop: '망원동 주민센터', dist: '50m' },
  { num: '672',  stop: '망원역 1번 출구', dist: '120m' },
  { num: '7613', stop: '마포구청 방향',   dist: '200m' },
];

const descPhotos = [
  'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=800&q=80',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
  'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80',
];

/* ── 섹션 헤더 컴포넌트 ── */
function SectionHeader({ icon, title, open, onToggle }: { icon: string; title: string; open: boolean; onToggle: () => void }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f8f8', padding: '10px 16px', borderLeft: '3px solid #C8843A', marginBottom: open ? '12px' : 0, cursor: 'pointer' }}
      onClick={onToggle}
    >
      <span style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>{icon} {title}</span>
      <span style={{ fontSize: '13px', color: '#888', userSelect: 'none' }}>{open ? '∧' : '∨'}</span>
    </div>
  );
}

export default function PropertyDetailPage() {
  const [currentImage, setCurrentImage] = useState(0);
  const [activeTab, setActiveTab] = useState('매물 정보');
  const [headerHeight, setHeaderHeight] = useState(0);
  const [tabHeight, setTabHeight] = useState(0);

  useEffect(() => {
    const header = document.querySelector('header') as HTMLElement;
    const tabBar = document.querySelector('.tab-bar') as HTMLElement;
    if (header) setHeaderHeight(header.offsetHeight);
    if (tabBar) setTabHeight(tabBar.offsetHeight);
  }, []);

  /* 섹션별 접기 상태 */
  const [openInfo,     setOpenInfo]     = useState(true);
  const [openDesc,     setOpenDesc]     = useState(true);
  const [openSubway,   setOpenSubway]   = useState(true);
  const [openBus,      setOpenBus]      = useState(true);
  const [openLocation, setOpenLocation] = useState(true);
  const [facilityTab,  setFacilityTab]  = useState('편의시설');

  const prevImage = () => setCurrentImage((p) => (p === 0 ? images.length - 1 : p - 1));
  const nextImage = () => setCurrentImage((p) => (p === images.length - 1 ? 0 : p + 1));

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh' }}>

      {/* ── 상단 탭 바 ── */}
      <div className="tab-bar" style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', position: 'sticky', top: headerHeight, zIndex: 100, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex' }}>
            {navTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '11px 14px',
                  fontSize: '16px',
                  fontWeight: activeTab === tab ? 700 : 400,
                  color: activeTab === tab ? '#C8843A' : '#555',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #C8843A' : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {['평으로변환', '∧ 위로이동', '〈 이전', '다음 〉'].map((label, i) => (
              <button key={i} style={{ fontSize: '16px', color: '#666', background: 'none', border: '1px solid #ddd', borderRadius: '3px', padding: '5px 8px', cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2열 본문 ── */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '20px 48px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

        {/* ── 좌측 본문 ── */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* 이미지 캐러셀 (그대로 유지) */}
          <div style={{ background: '#fff', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
            <div style={{ position: 'relative', height: '520px' }}>
              <img src={images[currentImage]} alt="매물 이미지" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={prevImage} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff', borderRadius: '50%', width: '44px', height: '44px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <button onClick={nextImage} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff', borderRadius: '50%', width: '44px', height: '44px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              <div style={{ position: 'absolute', right: '16px', bottom: '16px', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '13px', padding: '4px 10px', borderRadius: '20px' }}>
                {currentImage + 1}/{images.length}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', padding: '10px' }}>
              {thumbnails.map((thumb, i) => (
                <div key={i} onClick={() => setCurrentImage(i)} style={{ flex: 1, height: '80px', cursor: 'pointer', overflow: 'hidden', border: currentImage === i ? '2px solid #C8843A' : '2px solid #e0e0e0', transition: 'border 0.2s' }}>
                  <img
                    src={i === 4 ? 'https://images.unsplash.com/photo-1534723452862-4c874956a9ba?w=200&q=80' : thumb}
                    alt={`썸네일${i + 1}`}
                    style={{ width: '100%', height: '80px', objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 🏠 매물 정보 */}
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="🏠" title="매물 정보" open={openInfo} onToggle={() => setOpenInfo(!openInfo)} />
            {openInfo && (
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e0e0e0' }}>
                <tbody>
                  {Array.from({ length: Math.ceil(infoRows.length / 2) }, (_, ri) => {
                    const left  = infoRows[ri * 2];
                    const right = infoRows[ri * 2 + 1];
                    return (
                      <tr key={ri} style={{ borderBottom: '1px solid #e8e8e8' }}>
                        <td style={{ background: '#fafafa', fontSize: '15px', color: '#666', padding: '12px 16px', width: '110px', whiteSpace: 'nowrap' }}>{left.label}</td>
                        <td style={{ fontSize: '16px', fontWeight: left.gold || left.red ? 700 : 400, padding: '12px 16px', color: left.gold ? '#C8843A' : left.red ? '#E53935' : '#333' }}>{left.value}</td>
                        {right ? (
                          <>
                            <td style={{ background: '#fafafa', fontSize: '15px', color: '#666', padding: '12px 16px', width: '110px', whiteSpace: 'nowrap', borderLeft: '1px solid #e8e8e8' }}>{right.label}</td>
                            <td style={{ fontSize: '16px', fontWeight: right.gold || right.red ? 700 : 400, padding: '12px 16px', color: right.gold ? '#C8843A' : right.red ? '#E53935' : '#333' }}>{right.value}</td>
                          </>
                        ) : (
                          <td colSpan={2} style={{ borderLeft: '1px solid #e8e8e8' }} />
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 📝 매물 설명 */}
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="📝" title="매물 설명" open={openDesc} onToggle={() => setOpenDesc(!openDesc)} />
            {openDesc && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  {[
                    '망원역 도보 5분 거리의 역세권 상가입니다.',
                    '유동인구가 많은 대로변에 위치하여 가시성이 뛰어납니다.',
                    '반지층 구조로 임대료 대비 넓은 면적을 제공합니다.',
                    '휴게음식점, 미용관련업, 소매점 등 다양한 업종 가능합니다.',
                    '인테리어 협의 가능하며 즉시 입주 가능합니다.',
                  ].map((desc, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ color: '#C8843A', fontWeight: 700, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: '17px', color: '#333', lineHeight: 1.8 }}>{desc}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                  {descPhotos.map((img, i) => (
                    <img key={i} src={img} alt={`설명 사진 ${i + 1}`} style={{ width: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 🚇 인근 지하철 */}
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="🚇" title="인근 지하철 (주변 5km 이내)" open={openSubway} onToggle={() => setOpenSubway(!openSubway)} />
            {openSubway && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {subwayLines.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: s.bg, color: '#fff', fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>{s.line}</span>
                    <span style={{ fontSize: '15px', fontWeight: 500, color: '#222' }}>{s.station}</span>
                    <span style={{ fontSize: '15px', color: '#888' }}>도보 {s.dist}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 🚌 인근 버스 */}
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="🚌" title="인근 버스 (주변 500m 이내)" open={openBus} onToggle={() => setOpenBus(!openBus)} />
            {openBus && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                  {busLines.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ background: '#1a73e8', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>{b.num}</span>
                      <span style={{ fontSize: '15px', fontWeight: 500, color: '#222' }}>{b.stop}</span>
                      <span style={{ fontSize: '15px', color: '#888' }}>도보 {b.dist}</span>
                    </div>
                  ))}
                </div>
                <button style={{ fontSize: '13px', color: '#555', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', width: '100%' }}>
                  버스 전체보기 ∨
                </button>
              </div>
            )}
          </div>

          {/* 🗺 위치 및 주변시설 */}
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="🗺" title="위치 및 주변시설" open={openLocation} onToggle={() => setOpenLocation(!openLocation)} />
            {openLocation && (
              <div>
                {/* 카카오맵 placeholder */}
                <div style={{ width: '100%', height: '300px', background: '#e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', color: '#888', borderRadius: '4px', marginBottom: '16px' }}>
                  카카오맵 위치 표시 영역
                </div>
                {/* 시설 탭 */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  {['편의시설', '안전시설', '교육시설'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFacilityTab(tab)}
                      style={{ padding: '6px 14px', fontSize: '13px', fontWeight: facilityTab === tab ? 700 : 400, background: facilityTab === tab ? '#C8843A' : '#fff', color: facilityTab === tab ? '#fff' : '#555', border: `1px solid ${facilityTab === tab ? '#C8843A' : '#ddd'}`, borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                {/* 시설 목록 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { icon: '🏪', name: '망원시장' },
                    { icon: '☕', name: '카페거리' },
                    { icon: '🏦', name: '편의점' },
                    { icon: '🏥', name: '약국' },
                    { icon: '🏧', name: '은행 ATM' },
                  ].map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f8f8f8', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '7px 12px', fontSize: '13px', color: '#333' }}>
                      <span>{f.icon}</span><span>{f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── 우측 패널 300px ── */}
        <aside style={{ width: '380px', flexShrink: 0, position: 'sticky', top: headerHeight + tabHeight + 8, alignSelf: 'flex-start', maxHeight: `calc(100vh - ${headerHeight + tabHeight + 8}px)`, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* 매물 정보 카드 */}
          <div style={{ background: '#fff', border: '1px solid #ddd', padding: '16px' }}>
            {/* 매물번호 뱃지 */}
            <div style={{ background: '#f0f0f0', fontSize: '12px', color: '#555', padding: '4px 8px', display: 'inline-block', borderRadius: '3px', marginBottom: '10px' }}>
              HM-2024-001
            </div>

            {/* 가격 */}
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#C8843A', lineHeight: 1.5, marginBottom: '4px' }}>
              보증금 2,500만원 월세 120만원
            </p>
            <p style={{ fontSize: '15px', color: '#666', marginBottom: '12px' }}>관리비 90,000원</p>

            {/* 위치 / 종류·면적·층수 */}
            <p style={{ fontSize: '14px', color: '#444', marginBottom: '4px' }}>📍 서울 마포구 망원동</p>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '14px' }}>상가 · 전용 34.4㎡ · 1층(지하) / 전체 4층</p>

            {/* 문의 버튼 */}
            <button
              style={{ width: '100%', height: '48px', background: '#C8843A', color: '#fff', fontSize: '18px', fontWeight: 700, border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '10px', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#A06828')}
              onMouseLeave={e => (e.currentTarget.style.background = '#C8843A')}
            >
              매물 문의하기
            </button>

            {/* 아이콘 버튼 4개 */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[{ icon: '♡', label: '찜하기' }, { icon: '🖨', label: '인쇄' }, { icon: '📤', label: '공유' }, { icon: '🔗', label: '링크복사' }].map((btn, i) => (
                <button key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '7px 4px', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#555' }}>
                  <span style={{ fontSize: '15px' }}>{btn.icon}</span>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* 공인중개사 카드 */}
          <div style={{ background: '#fff', border: '1px solid #ddd', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>👤</div>
              <div>
                <p style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', marginBottom: '1px' }}>황정아</p>
                <p style={{ fontSize: '13px', color: '#888' }}>대표공인중개사</p>
              </div>
            </div>
            <p style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', marginBottom: '10px' }}>📞 010-8680-8151</p>
            
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {[
                '사무소: 헤르만공인중개사사무소',
                '주소: 부천시 신흥로 223 101동 712호',
                '등록번호: 제41192-2024-00113호',
              ].map((info, i) => (
                <p key={i} style={{ fontSize: '12px', color: '#666', lineHeight: 1.5 }}>{info}</p>
              ))}
            </div>
          </div>


        </aside>

      </div>
    </main>
  );
}
