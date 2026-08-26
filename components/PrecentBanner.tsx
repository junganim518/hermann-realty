import Link from 'next/link';

export function PrecentSidebarBanner({ className }: { className?: string }) {
  return (
    <div className={className} style={{ borderTop: '1px solid #f0f0f0' }}>
      <Link href="/properties/boramae-precent" style={{ display: 'block', textDecoration: 'none' }}>
        <div style={{ height: '140px', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '14px', gap: '5px' }}>
            <span style={{ background: '#c47c30', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', letterSpacing: '0.3px', alignSelf: 'flex-start' }}>신규 분양 임대</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>보라매역 프리센트</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>7호선·신림선 더블역세권 · B1~3F</span>
          </div>
        </div>
        <div style={{ padding: '10px 14px', background: '#1a1a1a' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '10px 0', background: '#c47c30', color: '#fff', fontSize: '14px', fontWeight: 700, borderRadius: '6px' }}>
            임대 문의하기 →
          </span>
        </div>
      </Link>
    </div>
  );
}

export function PrecentMobileBanner({ className }: { className?: string }) {
  return (
    <div className={className} style={{ display: 'none', padding: '8px 0' }}>
      <Link href="/properties/boramae-precent" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'linear-gradient(90deg, #1a1a2e, #0f3460)', borderRadius: '6px', padding: '11px 14px', textDecoration: 'none', border: '1px solid rgba(196,124,48,0.3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: '#c47c30', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>신규 임대</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#eee' }}>보라매역 프리센트 상업시설</span>
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>7호선·신림선 더블역세권 · 클리닉·F&B·오피스</span>
        </div>
        <span style={{ color: '#c47c30', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '16px' }}>›</span>
      </Link>
    </div>
  );
}
