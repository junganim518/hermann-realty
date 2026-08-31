import type { Metadata } from 'next';
import Image from 'next/image';
import { Phone, MapPin, Building2, Users, Car, TrendingUp } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import FloorPlan, { type PublicUnit } from './FloorPlan';
import InquiryForm from './InquiryForm';

export const metadata: Metadata = {
  title: '동작 보라매역 프리센트 상업시설 임대 | 병원·클리닉·학원·F&B | 헤르만부동산',
  description:
    '7호선·신림선 보라매역 더블역세권 신축 프리센트 상업시설 임대. B1~3F 병원·클리닉·학원·F&B·오피스 전층 공실 임대 문의 — 헤르만부동산.',
  alternates: { canonical: 'https://hermann-realty.com/properties/boramae-precent' },
  openGraph: {
    title: '동작 보라매역 프리센트 상업시설 임대 | 헤르만부동산',
    description: '7호선·신림선 보라매역 더블역세권 신축 상업시설 임대. 병원·클리닉·학원·F&B·오피스. 헤르만부동산.',
    url: 'https://hermann-realty.com/properties/boramae-precent',
    images: [{ url: 'https://hermann-realty.com/hero-building-cg.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '동작 보라매역 프리센트 상업시설 임대 | 헤르만부동산',
    description: '7호선·신림선 보라매역 더블역세권 신축 상업시설 임대. 병원·클리닉·학원·F&B·오피스. 헤르만부동산.',
    images: ['https://hermann-realty.com/hero-building-cg.png'],
  },
};

export const revalidate = 1800;

const HIGHLIGHTS = [
  {
    Icon: TrendingUp,
    label: '유동인구',
    value: '일 4.3만 명',
    desc: '보라매역 반경 200m 기준 유동인구. 두 노선 환승 수요 집중 입지.',
  },
  {
    Icon: Users,
    label: '배후 세대',
    value: '1만+ 세대',
    desc: '신길뉴타운·대방동 일대 배후 주거 세대. 안정적 생활권 수요 확보.',
  },
  {
    Icon: Building2,
    label: '다이소 인접',
    value: '바로 옆 다이소',
    desc: '바로 옆 건물에 다이소가 통건물로 임차 완료돼, 유동인구 유입과 상권 활성화 효과를 함께 누릴 수 있습니다.',
  },
  {
    Icon: Car,
    label: '주차',
    value: '190대+',
    desc: '지하 주차장 190대 이상 확보. 병의원·대형 매장 방문 고객 주차 편의 충족.',
  },
];

const ZONES = [
  {
    zone: 'street-fb',
    floor: '1F',
    title: '1층 F&B 스트리트몰',
    color: '#059669',
    desc: '보라매역 출입구와 직접 연결되는 스트리트형 상업 공간. 유동인구 집중 노출, 카페·식음료·테이크아웃 업종 최적.',
  },
  {
    zone: 'clinic-academy',
    floor: '2F~3F',
    title: '2·3층 병원·클리닉·학원존',
    color: '#2563eb',
    desc: '배후 주거 세대 1만+ 수요를 흡수하는 병원·클리닉·교육 특화 섹션. 12~21평 독립 호실, 병의원·클리닉·학원·상담센터 적합.',
  },
  {
    zone: 'mid-office',
    floor: '2F~3F',
    title: '2·3층 중형 오피스',
    color: '#7c3aed',
    desc: '8~12평 중형 사무 공간. 뷰티·헬스케어·소형 업무 사무실로 활용 가능. 합리적 임대조건으로 초기 비용 절감.',
  },
  {
    zone: 'section-office',
    floor: '2F~3F',
    title: '2·3층 섹션 오피스',
    color: '#db2777',
    desc: '5평 전후 1인 전용 소형 오피스. 프리랜서·스타트업·1인 창업에 최적화. 공용 복도·화장실 공유로 관리 효율화.',
  },
  {
    zone: 'large',
    floor: 'B1',
    title: 'B1 대형 상가',
    color: '#d97706',
    desc: '31~45평 대형 공간. 피트니스·대형 학원·대형 식음료 매장 입점 가능. 높은 천장고, 충분한 주차 대수 연계.',
  },
  {
    zone: 'small',
    floor: 'B1',
    title: 'B1 소형 창고',
    color: '#64748b',
    desc: '5~7평 소형 저장 공간. 1층 스트리트몰 입점 상가의 후방 창고 또는 단독 소형 수납 공간으로 활용.',
  },
];

const PAGE_CSS = `
  .pc-wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 24px; box-sizing: border-box; }
  .pc-hero-split { display: grid; grid-template-columns: 55fr 45fr; max-width: 1200px; margin: 0 auto; min-height: 560px; }
  .pc-hero-left { padding: 80px 52px 80px 24px; display: flex; flex-direction: column; justify-content: center; }
  .pc-hero-right { position: relative; overflow: hidden; }
  .pc-hero-right img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
  .pc-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to right, rgba(10,10,30,0.8) 0%, rgba(10,10,30,0.2) 60%, transparent 100%); pointer-events: none; }
  .pc-badge { display: inline-block; background: rgba(196,124,48,0.18); border: 1px solid rgba(196,124,48,0.4); color: #e2a06e; font-size: 11px; font-weight: 700; letter-spacing: 2.5px; padding: 5px 16px; border-radius: 20px; margin-bottom: 22px; width: fit-content; }
  .pc-spec-row { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0 28px; }
  .pc-spec-chip { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); color: #ddd; font-size: 13px; font-weight: 600; padding: 7px 16px; border-radius: 20px; }
  .pc-cta-group { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .pc-cta-btn { display: inline-flex; align-items: center; gap: 8px; background: #c47c30; color: #fff; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 4px; text-decoration: none; transition: background 0.15s; white-space: nowrap; }
  .pc-cta-btn:hover { background: #a8642a; }
  .pc-cta-outline { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: rgba(255,255,255,0.85); border: 1px solid rgba(255,255,255,0.35); font-size: 15px; font-weight: 600; padding: 14px 26px; border-radius: 4px; text-decoration: none; transition: border-color 0.15s, color 0.15s; white-space: nowrap; }
  .pc-cta-outline:hover { border-color: #c47c30; color: #c47c30; }
  .pc-hl-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .pc-hl-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 12px; padding: 28px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
  .pc-zone-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .pc-zone-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; padding: 22px 20px 24px; }
  .pc-floor-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 8px; margin-bottom: 8px; }
  .pc-inquiry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
  @media (max-width: 1023px) {
    .pc-hl-grid { grid-template-columns: repeat(2, 1fr); }
    .pc-zone-grid { grid-template-columns: repeat(2, 1fr); }
    .pc-inquiry-grid { grid-template-columns: 1fr; gap: 32px; }
  }
  @media (max-width: 767px) {
    .pc-hero-split { grid-template-columns: 1fr; min-height: auto; }
    .pc-hero-right { height: 220px; order: -1; }
    .pc-hero-overlay { background: rgba(0,0,0,0.25); }
    .pc-hero-left { padding: 36px 20px 44px; }
    .pc-cta-group { flex-direction: column; }
    .pc-cta-btn, .pc-cta-outline { display: flex; justify-content: center; width: 100%; box-sizing: border-box; }
    .pc-hl-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .pc-zone-grid { grid-template-columns: 1fr; gap: 14px; }
    .pc-wrap { padding: 0 16px; }
  }
`;

export default async function BoramaePresentPage() {
  // service role로 조회 — 가격 필드 제외
  let units: PublicUnit[] = [];
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data } = await supabaseAdmin
      .from('precent_units')
      .select('unit_no, floor, zone, exclusive_area_py, contract_area_py, status, memo')
      .order('floor')
      .order('unit_no');
    units = (data ?? []) as PublicUnit[];
  }

  // 존별 집계 (전체 호실 수 + 공실 수)
  const zoneStats: Record<string, { total: number; vacant: number; minPy: number; maxPy: number }> = {};
  for (const u of units) {
    if (!zoneStats[u.zone]) zoneStats[u.zone] = { total: 0, vacant: 0, minPy: Infinity, maxPy: -Infinity };
    zoneStats[u.zone].total++;
    if (u.status === 'vacant') {
      zoneStats[u.zone].vacant++;
      zoneStats[u.zone].minPy = Math.min(zoneStats[u.zone].minPy, u.exclusive_area_py);
      zoneStats[u.zone].maxPy = Math.max(zoneStats[u.zone].maxPy, u.exclusive_area_py);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#fafafa' }}>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

      {/* ── 히어로 ── */}
      <section style={{ background: '#0a0a1e', color: '#fff' }}>
        <div className="pc-hero-split">
          <div className="pc-hero-left">
            <div className="pc-badge">BORAMAE · PRECENT · 2025 OPEN</div>
            <h1 style={{ fontSize: 'clamp(26px, 4vw, 46px)', fontWeight: 900, lineHeight: 1.18, margin: '0 0 14px', letterSpacing: '-0.5px' }}>
              동작 보라매역<br />
              <span style={{ color: '#c47c30' }}>프리센트</span> 상업시설 임대
            </h1>
            <p style={{ fontSize: 'clamp(13px, 1.6vw, 16px)', color: '#aaa', lineHeight: 1.8, margin: 0 }}>
              7호선·신림선 더블역세권, 근린상업지역<br />
              B1~3F 전층 상업시설 — 병원·클리닉·학원·F&B·오피스
            </p>
            <div className="pc-spec-row">
              {['7호선·신림선 보라매역', '근린상업지역', 'B1~3F 상업시설', '주차 190대+'].map(s => (
                <span key={s} className="pc-spec-chip">{s}</span>
              ))}
            </div>
            <div className="pc-cta-group">
              <a href="tel:01086808151" className="pc-cta-btn">
                <Phone size={15} strokeWidth={2} />
                전화 상담
              </a>
              <a href="#precent-inquiry" className="pc-cta-outline">
                임대 문의 접수
              </a>
            </div>
          </div>
          <div className="pc-hero-right">
            <Image
              src="/hero-building-cg.png"
              alt="동작구 보라매역 프리센트 상업시설 외관 CG 렌더링"
              fill
              priority
              style={{ objectFit: 'cover', objectPosition: 'center' }}
            />
            <div className="pc-hero-overlay" />
          </div>
        </div>
      </section>

      {/* ── 입지 강점 ── */}
      <section style={{ padding: '72px 0 80px', background: '#f4f4f4' }}>
        <div className="pc-wrap">
          <p style={{ fontSize: '11px', color: '#c47c30', fontWeight: 700, letterSpacing: '2px', textAlign: 'center', margin: '0 0 8px', textTransform: 'uppercase' }}>Location</p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 800, color: '#1a1a1a', margin: '0 0 36px' }}>
            왜 보라매역 프리센트인가
          </h2>
          <div className="pc-hl-grid">
            {HIGHLIGHTS.map(({ Icon, label, value, desc }) => (
              <div key={label} className="pc-hl-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '40px', height: '40px', background: '#fff8f2', borderRadius: '50%', border: '1px solid #f0dcc8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color="#c47c30" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#999', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: 'clamp(16px, 1.8vw, 20px)', fontWeight: 800, color: '#1a1a1a', lineHeight: 1 }}>{value}</div>
                  </div>
                </div>
                <div style={{ width: '24px', height: '2px', background: '#c47c30', marginBottom: '10px' }} />
                <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
          {/* 건물 부가 정보 */}
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#999', margin: '28px 0 0' }}>
            ※ 4층은 입주민 커뮤니티시설로 운영 예정 (임대 대상 아님)
          </p>
        </div>
      </section>

      {/* ── MD 존 소개 ── */}
      <section style={{ padding: '72px 0 80px', background: '#fff' }}>
        <div className="pc-wrap">
          <p style={{ fontSize: '11px', color: '#c47c30', fontWeight: 700, letterSpacing: '2px', textAlign: 'center', margin: '0 0 8px', textTransform: 'uppercase' }}>Zones</p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 800, color: '#1a1a1a', margin: '0 0 10px' }}>층별 MD 존 구성</h2>
          <p style={{ textAlign: 'center', fontSize: '14px', color: '#888', margin: '0 0 36px' }}>임대조건은 문의 시 개별 안내드립니다.</p>
          <div className="pc-zone-grid">
            {ZONES.map(z => {
              const stat = zoneStats[z.zone];
              const hasData = !!stat && stat.total > 0;
              const fullyLeased = hasData && stat.vacant === 0;
              return (
                <div key={z.zone} className="pc-zone-card" style={{ position: 'relative' }}>
                  {/* 임대완료 배지 (공실 0개인 존) */}
                  {fullyLeased && (
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, background: '#1a1a1a', color: '#fff', padding: '2px 10px', borderRadius: '10px', letterSpacing: '0.5px' }}>
                        임대완료
                      </span>
                    </div>
                  )}
                  <span className="pc-floor-badge" style={{ background: `${z.color}18`, color: z.color }}>
                    {z.floor}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ width: '4px', height: '20px', background: z.color, borderRadius: '2px', flexShrink: 0 }} />
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>{z.title}</h3>
                  </div>
                  <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.65, margin: '0 0 14px' }}>{z.desc}</p>
                  {fullyLeased ? (
                    <span style={{ fontSize: '12px', background: '#f1f5f9', color: '#64748b', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>현재 공실 없음</span>
                  ) : hasData && stat.vacant > 0 ? (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                        공실 {stat.vacant}개
                      </span>
                      <span style={{ fontSize: '12px', background: '#f3f4f6', color: '#374151', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                        {stat.minPy.toFixed(1)}~{stat.maxPy.toFixed(1)}평
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', background: '#f3f4f6', color: '#6b7280', padding: '3px 10px', borderRadius: '12px' }}>임대조건 문의</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 인터랙티브 평면도 ── */}
      <section style={{ padding: '72px 0 80px', background: '#f8f8f8' }}>
        <div className="pc-wrap">
          <p style={{ fontSize: '11px', color: '#c47c30', fontWeight: 700, letterSpacing: '2px', textAlign: 'center', margin: '0 0 8px', textTransform: 'uppercase' }}>Floor Plan</p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 800, color: '#1a1a1a', margin: '0 0 8px' }}>층별 호실 평면도</h2>
          <p style={{ textAlign: 'center', fontSize: '14px', color: '#888', margin: '0 0 28px' }}>
            호실을 클릭하면 면적·존 정보를 확인할 수 있습니다.
          </p>
          <FloorPlan units={units} />
        </div>
      </section>

      {/* ── 문의 섹션 ── */}
      <section id="precent-inquiry" style={{ padding: '80px 0 88px', background: '#fff' }}>
        <div className="pc-wrap">
          <div className="pc-inquiry-grid">
            {/* 좌: 안내 */}
            <div>
              <p style={{ fontSize: '11px', color: '#c47c30', fontWeight: 700, letterSpacing: '2px', margin: '0 0 10px', textTransform: 'uppercase' }}>Contact</p>
              <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 900, color: '#1a1a1a', lineHeight: 1.3, margin: '0 0 20px' }}>
                임대 문의 &amp;<br />
                <span style={{ color: '#c47c30' }}>조건 상담</span>
              </h2>
              <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.8, margin: '0 0 28px' }}>
                보증금·월세 등 임대조건은 직접 문의 주시면 개별 안내드립니다.<br />
                희망 존과 면적을 남겨주시면 맞춤 정보를 제공해 드립니다.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <a href="tel:01086808151" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                  <div style={{ width: '44px', height: '44px', background: '#c47c30', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Phone size={18} color="#fff" strokeWidth={2} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>전화 상담</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#1a1a1a' }}>010-8680-8151</div>
                  </div>
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MapPin size={18} color="#888" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>중개사무소</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#444' }}>헤르만공인중개사사무소 · 부천 원미구</div>
                  </div>
                </div>
              </div>
            </div>
            {/* 우: 폼 */}
            <div style={{ background: '#f8f9fa', borderRadius: '12px', padding: '32px', border: '1px solid #e8e8e8' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 20px' }}>임대 문의 접수</h3>
              <InquiryForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── 하단 CTA ── */}
      <section style={{ background: '#0a0a1e', color: '#fff', padding: 'clamp(48px, 7vw, 80px) 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: '540px', margin: '0 auto' }}>
          <p style={{ fontSize: '12px', color: '#555', margin: '0 0 10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>보라매역 더블역세권</p>
          <p style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 800, margin: '0 0 8px', color: '#fff' }}>
            프리센트 상업시설 임대,
          </p>
          <p style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 800, margin: '0 0 32px', color: '#c47c30' }}>
            헤르만부동산에 문의하세요
          </p>
          <div className="pc-cta-group" style={{ justifyContent: 'center' }}>
            <a href="tel:01086808151" className="pc-cta-btn" style={{ fontSize: '16px', padding: '16px 36px' }}>
              <Phone size={16} strokeWidth={2} />
              지금 전화하기
            </a>
            <a href="#precent-inquiry" className="pc-cta-outline" style={{ fontSize: '16px', padding: '16px 26px' }}>
              온라인 문의 접수
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
