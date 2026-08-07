import type { Metadata } from 'next';
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

const CONDITIONS = [
  { icon: '📐', label: '전용면적', value: '100평 이상' },
  { icon: '🚗', label: '주차대수', value: '30대 이상' },
  { icon: '🏢', label: '건물형태', value: '1층 · 단독건물' },
  { icon: '🏘️', label: '배후세대', value: '1,000세대 이상' },
];

export const revalidate = 3600;

export default async function LargeStorePage() {
  const { data: props } = await supabase
    .from('properties')
    .select('*')
    .is('deleted_at', null)
    .eq('status', '거래중')
    .like('theme_type', '%대형매장부지%')
    .order('created_at', { ascending: false });

  // 각 매물의 대표 이미지 조회
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

      {/* ── 히어로 섹션 ── */}
      <section style={{
        background: 'linear-gradient(135deg, #111 0%, #1e1e1e 60%, #2a1f0e 100%)',
        color: '#fff',
        padding: '80px 20px 72px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* 배경 장식 */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'repeating-linear-gradient(45deg, #c47c30 0, #c47c30 1px, transparent 0, transparent 50%)',
          backgroundSize: '24px 24px',
        }} />
        <div style={{ position: 'relative', maxWidth: '760px', margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: 'rgba(196,124,48,0.18)', border: '1px solid rgba(196,124,48,0.45)', color: '#e2a06e', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', padding: '4px 14px', borderRadius: '20px', marginBottom: '24px' }}>
            LARGE STORE SPECIALIST
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 6vw, 52px)', fontWeight: 900, lineHeight: 1.2, margin: '0 0 20px', letterSpacing: '-0.5px' }}>
            대형 매장 부지<br />
            <span style={{ color: '#c47c30' }}>전문 중개</span>
          </h1>
          <p style={{ fontSize: 'clamp(14px, 2.5vw, 18px)', color: '#ccc', lineHeight: 1.7, margin: '0 0 36px' }}>
            창고형 약국, 식자재마트, 아울렛 등<br />
            100평 이상 대형 매장에 적합한 상가를 찾아드립니다
          </p>
          <a
            href="tel:01086808151"
            style={{
              display: 'inline-block',
              background: '#c47c30',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 700,
              padding: '14px 36px',
              borderRadius: '4px',
              textDecoration: 'none',
              letterSpacing: '0.5px',
            }}
          >
            📞 지금 문의하기
          </a>
        </div>
      </section>

      {/* ── 조건 카드 섹션 ── */}
      <section style={{ padding: '56px 20px', maxWidth: '960px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '20px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 32px', letterSpacing: '-0.3px' }}>
          헤르만이 찾는 <span style={{ color: '#c47c30' }}>입지 조건</span>
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          {CONDITIONS.map(c => (
            <div key={c.label} style={{
              background: '#fff',
              border: '1px solid #e8e8e8',
              borderRadius: '8px',
              padding: '28px 20px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{c.icon}</div>
              <div style={{ fontSize: '12px', color: '#999', fontWeight: 600, letterSpacing: '1px', marginBottom: '6px', textTransform: 'uppercase' }}>{c.label}</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#1a1a1a' }}>{c.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 매물 목록 섹션 ── */}
      <section style={{ padding: '0 20px 72px', maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1a1a1a', margin: 0, letterSpacing: '-0.3px' }}>
            대형매장부지 매물
          </h2>
          {properties.length > 0 && (
            <span style={{ background: '#c47c30', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '2px 10px', borderRadius: '12px' }}>
              {properties.length}건
            </span>
          )}
        </div>

        {properties.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {properties.map((p: any) => (
              <PropertyCard key={p.id} property={p} showNewBadge />
            ))}
          </div>
        ) : (
          <div style={{
            background: '#fff',
            border: '1px solid #e8e8e8',
            borderRadius: '8px',
            padding: '56px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🏭</div>
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px' }}>
              준비 중인 매물이 더 있습니다
            </p>
            <p style={{ fontSize: '14px', color: '#666', margin: '0 0 24px', lineHeight: 1.6 }}>
              문의 주시면 조건에 맞는 대형 매장 부지를 안내드립니다
            </p>
            <a
              href="tel:01086808151"
              style={{
                display: 'inline-block',
                background: '#1a1a1a',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                padding: '12px 28px',
                borderRadius: '4px',
                textDecoration: 'none',
              }}
            >
              📞 010-8680-8151
            </a>
          </div>
        )}
      </section>

      {/* ── 하단 CTA ── */}
      <section style={{
        background: '#111',
        color: '#fff',
        padding: '48px 20px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '15px', color: '#aaa', margin: '0 0 8px' }}>
          원하는 조건의 매물을 직접 의뢰하세요
        </p>
        <p style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 24px', color: '#e2a06e' }}>
          헤르만부동산 010-8680-8151
        </p>
        <a
          href="tel:01086808151"
          style={{
            display: 'inline-block',
            background: '#c47c30',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 700,
            padding: '12px 32px',
            borderRadius: '4px',
            textDecoration: 'none',
          }}
        >
          전화 문의
        </a>
      </section>
    </main>
  );
}
