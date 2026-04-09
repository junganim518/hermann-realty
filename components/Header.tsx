'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchDrop, setSearchDrop] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const navItems = [
    { label: '매물검색', href: '/map' },
    { label: '매물 의뢰하기', href: '#' },
    { label: '부동산 소식', href: '#' },
    { label: '공지사항', href: '#' },
    { label: '회사소개', href: '#' },
  ];

  return (
    <header style={{ width: '100%', position: 'sticky', top: 0, zIndex: 1000 }}>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .h-phone { display: none !important; }
          .h-auth-desktop { display: none !important; }
          .h-nav-desktop { display: none !important; }
          .h-hamburger { display: flex !important; }
          .h-logo-bar { padding: 0 16px !important; height: 64px !important; }
          .h-logo-text { font-size: 22px !important; }
          .h-logo-img { width: 36px !important; height: 36px !important; }
          .h-logo-sub { display: none !important; }
        }
        @media (min-width: 769px) {
          .h-hamburger { display: none !important; }
        }
      ` }} />

      {/* ── 로고 바 ── */}
      <div
        className="h-logo-bar"
        style={{
          background: '#111', height: '90px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 clamp(16px, calc(50% - 560px), 500px)',
          borderBottom: '1px solid #333',
        }}
      >
        {/* 좌: 전화번호 */}
        <div className="h-phone" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
          <span style={{ color: '#999', fontSize: '17px', fontWeight: 700 }}>☎ 문의</span>
          <span style={{ color: '#e2a06e', fontSize: '17px', fontWeight: 700 }}>010-8680-8151</span>
        </div>

        {/* 중앙: 로고 */}
        <a href="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img className="h-logo-img" src="/logo.png" alt="로고" style={{ width: '52px', height: '52px', objectFit: 'contain' }} />
            <span className="h-logo-text" style={{ fontSize: '32px', fontWeight: 700, color: '#e2a06e' }}>헤르만부동산</span>
          </div>
          <div className="h-logo-sub" style={{ fontSize: '12px', letterSpacing: '0.2em', color: '#999' }}>REAL ESTATE & INVESTMENTS</div>
        </a>

        {/* 우: 로그인 (데스크톱) */}
        <div className="h-auth-desktop" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', justifyContent: 'flex-end' }}>
          {user ? (
            <>
              <a href="/admin/properties/new" style={{ background: '#e2a06e', color: '#fff', fontSize: '13px', fontWeight: 600, padding: '6px 14px', borderRadius: '4px', textDecoration: 'none' }}>매물 등록</a>
              <button onClick={handleLogout} style={{ color: '#999', fontSize: '17px', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>로그아웃</button>
            </>
          ) : (
            <a href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ color: '#999', fontSize: '17px', fontWeight: 700, textDecoration: 'none' }}>로그인</a>
          )}
        </div>

        {/* 햄버거 (모바일) */}
        <button
          className="h-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: '#999' }}
          aria-label="메뉴"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            }
          </svg>
        </button>
      </div>

      {/* ── 네비게이션 바 (데스크톱) ── */}
      <nav
        className="h-nav-desktop"
        style={{ background: '#fff', borderBottom: '1px solid #ddd', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '56px' }}
      >
        {navItems.map((item) =>
          item.label === '매물검색' ? (
            <div
              key={item.label}
              style={{ position: 'relative', paddingBottom: '10px', marginBottom: '-10px' }}
              onMouseEnter={() => setSearchDrop(true)}
              onMouseLeave={() => setSearchDrop(false)}
            >
              <span
                style={{ fontSize: '18px', fontWeight: 500, color: searchDrop ? '#e2a06e' : '#333', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.2s' }}
              >
                매물검색 ▾
              </span>
              {searchDrop && (
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', paddingTop: '4px', zIndex: 100 }}>
                  <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: '160px' }}>
                    <a href="/map" style={{ display: 'block', padding: '12px 20px', fontSize: '15px', color: '#333', textDecoration: 'none', borderBottom: '1px solid #f0f0f0' }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.background = '#fff8f2'; (e.target as HTMLElement).style.color = '#e2a06e'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.background = '#fff'; (e.target as HTMLElement).style.color = '#333'; }}
                    >지도검색</a>
                    <a href="/properties" style={{ display: 'block', padding: '12px 20px', fontSize: '15px', color: '#333', textDecoration: 'none' }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.background = '#fff8f2'; (e.target as HTMLElement).style.color = '#e2a06e'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.background = '#fff'; (e.target as HTMLElement).style.color = '#333'; }}
                    >전체매물검색</a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <a
              key={item.label}
              href={item.href}
              style={{ fontSize: '18px', fontWeight: 500, color: '#333', textDecoration: 'none', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = '#e2a06e'}
              onMouseLeave={e => (e.target as HTMLElement).style.color = '#333'}
            >
              {item.label}
            </a>
          )
        )}
      </nav>

      {/* ── 모바일 드로어 메뉴 ── */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.5)',
        }} onClick={() => setMenuOpen(false)}>
          <div
            style={{
              position: 'absolute', top: 0, right: 0,
              width: '280px', height: '100%',
              background: '#111', overflowY: 'auto',
              boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #333' }}>
              <span style={{ color: '#e2a06e', fontSize: '18px', fontWeight: 700 }}>메뉴</span>
              <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '24px', lineHeight: 1 }}>×</button>
            </div>

            {/* 메뉴 항목 */}
            {navItems.map((item) =>
              item.label === '매물검색' ? (
                <div key={item.label}>
                  <button
                    onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '16px 20px', fontSize: '16px', fontWeight: 500, color: '#ccc', background: 'none', border: 'none', borderBottom: '1px solid #222', cursor: 'pointer', textAlign: 'left' }}
                  >
                    매물검색
                    <span style={{ fontSize: '12px', color: '#888' }}>{mobileSearchOpen ? '∧' : '∨'}</span>
                  </button>
                  {mobileSearchOpen && (
                    <div style={{ background: '#1a1a1a' }}>
                      <a href="/map" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 20px 12px 36px', fontSize: '15px', color: '#e2a06e', textDecoration: 'none', borderBottom: '1px solid #222' }}>지도검색</a>
                      <a href="/properties" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 20px 12px 36px', fontSize: '15px', color: '#e2a06e', textDecoration: 'none', borderBottom: '1px solid #222' }}>전체매물검색</a>
                    </div>
                  )}
                </div>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '16px 20px', fontSize: '16px', fontWeight: 500, color: '#ccc', textDecoration: 'none', borderBottom: '1px solid #222' }}
                >
                  {item.label}
                </a>
              )
            )}

            {/* 전화번호 */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #222' }}>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>대표전화</p>
              <a href="tel:01086808151" style={{ fontSize: '20px', fontWeight: 700, color: '#e2a06e', textDecoration: 'none' }}>010-8680-8151</a>
            </div>

            {/* 로그인/로그아웃 */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {user ? (
                <>
                  <a href="/admin/properties/new" onClick={() => setMenuOpen(false)} style={{ display: 'block', background: '#e2a06e', color: '#fff', fontSize: '15px', fontWeight: 600, padding: '10px 0', borderRadius: '6px', textDecoration: 'none', textAlign: 'center' }}>매물 등록</a>
                  <button onClick={() => { handleLogout(); setMenuOpen(false); }} style={{ color: '#999', fontSize: '15px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>로그아웃</button>
                </>
              ) : (
                <a href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ color: '#e2a06e', fontSize: '15px', fontWeight: 600, textDecoration: 'none' }}>로그인</a>
              )}
            </div>
          </div>
        </div>
      )}

    </header>
  );
}
