import Link from 'next/link';

export function LargeStoreSidebarBanner({ className }: { className?: string }) {
  return (
    <div className={className} style={{ borderTop: '1px solid #f0f0f0' }}>
      <Link href="/properties/large-store" style={{ display: 'block', textDecoration: 'none' }}>
        <div style={{ height: '140px', backgroundImage: 'url(https://images.unsplash.com/photo-1644079446600-219068676743?w=600&q=80)', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '14px', gap: '6px' }}>
            <span style={{ background: '#c47c30', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', letterSpacing: '0.3px', alignSelf: 'flex-start' }}>대형 매장 부지 전문</span>
            <span style={{ fontSize: '17px', fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>100평+ 매장 부지 찾기</span>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>창고형 약국 · 식자재마트 · 아울렛</span>
          </div>
        </div>
        <div style={{ padding: '10px 14px', background: '#1a1a1a' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '10px 0', background: '#c47c30', color: '#fff', fontSize: '14px', fontWeight: 700, borderRadius: '6px' }}>
            전용페이지 보기 →
          </span>
        </div>
      </Link>
    </div>
  );
}

export function LargeStoreMobileBanner({ className }: { className?: string }) {
  return (
    <div className={className} style={{ display: 'none', padding: '8px 0' }}>
      <Link href="/properties/large-store" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#1a1a1a', borderRadius: '6px', padding: '11px 14px', textDecoration: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#c47c30', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>대형 매장 부지 전문</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#eee' }}>100평+ 상가 부지 전문 페이지</span>
        </div>
        <span style={{ color: '#c47c30', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '16px' }}>›</span>
      </Link>
    </div>
  );
}
