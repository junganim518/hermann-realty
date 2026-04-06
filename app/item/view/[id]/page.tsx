'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const navTabs = ['매물 정보', '매물 설명', '위치 및 주변시설', '주변 교통정보', '비슷한 매물'];

const subwayLines = [
  { line: '2호선', bg: '#00A84D', station: '홍대입구역', dist: '350m' },
  { line: '6호선', bg: '#CD6A28', station: '망원역',     dist: '470m' },
];

const busLines = [
  { num: '271',  stop: '망원동 주민센터', dist: '50m' },
  { num: '672',  stop: '망원역 1번 출구', dist: '120m' },
  { num: '7613', stop: '마포구청 방향',   dist: '200m' },
];

/* ── 평수 계산 함수 ── */
const toPyeong = (sqm: number) => Math.round(sqm * 0.3025);

/* ── 주소 포맷 함수 ── */
const formatAddress = (address: string) => {
  if (!address) return '';
  const match = address.match(/(.+동)/);
  return match ? match[1] : address;
};

/* ── 금액 포맷 함수 ── */
const formatPrice = (amount: number) => {
  if (!amount) return '-';
  const man = Math.floor(amount / 10000);
  const remain = amount % 10000;
  if (remain === 0) return `${man.toLocaleString()}만원`;
  return `${man.toLocaleString()}만 ${remain.toLocaleString()}원`;
};

/* ── 섹션 헤더 컴포넌트 ── */
function SectionHeader({ icon, title, open, onToggle }: { icon: string; title: string; open: boolean; onToggle: () => void }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f8f8', padding: '10px 16px', borderLeft: '3px solid #e2a06e', marginBottom: open ? '12px' : 0, cursor: 'pointer' }}
      onClick={onToggle}
    >
      <span style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>{icon} {title}</span>
      <span style={{ fontSize: '13px', color: '#888', userSelect: 'none' }}>{open ? '∧' : '∨'}</span>
    </div>
  );
}

interface Property {
  property_number?: string;
  address?: string;
  transaction_type?: string;
  property_type?: string;
  deposit?: number;
  monthly_rent?: number;
  maintenance_fee?: number;
  premium?: number;
  supply_area?: string;
  exclusive_area?: string;
  current_floor?: string;
  total_floors?: string;
  direction?: string;
  parking?: boolean | string;
  elevator?: boolean | string;
  theme_type?: string;
  available_date?: string;
  approval_date?: string;
  usage_type?: string;
  theme_types?: string;
  description?: string;
  property_images?: { image_url: string; thumbnail_url?: string }[];
}

