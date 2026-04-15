'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isNewProperty } from '@/lib/isNewProperty';

const normalizeAddr = (addr: string) =>
  addr.replace(/^경기\s/, '경기도 ').replace(/^서울\s/, '서울특별시 ');

const splitAddress = (address: string): { line1: string; line2: string } => {
  if (!address) return { line1: '', line2: '' };
  const n = normalizeAddr(address);
  const road = n.match(/^(.*?(?:시|군))\s+((?:\S+구\s+)?(\S+(?:로|길)))/);
  if (road) return { line1: road[1], line2: road[2].trim() };
  const dong = n.match(/^(.*?(?:시|군))\s+((?:\S+구\s+)?\S*[가-힣]동)/);
  if (dong) return { line1: dong[1], line2: dong[2] };
  return { line1: n, line2: '' };
};

const formatAddress = (addr: string) => {
  const { line1, line2 } = splitAddress(addr);
  return [line1, line2].filter(Boolean).join(' ');
};

const formatPrice = (v: number) => {
  if (!v) return '-';
  const uk = Math.floor(v / 10000);
  const man = v % 10000;
  if (uk > 0) return man > 0 ? `${uk}억 ${man.toLocaleString()}만원` : `${uk}억`;
  return `${v.toLocaleString()}만원`;
};

