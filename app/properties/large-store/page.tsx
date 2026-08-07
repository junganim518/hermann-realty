import type { Metadata } from 'next';
import { Ruler, Car, Building2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PropertyCard from '@/components/PropertyCard';

export const metadata: Metadata = {
  title: '대형 매장 부지 전문 중개 | 헤르만부동산',
  description:
    '창고형 약국, 식자재마트, 아울렛 등 100평 이상 대형 상가 임대 전문 중개. 넓은 주차 공간과 1층 단독 건물을 갖춘 대형매장부지를 헤르만부동산이 찾아드립니다.',
  openGraph: {
    title: '대형 매장 부지 전문 중개 | 헤르만부동산',
    description:
      '창고형 약국, 식자재마트, 아울렛 등 100평 이상 대형 상가 임대. 전국 대형매장부지 전문 중개.',
    url: 'https://hermann-realty.com/properties/large-store',
  },
};

export const revalidate = 3600;

const CONDITIONS = [
  {
    Icon: Ruler,
    label: '전용면적',
    value: '100평 이상',
    desc: '창고형 매장 운영에 충분한 넓이 확보',
    // Unsplash — IKEA식 창고형 대형 매장 내부, 높은 천장·넓은 진열대
    img: 'https://images.unsplash.com/photo-1644079446600-219068676743?w=800&q=80&auto=format&fit=crop',
    imgAlt: '창고형 대형 매장 내부 — 천장 높고 넓은 진열대, 100평 이상 전용면적',
  },
  {
    Icon: Car,
    label: '주차대수',
    value: '30대 이상',
    desc: '방문 고객을 위한 충분한 주차 공간 필수',
    // Unsplash — 대형 주차장 항공 뷰
    img: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80&auto=format&fit=crop',
    imgAlt: '대형 주차장 — 30대 이상 주차 가능한 대형 상가 부지',
  },
  {
    Icon: Building2,
    label: '건물형태',
    value: '1층 · 단독건물',
    desc: '접근성과 브랜드 노출에 유리한 독립 건물',
    // Unsplash — 대형 상가 건물 외관 + 주차장 (modern retail buildings with parking lot)
    img: 'https://images.unsplash.com/photo-1764801341736-ea42131f484c?w=800&q=80&auto=format&fit=crop',
    imgAlt: '대형 상가 건물 외관과 주차장 — 1층 단독건물 형태 대형 매장 부지',
  },
  {
    Icon: Users,
    label: '배후세대',
    value: '1,000세대 이상',
    desc: '안정적 유동 고객을 확보할 수 있는 주거 밀집 권역',
    // Unsplash — 조감도로 본 대규모 주거 건물군 (bird's eye view of residential buildings)
    img: 'https://images.unsplash.com/photo-1509856508843-3488c191938f?w=800&q=80&auto=format&fit=crop',
    imgAlt: '대규모 주거 단지 조감도 — 1,000세대 이상 배후세대 권역',
  },
];

const BIZ_TYPES = ['창고형 약국', '식자재마트', '아울렛·복합상가', '헬스클럽', '학원·교육센터', '의류 아울렛', '자동차 전시장'];

// Unsplash — 무료 상업 이미지 (CC0), 대형 매장 건물 전면 + 넓은 주차장 구도
const HERO_IMG = 'https://images.unsplash.com/photo-1601598851547-4302969d0614?w=1400&q=80&auto=format&fit=crop&crop=center';

const PAGE_CSS = `
  /* ── 대형매장부지 랜딩 스타일 ── */
  .ls-wrap { width: 100%; max-width: 1400px; margin: 0 auto; padding: 0 24px; box-sizing: border-box; }

  /* 히어로 분할 */
  .ls-hero-split {
    display: grid;
    grid-template-columns: 55fr 45fr;
    max-width: 1400px;
    margin: 0 auto;
    min-height: 580px;
  }
  .ls-hero-left {
    padding: 80px 56px 80px 24px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .ls-hero-right {
    position: relative;
    overflow: hidden;
  }
  .ls-hero-right img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
  }
  .ls-hero-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, rgba(17,17,17,0.7) 0%, rgba(17,17,17,0.1) 50%, transparent 100%);
    pointer-events: none;
  }

  /* 배지 */
  .ls-badge {
    display: inline-block;
    background: rgba(196,124,48,0.18);
    border: 1px solid rgba(196,124,48,0.4);
    color: #e2a06e;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2.5px;
    padding: 5px 16px;
    border-radius: 20px;
    margin-bottom: 24px;
    width: fit-content;
  }

  /* 업종 칩 */
  .ls-biz-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 24px 0 36px;
  }
  .ls-biz-chip {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.2);
    color: #ddd;
    font-size: 14px;
    font-weight: 600;
    padding: 8px 18px;
    border-radius: 24px;
  }

  /* CTA 버튼 */
  .ls-cta-btn {
    display: inline-block;
    background: #c47c30;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    padding: 14px 40px;
    border-radius: 4px;
    text-decoration: none;
    letter-spacing: 0.3px;
    transition: background 0.15s;
    width: fit-content;
  }
  .ls-cta-btn:hover { background: #a8642a; }

  /* 조건 카드 그리드 — 2×2 */
  .ls-cond-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }
  .ls-cond-card {
    background: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    transition: box-shadow 0.15s, transform 0.15s;
  }
  .ls-cond-card:hover {
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }
  .ls-cond-card-img {
    width: 100%;
    aspect-ratio: 4/3;
    object-fit: cover;
    display: block;
  }
  .ls-cond-card-body {
    padding: 24px 28px 28px;
  }
  .ls-cond-card-icon-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }
  .ls-cond-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: #fff8f2;
    border-radius: 50%;
    border: 1px solid #f0dcc8;
    flex-shrink: 0;
  }

  /* 매물 그리드 */
  .ls-prop-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  /* ── 태블릿 (768 ~ 1199px) ── */
  @media (min-width: 768px) and (max-width: 1199px) {
    .ls-hero-split { grid-template-columns: 52fr 48fr; min-height: 480px; }
    .ls-hero-left  { padding: 60px 40px 60px 20px; }
    .ls-cond-grid  { grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .ls-cond-card-body { padding: 20px 22px 24px; }
    .ls-prop-grid  { grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .ls-wrap       { padding: 0 20px; }
  }

  /* ── 모바일 (767px 이하) ── */
  @media (max-width: 767px) {
    .ls-hero-split { grid-template-columns: 1fr; min-height: auto; }
    .ls-hero-right { height: 220px; order: -1; }
    .ls-hero-overlay { background: rgba(0,0,0,0.2); }
    .ls-hero-left  { padding: 36px 20px 44px; }
    .ls-biz-chips  { gap: 8px; }
    .ls-biz-chip   { font-size: 13px; padding: 7px 15px; }
    .ls-cta-btn    { display: block; width: 100%; text-align: center; padding: 14px 20px; box-sizing: border-box; }
    .ls-cond-grid  { grid-template-columns: 1fr; gap: 14px; }
    .ls-cond-card-body { padding: 20px 20px 24px; }
    .ls-prop-grid  { grid-template-columns: 1fr; gap: 12px; }
    .ls-wrap       { padding: 0 16px; }
  }
`;

export default async function LargeStorePage() {
  const { data: props } = await supabase
    .from('properties')
    .select('*')
    .is('deleted_at', null)
    .eq('status', '거래중')
    .like('theme_type', '%대형매장부지%')
    .order('created_at', { ascending: false });

  const properties = await Promise.all(
    (props ?? []).map(async (p: any) => {
      const { data: imgs } = await supabase
        .from('property_images')
        .select('image_url')
        .eq('property_id', p.id)
        .order('order_index', { ascending: true })
        .limit(1);
      return { ...p, image: imgs?.[0]?.image_url ?? null };
    })
  );

  return (
    <main style={{ minHeight: '100vh', background: '#fafafa' }}>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

      {/* ── 히어로: 좌우 분할 ── */}
      <section style={{ background: '#111', color: '#fff' }}>
        <div className="ls-hero-split">

          {/* 좌측: 텍스트 */}
          <div className="ls-hero-left">
            <div className="ls-badge">LARGE STORE SPECIALIST</div>
            <h1 style={{
              fontSize: 'clamp(28px, 4.5vw, 50px)',
              fontWeight: 900,
              lineHeight: 1.18,
              margin: '0 0 16px',
              letterSpacing: '-0.5px',
            }}>
              대형 매장 부지<br />
              <span style={{ color: '#c47c30' }}>전문 중개</span>
            </h1>
            <p style={{ fontSize: 'clamp(14px, 1.8vw, 17px)', color: '#bbb', lineHeight: 1.7, margin: '0' }}>
              100평 이상 상가를 찾는 업체에<br />
              전국 최적 입지를 직접 발굴해 안내합니다.
            </p>

            {/* 업종 칩 */}
            <div className="ls-biz-chips">
              {BIZ_TYPES.map(b => (
                <span key={b} className="ls-biz-chip">{b}</span>
              ))}
            </div>

            <a href="tel:01086808151" className="ls-cta-btn">
              지금 문의하기
            </a>
          </div>

          {/* 우측: 이미지 */}
          <div className="ls-hero-right">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_IMG}
              alt="대형 매장 건물 전면 — 넓은 주차장을 갖춘 대형 상가 부지"
              loading="eager"
            />
            <div className="ls-hero-overlay" />
          </div>
        </div>
      </section>

      {/* ── 조건 카드 섹션 (확장) ── */}
      <section style={{ padding: '80px 0 88px', background: '#f4f4f4' }}>
        <div className="ls-wrap">
          <p style={{ fontSize: '12px', color: '#c47c30', fontWeight: 700, letterSpacing: '2px', textAlign: 'center', margin: '0 0 10px', textTransform: 'uppercase' }}>
            Location Criteria
          </p>
          <h2 style={{
            textAlign: 'center',
            fontSize: 'clamp(18px, 2.5vw, 24px)',
            fontWeight: 800,
            color: '#1a1a1a',
            margin: '0 0 8px',
            letterSpacing: '-0.3px',
          }}>
            이런 조건의 매장 부지를 <span style={{ color: '#c47c30' }}>찾아드립니다</span>
          </h2>
          <p style={{ textAlign: 'center', fontSize: '14px', color: '#888', margin: '0 0 40px', lineHeight: 1.6 }}>
            이런 곳을 직접 발굴해서 안내해 드립니다
          </p>
          <div className="ls-cond-grid">
            {CONDITIONS.map(({ Icon, label, value, desc, img, imgAlt }) => (
              <div key={label} className="ls-cond-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={imgAlt} className="ls-cond-card-img" loading="lazy" />
                <div className="ls-cond-card-body">
                  <div className="ls-cond-card-icon-row">
                    <div className="ls-cond-card-icon">
                      <Icon size={20} color="#c47c30" strokeWidth={1.8} />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#999', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
                      <div style={{ fontSize: 'clamp(16px, 1.8vw, 20px)', fontWeight: 800, color: '#1a1a1a', lineHeight: 1 }}>{value}</div>
                    </div>
                  </div>
                  <div style={{ width: '28px', height: '2px', background: '#c47c30', marginBottom: '12px' }} />
                  <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 매물 목록 섹션 (매물 있을 때만 표시) ── */}
      {properties.length > 0 && (
        <section style={{ padding: '64px 0 80px', background: '#fafafa' }}>
          <div className="ls-wrap">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
              <h2 style={{ fontSize: 'clamp(18px, 2.5vw, 20px)', fontWeight: 800, color: '#1a1a1a', margin: 0, letterSpacing: '-0.3px' }}>
                대형매장부지 매물
              </h2>
              <span style={{ background: '#c47c30', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '2px 10px', borderRadius: '12px' }}>
                {properties.length}건
              </span>
            </div>
            <div className="ls-prop-grid">
              {properties.map((p: any) => (
                <PropertyCard key={p.id} property={p} showNewBadge />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 하단 CTA ── */}
      <section style={{
        background: '#111',
        color: '#fff',
        padding: 'clamp(48px, 7vw, 80px) 20px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <p style={{ fontSize: '12px', color: '#666', margin: '0 0 10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            직접 의뢰 · 맞춤 탐색
          </p>
          <p style={{ fontSize: 'clamp(20px, 3.5vw, 26px)', fontWeight: 800, margin: '0 0 8px', color: '#fff' }}>
            원하는 조건의 대형 매장 부지,
          </p>
          <p style={{ fontSize: 'clamp(20px, 3.5vw, 26px)', fontWeight: 800, margin: '0 0 32px', color: '#c47c30' }}>
            헤르만부동산에 맡기세요
          </p>
          <a href="tel:01086808151" className="ls-cta-btn" style={{ fontSize: '16px', padding: '16px 48px' }}>
            010-8680-8151 전화 문의
          </a>
        </div>
      </section>
    </main>
  );
}