export default function PropertyDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [similarProperties, setSimilarProperties] = useState<any[]>([]);

  const [currentImage, setCurrentImage] = useState(0);
  const [activeTab, setActiveTab] = useState('매물 정보');
  const [headerHeight, setHeaderHeight] = useState(0);

  const [isPyeong, setIsPyeong] = useState(false);
  const [openInfo,     setOpenInfo]     = useState(true);
  const [openDesc,     setOpenDesc]     = useState(true);
  const [openSubway,   setOpenSubway]   = useState(true);
  const [openBus,      setOpenBus]      = useState(true);
  const [openLocation, setOpenLocation] = useState(true);
  const [facilityTab,  setFacilityTab]  = useState('편의시설');

  useEffect(() => {
    const header = document.querySelector('header') as HTMLElement;
    if (header) setHeaderHeight(header.offsetHeight);
  }, []);

  useEffect(() => {
    if (!id) return;
    async function fetchProperty() {
      setLoading(true);
      const { data } = await supabase
        .from('properties')
        .select('*, property_images(*)')
        .eq('property_number', id)
        .single();
      console.log('description:', data?.description);
      setProperty(data);
      setLoading(false);
      if (data?.property_type) {
        const { data: similar } = await supabase
          .from('properties')
          .select('*, property_images(*)')
          .eq('property_type', data.property_type)
          .neq('property_number', data.property_number)
          .limit(3);
        setSimilarProperties(similar ?? []);
      }
    }
    fetchProperty();
  }, [id]);

  const images: string[] = property?.property_images?.map((img: any) => img.image_url) ?? [
    'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80',
    'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=800&q=80',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
  ];

  const thumbnails: string[] = property?.property_images?.map((img: any) => img.thumbnail_url ?? img.image_url) ?? [
    'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=200&q=80',
    'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=200&q=80',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=200&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&q=80',
  ];

  const prevImage = () => setCurrentImage((p) => (p === 0 ? images.length - 1 : p - 1));
  const nextImage = () => setCurrentImage((p) => (p === images.length - 1 ? 0 : p + 1));

  if (loading) {
    return (
      <main style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⏳</div>
          <p style={{ fontSize: '16px' }}>매물 정보를 불러오는 중입니다...</p>
        </div>
      </main>
    );
  }

  if (!property) {
    return (
      <main style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏚</div>
          <p style={{ fontSize: '20px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>매물을 찾을 수 없습니다</p>
          <p style={{ fontSize: '15px', color: '#999' }}>매물번호 {id}에 해당하는 매물이 존재하지 않습니다.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh' }}>

      {/* ── 상단 탭 바 ── */}
      <div className="tab-bar" style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', position: 'sticky', top: headerHeight, zIndex: 100, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ width: '100%', maxWidth: '100%', padding: '0 350px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex' }}>
            {navTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '11px 14px',
                  fontSize: '16px',
                  fontWeight: activeTab === tab ? 700 : 400,
                  color: activeTab === tab ? '#e2a06e' : '#555',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #e2a06e' : '2px solid transparent',
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
      <div style={{ width: '100%', maxWidth: '100%', padding: '20px 350px 0', display: 'flex', gap: '32px', alignItems: 'flex-start' }}>

        {/* ── 좌측 본문 ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* 이미지 캐러셀 */}
          <div style={{ background: '#fff', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
            <div style={{ position: 'relative', height: '600px' }}>
              <img src={images[currentImage]} alt="매물 이미지" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={prevImage} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff', borderRadius: '50%', width: '44px', height: '44px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <button onClick={nextImage} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff', borderRadius: '50%', width: '44px', height: '44px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              <div style={{ position: 'absolute', right: '16px', bottom: '16px', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '13px', padding: '4px 10px', borderRadius: '20px' }}>
                {currentImage + 1}/{images.length}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', padding: '10px' }}>
              {thumbnails.map((thumb, i) => (
                <div key={i} onClick={() => setCurrentImage(i)} style={{ flex: 1, height: '120px', cursor: 'pointer', overflow: 'hidden', border: currentImage === i ? '2px solid #e2a06e' : '2px solid #e0e0e0', transition: 'border 0.2s' }}>
                  <img src={thumb} alt={`썸네일${i + 1}`} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>

          {/* 🏠 매물 정보 */}
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="🏠" title="매물 정보" open={openInfo} onToggle={() => setOpenInfo(!openInfo)} />
            {openInfo && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {/* 1행: 주소 | 매물종류 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>주소</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>{property.address ? formatAddress(property.address) : '-'}</td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>매물종류</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>{property.property_type ?? '-'}</td>
                  </tr>
                  {/* 2행: 거래유형 | 금액 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>거래유형</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>{property.transaction_type ?? '-'}</td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>금액</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#e2a06e', fontWeight: 700 }}>
                      {[property.deposit && `보증금 ${formatPrice(property.deposit)}`, property.monthly_rent && `월세 ${formatPrice(property.monthly_rent)}`].filter(Boolean).join(' / ') || '-'}
                    </td>
                  </tr>
                  {/* 3행: 권리금 | 관리비 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>권리금</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#E53935', fontWeight: 700 }}>{!property.premium ? '무권리' : '협의'}</td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>관리비</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>{property.maintenance_fee ? formatPrice(property.maintenance_fee) : '없음'}</td>
                  </tr>
                  {/* 4행: 면적 | 층수 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>면적</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {property.supply_area && (
                            <span>{isPyeong ? `공급 ${toPyeong(parseFloat(property.supply_area))}평` : `공급 ${property.supply_area}㎡`}</span>
                          )}
                          {property.exclusive_area && (
                            <span>{isPyeong ? `전용 ${toPyeong(parseFloat(property.exclusive_area))}평` : `전용 ${property.exclusive_area}㎡`}</span>
                          )}
                          {!property.supply_area && !property.exclusive_area && '-'}
                        </div>
                        <button
                          onClick={() => setIsPyeong(!isPyeong)}
                          style={{ border: '1px solid #e2a06e', color: '#e2a06e', fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '8px' }}
                        >
                          {isPyeong ? '㎡로 보기' : '평으로 보기'}
                        </button>
                      </div>
                    </td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>층수</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>
                      {[property.current_floor && `${property.current_floor}층`, property.total_floors && `전체 ${property.total_floors}층`].filter(Boolean).join(' / ') || '-'}
                    </td>
                  </tr>
                  {/* 5행: 방향 | 입주가능일 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>방향</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>{property.direction ?? '-'}</td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>입주가능일</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>{property.available_date ?? '-'}</td>
                  </tr>
                  {/* 6행: 주차 | 엘리베이터 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>주차</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>{property.parking === true || property.parking === '가능' ? '가능' : property.parking === false || property.parking === '불가' ? '불가' : property.parking ?? '-'}</td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>엘리베이터</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>{property.elevator === true || property.elevator === '있음' ? '있음' : property.elevator === false || property.elevator === '없음' ? '없음' : property.elevator ?? '-'}</td>
                  </tr>
                  {/* 7행: 용도 | 사용승인일 */}
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>용도</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>{property.usage_type ?? '-'}</td>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>사용승인일</td>
                    <td style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>{property.approval_date ?? '-'}</td>
                  </tr>
                  {/* 8행: 테마종류 (전체) */}
                  <tr>
                    <td style={{ width: '120px', padding: '12px 16px', background: '#f8f8f8', fontSize: '16px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>테마종류</td>
                    <td colSpan={3} style={{ padding: '12px 16px', fontSize: '16px', color: '#333' }}>{property.theme_types ?? property.theme_type ?? '-'}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* 📝 매물 설명 */}
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="📝" title="매물 설명" open={openDesc} onToggle={() => setOpenDesc(!openDesc)} />
            {openDesc && (
              <div>
                <p style={{ whiteSpace: 'pre-line', lineHeight: '2', fontSize: '15px' }}>
                  {property?.description}
                </p>
              </div>
            )}
          </div>

          {/* 🗺 위치 및 주변시설 */}
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="🗺" title="위치 및 주변시설" open={openLocation} onToggle={() => setOpenLocation(!openLocation)} />
            {openLocation && (
              <div>
                <div style={{ width: '100%', height: '300px', background: '#e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', color: '#888', borderRadius: '4px', marginBottom: '16px' }}>
                  카카오맵 위치 표시 영역
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  {['편의시설', '안전시설', '교육시설'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFacilityTab(tab)}
                      style={{ padding: '6px 14px', fontSize: '13px', fontWeight: facilityTab === tab ? 700 : 400, background: facilityTab === tab ? '#e2a06e' : '#fff', color: facilityTab === tab ? '#fff' : '#555', border: `1px solid ${facilityTab === tab ? '#e2a06e' : '#ddd'}`, borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
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

          {/* 🏘 비슷한 매물 */}
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '16px' }}>
            <SectionHeader icon="🏘" title="비슷한 매물" open={true} onToggle={() => {}} />
            {similarProperties.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {similarProperties.map((p: any) => {
                  const thumb = p.property_images?.[0]?.thumbnail_url ?? p.property_images?.[0]?.image_url ?? 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400';
                  return (
                    <a
                      key={p.property_number}
                      href={`/item/view/${p.property_number}`}
                      style={{ textDecoration: 'none', color: 'inherit', display: 'block', border: '1px solid #e0e0e0', overflow: 'hidden', transition: 'all 0.2s ease', cursor: 'pointer' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ background: '#e2a06e', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#fff', fontWeight: 500 }}>{p.property_number}</span>
                        <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>{p.title}</span>
                      </div>
                      <div style={{ height: '100px', overflow: 'hidden' }}>
                        <img src={thumb} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ padding: '8px' }}>
                        <p style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                          {[p.address ? formatAddress(p.address) : null, p.exclusive_area, p.current_floor && `${p.current_floor}층`].filter(Boolean).join(' · ')}
                        </p>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#e2a06e' }}>
                          {[p.deposit && `보증금 ${formatPrice(p.deposit)}`, p.monthly_rent && `월세 ${formatPrice(p.monthly_rent)}`].filter(Boolean).join(' / ') || '-'}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: '#999', textAlign: 'center', padding: '16px 0' }}>비슷한 매물이 없습니다.</p>
            )}
          </div>

        </div>

        {/* ── 우측 패널 ── */}
        <aside style={{ width: '360px', flexShrink: 0, position: 'sticky', top: '190px', alignSelf: 'flex-start', maxHeight: 'calc(100vh - 190px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* 매물 정보 카드 */}
          <div style={{ background: '#fff', border: '1px solid #ddd', padding: '16px' }}>
            <div style={{ background: '#f0f0f0', fontSize: '12px', color: '#555', padding: '4px 8px', display: 'inline-block', borderRadius: '3px', marginBottom: '10px' }}>
              매물번호 {property.property_number ?? id}
            </div>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#e2a06e', lineHeight: 1.5, marginBottom: '4px' }}>
              {property.deposit ? `보증금 ${formatPrice(property.deposit)}` : ''}{property.monthly_rent ? ` 월세 ${formatPrice(property.monthly_rent)}` : ''}
            </p>
            {property.maintenance_fee && (
              <p style={{ fontSize: '15px', color: '#666', marginBottom: '12px' }}>관리비 {formatPrice(property.maintenance_fee)}</p>
            )}
            <p style={{ fontSize: '16px', color: '#444', marginBottom: '4px' }}>📍 {property.address ? formatAddress(property.address) : '-'}</p>
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '14px' }}>
              {[property.property_type, property.exclusive_area && `전용 ${property.exclusive_area}㎡ (${toPyeong(parseFloat(property.exclusive_area))}평)`, property.current_floor, property.total_floors && `전체 ${property.total_floors}`].filter(Boolean).join(' · ')}
            </p>
            <button
              style={{ width: '100%', height: '48px', background: '#e2a06e', color: '#fff', fontSize: '18px', fontWeight: 700, border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '10px', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#A06828')}
              onMouseLeave={e => (e.currentTarget.style.background = '#e2a06e')}
            >
              매물 문의하기
            </button>
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
