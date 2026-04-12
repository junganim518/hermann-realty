'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const navItems = [
    { label: '지도검색', href: '/map' },
    { label: '전체매물', href: '/properties' },
    { label: '매물 의뢰하기', href: '/inquiry' },
    { label: '부동산 소식', href: '/news' },
    { label: '회사소개', href: '/about' },
  ];

  return (
    <header style={{ width: '100%', position: 'sticky', top: 0, zIndex: 1000 }}>

      <style dangerouslySetInnerHTML={{ __html: `
        .h-bottom-tab { display: none; }
        @media (max-width: 767px) {
          .h-phone { display: none !important; }
          .h-auth-desktop { display: none !important; }
          .h-nav-desktop { display: none !important; }
          .h-hamburger { display: none !important; }
          .h-logo-bar { padding: 0 16px !important; height: 64px !important; }
          .h-logo-text { font-size: 22px !important; }
          .h-logo-img { width: 36px !important; height: 36px !important; }
          .h-logo-sub { display: none !important; }
          .h-mobile-login { display: flex !important; }
          .h-bottom-tab { display: flex !important; }
          body { padding-bottom: 60px !important; }
        }
        @media (min-width: 768px) and (max-width: 1199px) {
          .h-hamburger { display: none !important; }
          .h-bottom-tab { display: none !important; }
          .h-auth-desktop { display: none !important; }
          .h-mobile-login { display: flex !important; }
          .h-phone { display: flex !important; }
          .h-logo-bar { padding: 0 20px !important; height: 76px !important; }
          .h-logo-text { font-size: 26px !important; }
          .h-logo-img { width: 42px !important; height: 42px !important; }
          .h-nav-desktop { gap: 24px !important; height: 48px !important; }
          .h-nav-desktop a { font-size: 15px !important; }
          .h-logo-center { position: absolute !important; left: 50% !important; transform: translateX(-50%) !important; }
        }
        @media (min-width: 1200px) {
          .h-hamburger { display: none !important; }
          .h-bottom-tab { display: none !important; }
          .h-mobile-login { display: none !important; }
        }
      ` }} />

      {/* ── 로고 바 ── */}
      <div
        className="h-logo-bar"
        style={{
          background: '#111', height: '90px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' as const,
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
        <a className="h-logo-center" href="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img className="h-logo-img" src="/logo.png" alt="로고" style={{ width: '52px', height: '52px', objectFit: 'contain' }} />
            <span className="h-logo-text" style={{ fontSize: '32px', fontWeight: 700, color: '#e2a06e' }}>헤르만부동산</span>
          </div>
          <div className="h-logo-sub" style={{ fontSize: '12px', letterSpacing: '0.2em', color: '#999' }}>REAL ESTATE & INVESTMENTS</div>
        </a>

        {/* 우: 유저 메뉴 (모바일) */}
        <div ref={userMenuRef} className="h-mobile-login" style={{ display: 'none', alignItems: 'center', position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '4px' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#aaaaaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </button>
          {isUserMenuOpen && (
            <div style={{
              position: 'absolute', top: '50px', right: 0,
              background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
              minWidth: '160px', overflow: 'hidden', zIndex: 100,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}>
              {user ? (
                <>
                  <a href="/admin/properties/new" onClick={() => setIsUserMenuOpen(false)}
                    style={{ display: 'block', padding: '12px 20px', fontSize: '14px', color: '#fff', textDecoration: 'none', borderBottom: '1px solid #333' }}>
                    매물등록
                  </a>
                  <a href="/admin/inquiries" onClick={() => setIsUserMenuOpen(false)}
                    style={{ display: 'block', padding: '12px 20px', fontSize: '14px', color: '#fff', textDecoration: 'none', borderBottom: '1px solid #333' }}>
                    의뢰 확인
                  </a>
                  <button type="button" onClick={() => { handleLogout(); setIsUserMenuOpen(false); }}
                    style={{ display: 'block', width: '100%', padding: '12px 20px', fontSize: '14px', color: '#ef5350', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    로그아웃
                  </button>
                </>
              ) : (
                <a href={`/login?redirect=${encodeURIComponent(pathname)}`} onClick={() => setIsUserMenuOpen(false)}
                  style={{ display: 'block', padding: '12px 20px', fontSize: '14px', color: '#fff', textDecoration: 'none' }}>
                  로그인
                </a>
              )}
            </div>
          )}
        </div>

        {/* 우: 로그인 (데스크톱) */}
        <div className="h-auth-desktop" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', justifyContent: 'flex-end' }}>
          {user ? (
            <>
              <a href="/admin/properties/new" style={{ background: '#e2a06e', color: '#fff', fontSize: '13px', fontWeight: 600, padding: '6px 14px', borderRadius: '4px', textDecoration: 'none' }}>매물 등록</a>
              <a href="/admin/inquiries" style={{ background: '#fff', color: '#e2a06e', fontSize: '13px', fontWeight: 600, padding: '6px 14px', borderRadius: '4px', textDecoration: 'none', border: '1px solid #e2a06e' }}>의뢰 목록</a>
              <button onClick={handleLogout} style={{ color: '#999', fontSize: '17px', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>로그아웃</button>
            </>
          ) : (
            <a href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ color: '#999', fontSize: '17px', fontWeight: 700, textDecoration: 'none' }}>로그인</a>
          )}
        </div>

      </div>

      {/* ── 네비게이션 바 (데스크톱) ── */}
      <nav
        className="h-nav-desktop"
        style={{ background: '#fff', borderBottom: '1px solid #ddd', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '56px' }}
      >
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            style={{ fontSize: '18px', fontWeight: 500, color: '#333', textDecoration: 'none', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = '#e2a06e'}
            onMouseLeave={e => (e.target as HTMLElement).style.color = '#333'}
          >
            {item.label}
          </a>
        ))}
      </nav>

      {/* ── 하단 탭바 (모바일) ── */}
      <nav
        className="h-bottom-tab"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: '#1a1a1a',
          borderTop: '1px solid #333',
          display: 'none',
          alignItems: 'center',
          zIndex: 9999,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {[
          { icon: '🏠', label: '홈', href: '/' },
          { icon: '🗺️', label: '지도', href: '/map' },
          { icon: '🏢', label: '매물', href: '/properties' },
          { icon: '📰', label: '소식', href: '/news' },
          { icon: '📝', label: '의뢰', href: '/inquiry' },
          { icon: 'ℹ️', label: '소개', href: '/about' },
        ].map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
          return (
            <a
              key={tab.label}
              href={tab.href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                textDecoration: 'none',
                color: active ? '#e2a06e' : '#888',
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ fontSize: '9px', fontWeight: active ? 700 : 400 }}>{tab.label}</span>
            </a>
          );
        })}
      </nav>

    </header>
  );
}
