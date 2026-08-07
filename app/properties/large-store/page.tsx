import type { Metadata } from 'next';
import { Ruler, Car, Building2, Users, Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PropertyCard from '@/components/PropertyCard';

export const metadata: Metadata = {
  title: '대형 매장 부지 전문 중개 | 헤르만부동산',
  description:
    '창고형 약국, 식자재마트, 아울렛 등 100평 이상 대형 상가 임대 전문 중개. 넓은 주차 공간과 1층 단독 건물을 갖춘 대형매장부지를 헤르만부동산이 찾아드립니다.',
  openGraph: {
    title: '대형 매장 부지 전문 중개 | 헤르만부동산',
    description:
      '창고형 약국, 식자재마트, 아울렛 등 100평 이상 대형 상가 임대. 부천·인천 지역 대형매장부지 전문 중개.',
    url: 'https://hermann-realty.com/properties/large-store',
  },
};

export const revalidate = 3600;

const CONDITIONS = [
  { Icon: Ruler,     label: '전용면적', value: '100평 이상' },
  { Icon: Car,       label: '주차대수', value: '30대 이상' },
  { Icon: Building2, label: '건물형태', value: '1층 · 단독건물' },
  { Icon: Users,     label: '배후세대', value: '1,000세대 이상' },
];

const PAGE_CSS = `
  /* ── 대형매장부지 랜딩 스타일 ── */
  .ls-wrap    { width: 100%; max-width: 1400px; margin: 0 auto; padding: 0 24px; box-sizing: border-box; }
  .ls-hero-inner { max-width: 820px; margin: 0 auto; position: relative; }

  /* 조건 카드 그리드: PC 기본 4열 */
  .ls-cond-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  /* 매물 그리드: 기본 3열 */
  .ls-prop-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  /* CTA 버튼 */
  .ls-cta-btn {
    display: inline-block;
    background: #c47c30;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    padding: 14px 40px;
    border-radius: 4px;
    text-decoration: none;
    letter-spacing: 0.5px;
    transition: background 0.15s;
  }
  .ls-cta-btn:hover { background: #a8642a; }

  .ls-cta-btn-dark {
    display: inline-block;
    background: #1a1a1a;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    padding: 12px 32px;
    border-radius: 4px;
    text-decoration: none;
    transition: background 0.15s;
  }
  .ls-cta-btn-dark:hover { background: #333; }

  /* ── 태블릿 (768px ~ 1199px) ── */
  @media (max-width: 1199px) {
    .ls-cond-grid { grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .ls-prop-grid  { grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .ls-wrap { padding: 0 20px; }
  }

  /* ── 모바일 (767px 이하) ── */
  @media (max-width: 767px) {
    .ls-cond-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .ls-prop-grid  { grid-template-columns: 1fr; gap: 12px; }
    .ls-wrap { padding: 0 16px; }
    .ls-cta-btn {
      display: block;
      width: 100%;
      text-align: center;
      padding: 14px 20px;
      box-sizing: border-box;
    }
    .ls-hero-text { font-size: clamp(24px, 8vw, 38px) !important; }
    .ls-hero-sub  { font-size: 14px !important; }
    .ls-section-pad { padding: 36px 0 !important; }
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

      {/* ── 히어로 섹션 ── */}
      <section style={{
        background: 'linear-gradient(135deg, #111 0%, #1e1e1e 60%, #2a1f0e 100%)',
        color: '#fff',
        padding: 'clamp(56px, 8vw, 96px) 20px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'repeating-linear-gradient(45deg, #c47c30 0, #c47c30 1px, transparent 0, transparent 50%)',
          backgroundSize: '24px 24px',
        }} />
        <div className="ls-hero-inner">
          <div style={{
            display: 'inline-block',
            background: 'rgba(196,124,48,0.18)',
            border: '1px solid rgba(196,124,48,0.45)',
            color: '#e2a06e',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '2.5px',
            padding: '5px 16px',
            borderRadius: '20px',
            marginBottom: '28px',
          }}>
            LARGE STORE SPECIALIST
          </div>
          <h1
            className="ls-hero-text"
            style={{
              fontSize: 'clamp(32px, 5.5vw, 56px)',
              fontWeight: 900,
              lineHeight: 1.18,
              margin: '0 0 22px',
              letterSpacing: '-0.5px',
            }}
          >
            대형 매장 부지<br />
            <span style={{ color: '#c47c30' }}>전문 중개</span>
          </h1>
          <p
            className="ls-hero-sub"
            style={{
              fontSize: 'clamp(15px, 2.2vw, 19px)',
              color: '#ccc',
              lineHeight: 1.7,
              margin: '0 0 40px',
            }}
          >
            창고형 약국, 식자재마트, 아울렛 등<br />
            100평 이상 대형 매장에 적합한 상가를 찾아드립니다
          </p>
          <a href="tel:01086808151" className="ls-cta-btn">
            지금 문의하기
          </a>
        </div>
      </section>

      {/* ── 조건 카드 섹션 ── */}
      <section className="ls-section-pad" style={{ padding: '64px 0' }}>
        <div className="ls-wrap">
          <h2 style={{
            textAlign: 'center',
            fontSize: 'clamp(18px, 2.5vw, 22px)',
            fontWeight: 800,
            color: '#1a1a1a',
            margin: '0 0 36px',
            letterSpacing: '-0.3px',
          }}>
            헤르만이 찾는 <span style={{ color: '#c47c30' }}>입지 조건</span>
          </h2>
          <div className="ls-cond-grid">
            {CONDITIONS.map(({ Icon, label, value }) => (
              <div key={label} style={{
                background: '#fff',
                border: '1px solid #e8e8e8',
                borderRadius: '8px',
                padding: '32px 20px 28px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '48px',
                  height: '48px',
                  background: '#fff8f2',
                  borderRadius: '50%',
                  margin: '0 auto 16px',
                }}>
                  <Icon size={22} color="#c47c30" strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: '11px', color: '#999', fontWeight: 600, letterSpacing: '1px', marginBottom: '6px', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 'clamp(15px, 2vw, 18px)', fontWeight: 800, color: '#1a1a1a' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 매물 목록 섹션 ── */}
      <section style={{ padding: '0 0 80px' }}>
        <div className="ls-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: 'clamp(18px, 2.5vw, 20px)', fontWeight: 800, color: '#1a1a1a', margin: 0, letterSpacing: '-0.3px' }}>
              대형매장부지 매물
            </h2>
            {properties.length > 0 && (
              <span style={{ background: '#c47c30', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '2px 10px', borderRadius: '12px' }}>
                {properties.length}건
              </span>
            )}
          </div>

          {properties.length > 0 ? (
            <div className="ls-prop-grid">
              {properties.map((p: any) => (
                <PropertyCard key={p.id} property={p} showNewBadge />
              ))}
            </div>
          ) : (
            <div style={{
              background: '#fff',
              border: '1px solid #e8e8e8',
              borderRadius: '8px',
              padding: '64px 24px',
              textAlign: 'center',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                background: '#f5f0eb',
                borderRadius: '50%',
                margin: '0 auto 20px',
              }}>
                <Store size={28} color="#c47c30" strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: '17px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px' }}>
                준비 중인 매물이 더 있습니다
              </p>
              <p style={{ fontSize: '14px', color: '#666', margin: '0 0 28px', lineHeight: 1.6 }}>
                문의 주시면 조건에 맞는 대형 매장 부지를 안내드립니다
              </p>
              <a href="tel:01086808151" className="ls-cta-btn-dark">
                010-8680-8151
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── 하단 CTA ── */}
      <section style={{
        background: '#111',
        color: '#fff',
        padding: 'clamp(40px, 6vw, 64px) 20px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <p style={{ fontSize: '14px', color: '#888', margin: '0 0 8px', letterSpacing: '0.5px' }}>
            원하는 조건의 매물을 직접 의뢰하세요
          </p>
          <p style={{ fontSize: 'clamp(18px, 3.5vw, 24px)', fontWeight: 800, margin: '0 0 28px', color: '#e2a06e' }}>
            헤르만부동산 010-8680-8151
          </p>
          <a href="tel:01086808151" className="ls-cta-btn">
            전화 문의
          </a>
        </div>
      </section>
    </main>
  );
}