const buildPriceStr = (p: any) => {
  if (p.transaction_type === '매매') {
    const v = p.sale_price || p.deposit;
    return v ? `매매가 ${formatPrice(v)}` : '-';
  }
  const parts = [
    p.deposit ? `보증금 ${formatPrice(p.deposit)}` : null,
    p.monthly_rent ? `월세 ${formatPrice(p.monthly_rent)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '-';
};

const toPyeong = (sqm: number) => (sqm * 0.3025).toFixed(1);

const CARD_CSS = `
  .prop-card-mobile { display: block; }
  .prop-card-content-row { display: block; }

  @media (max-width: 1199px) {
    .prop-card-img { height: 200px !important; }
  }

  @media (max-width: 767px) {
    .prop-card-mobile { display: flex !important; flex-direction: column !important; }
    .prop-card-mobile .prop-card-header { display: flex !important; padding: 6px 10px !important; }
    .prop-card-mobile .prop-card-content-row { display: flex !important; flex-direction: row !important; }
    .prop-card-mobile .prop-card-img-wrap { width: 120px !important; min-width: 120px !important; height: 100px !important; flex-shrink: 0 !important; }
    .prop-card-mobile .prop-card-img { width: 100% !important; height: 100px !important; }
    .prop-card-mobile .prop-card-body { flex: 1 !important; padding: 8px 10px !important; display: flex !important; flex-direction: column !important; justify-content: center !important; }
    .prop-card-mobile .prop-card-body .prop-addr { font-size: 12px !important; }
    .prop-card-mobile .prop-card-body .prop-meta { font-size: 12px !important; }
    .prop-card-mobile .prop-card-body .prop-price { font-size: 14px !important; font-weight: 700 !important; }
    .prop-card-mobile .prop-badge { font-size: 10px !important; }
    .prop-card-header { padding: 5px 8px !important; }
    .prop-card-header span { font-size: 11px !important; }
    .prop-card-img { height: 100px !important; }
    .prop-card-body { padding: 6px 8px !important; }
    .prop-card-body .prop-addr { font-size: 11px !important; }
    .prop-card-body .prop-meta { font-size: 11px !important; }
    .prop-card-body .prop-price { font-size: 13px !important; }
    .prop-card-body .prop-badge { font-size: 9px !important; padding: 1px 5px !important; }
    .prop-sold { font-size: 16px !important; padding: 2px 10px !important; }
  }
`;

let styleInjected = false;
function injectStyleOnce() {
  if (typeof document === 'undefined' || styleInjected) return;
  styleInjected = true;
  const el = document.createElement('style');
  el.setAttribute('data-property-card-css', '');
  el.textContent = CARD_CSS;
  document.head.appendChild(el);
}

interface PropertyCardProps {
  property: any;
  isAdmin?: boolean;
  showNewBadge?: boolean;
}

export default function PropertyCard({ property, isAdmin = false, showNewBadge = true }: PropertyCardProps) {
  const p = property;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    injectStyleOnce();
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <Link
      href={`/item/view/${p.property_number}`}
      style={{ textDecoration: 'none', display: 'block', transition: 'all 0.2s ease', cursor: 'pointer', backgroundColor: '#fff', color: '#1a1a1a' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
      className="prop-card-mobile border border-gray-200 overflow-hidden"
    >
      <div className="prop-card-header" style={{ padding: isMobile ? '2px 8px' : '8px 12px', background: '#e2a06e' }} />
      <div className="prop-card-content-row">
        <div className="prop-card-img-wrap">
          <div className="prop-card-img relative" style={{ height: '260px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'rgba(100,100,100,0.6)', color: '#fff', fontSize: isMobile ? '10px' : '12px', fontWeight: 600, padding: isMobile ? '0 6px' : '3px 8px', borderRadius: '4px', zIndex: 2 }}>
              {p.property_number}
            </div>
            {showNewBadge && isNewProperty(p.created_at) && (
              <div style={{ position: 'absolute', top: 0, right: 0, width: isMobile ? '60px' : '80px', height: isMobile ? '30px' : '80px', overflow: 'hidden', pointerEvents: 'none', zIndex: 3 }}>
                <div style={{ position: 'absolute', top: isMobile ? '7px' : '14px', right: isMobile ? '-14px' : '-24px', transform: 'rotate(45deg)', background: '#e05050', color: '#fff', textAlign: 'center', padding: isMobile ? '0' : '3px 0', width: isMobile ? '108px' : '100px', fontSize: isMobile ? '7px' : '11px', fontWeight: 700, letterSpacing: isMobile ? '0.5px' : '1px', boxShadow: '0 2px 4px rgba(0,0,0,0.25)' }}>
                  NEW
                </div>
              </div>
            )}
            {p.image ? (
              <>
                <img src={p.image} alt="매물 이미지" className="w-full h-full object-cover" />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', overflow: 'hidden' }}>
                  <span style={{ color: '#e2a06e', fontSize: isMobile ? '8px' : 'clamp(10px, 2vw, 18px)', fontWeight: 300, letterSpacing: isMobile ? '1px' : 'clamp(2px, 0.5vw, 6px)', fontFamily: 'Georgia, "Times New Roman", serif', opacity: 0.45, whiteSpace: 'nowrap' }}>HERMANN REALTY</span>
                  <span style={{ color: '#e2a06e', fontSize: isMobile ? '6px' : 'clamp(8px, 1.2vw, 10px)', letterSpacing: isMobile ? '0.5px' : 'clamp(1px, 0.3vw, 3px)', marginTop: isMobile ? '1px' : '4px', opacity: 0.45, whiteSpace: 'nowrap' }}>헤르만부동산</span>
                </div>
              </>
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', overflow: 'hidden' }}>
                <span style={{ color: '#e2a06e', fontSize: isMobile ? '8px' : 'clamp(10px, 2vw, 18px)', fontWeight: 300, letterSpacing: isMobile ? '1px' : 'clamp(2px, 0.5vw, 6px)', fontFamily: 'Georgia, "Times New Roman", serif', opacity: 0.7, whiteSpace: 'nowrap' }}>HERMANN REALTY</span>
                <span style={{ color: '#e2a06e', fontSize: isMobile ? '6px' : 'clamp(8px, 1.2vw, 10px)', letterSpacing: isMobile ? '0.5px' : 'clamp(1px, 0.3vw, 3px)', marginTop: isMobile ? '1px' : '4px', opacity: 0.5, whiteSpace: 'nowrap' }}>헤르만부동산</span>
              </div>
            )}
            {p.is_sold && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="prop-sold" style={{ color: '#fff', fontSize: '24px', fontWeight: 800, letterSpacing: '3px', border: '2px solid #fff', padding: '4px 16px', borderRadius: '4px', transform: 'rotate(-15deg)' }}>거래완료</span>
              </div>
            )}
          </div>
        </div>
        <div className="prop-card-body p-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            {p.transaction_type && (() => {
              const colors: Record<string, { bg: string; border: string; text: string }> = {
                '월세': { bg: '#fff8f2', border: '#e2a06e', text: '#e2a06e' },
                '전세': { bg: '#eef4ff', border: '#4a80e8', text: '#4a80e8' },
                '매매': { bg: '#fff0f0', border: '#e05050', text: '#e05050' },
              };
              const c = colors[p.transaction_type] ?? { bg: '#f5f5f5', border: '#999', text: '#999' };
              return (
                <span className="prop-badge" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '11px', fontWeight: 700, padding: isMobile ? '0px 4px' : '2px 8px', borderRadius: '3px', flexShrink: 0 }}>
                  {p.transaction_type}
                </span>
              );
            })()}
            <span style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: '#1a1a1a' }}>{buildPriceStr(p)}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '2px', marginBottom: '2px', flexWrap: 'wrap', alignItems: 'center' }}>
            {p.premium ? (
              <span style={{ fontSize: '14px', color: '#e05050', fontWeight: 600 }}>권리금 {isAdmin ? formatPrice(p.premium) : '협의'}</span>
            ) : (
              <span style={{ fontSize: '14px', color: '#e05050', fontWeight: 600 }}>무권리</span>
            )}
            {p.maintenance_fee && p.maintenance_fee !== 0 ? (
              <span style={{ fontSize: '13px', color: '#888' }}>관리비 {formatPrice(p.maintenance_fee)}</span>
            ) : (
              <span style={{ fontSize: '13px', color: '#888' }}>관리비 -</span>
            )}
          </div>
          <p className="prop-addr" style={{ fontSize: '13px', color: '#666', margin: isMobile ? '0' : '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isAdmin ? normalizeAddr(p.address ?? '') : formatAddress(p.address ?? '')}
            {isAdmin && (p.building_name || p.unit_number) && (
              <span style={{ fontSize: '11px', color: '#e2a06e', marginLeft: '4px' }}>
                {[p.building_name, p.unit_number].filter(Boolean).join(' ')}
              </span>
            )}
          </p>
          <p className="prop-meta" style={{ fontSize: '13px', color: '#666', marginBottom: isMobile ? '0' : '4px' }}>
            {[p.property_type, p.exclusive_area ? `전용 ${p.exclusive_area}㎡ (${toPyeong(parseFloat(p.exclusive_area))}평)` : null, p.current_floor ? `${p.current_floor}층` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
    </Link>
  );
}
