'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
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

  const navItems = ['매물검색', '매물 의뢰하기', '부동산 소식', '공지사항', '회사소개'];

  return (
    <header style={{ width: '100%', position: 'sticky', top: 0, zIndex: 1000 }}>

      <style>{`
        @media (max-width: 1024px) {
          .header-left { display: none !important; }
          .header-right { display: none !important; }
          .header-hamburger { display: flex !important; }
          .header-logo-bar { padding: 0 20px !important; }
        }
        @media (min-width: 1025px) {
          .header-hamburger { display: none !important; }
          .header-mobile-menu { display: none !important; }
        }
        @media (max-width: 768px) {
          .header-logo span { font-size: 22px !important; }
          .header-logo img { width: 36px !important; height: 36px !important; }
          .header-nav { gap: 20px !important; }
          .header-nav a { font-size: 13px !important; }
        }
      `}</style>

      {/* 로고 바 - 3열 구조 */}
      <div
        className="header-logo-bar"
        style={{
          background: '#111111',
          height: '90px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(16px, calc(50% - 560px), 500px)',
          borderBottom: '1px solid #333'
        }}
      >

        {/* 좌측: 문의 전화 */}
        <div
          className="header-left"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#999', fontSize: '17px', fontWeight: '700', minWidth: '220px' }}
        >
          <span>☎ 문의</span>
          <span style={{ color: '#e2a06e', fontWeight: '700', fontSize: '17px' }}>010-8680-8151</span>
        </div>

        {/* 중앙: 로고 */}
        <a
          href="/"
          className="header-logo"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="로고" style={{ width: '52px', height: '52px', objectFit: 'contain' }} />
            <span style={{ fontSize: '32px', fontWeight: '700', color: '#e2a06e' }}>헤르만부동산</span>
          </div>
          <div style={{ fontSize: '12px', letterSpacing: '0.2em', color: '#999' }}>REAL ESTATE & INVESTMENTS</div>
        </a>

        {/* 우측: 링크들 */}
        <div
          className="header-right"
          style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', justifyContent: 'flex-end' }}
        >
          {user ? (
            <button onClick={handleLogout} style={{ color: '#999', fontSize: '17px', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer' }}>로그아웃</button>
          ) : (
            <a href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ color: '#999', fontSize: '17px', fontWeight: '700', textDecoration: 'none' }}>로그인</a>
          )}
        </div>

        {/* 햄버거 버튼 */}
        <button
          className="header-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: '#999' }}
          aria-label="메뉴"
        >
          {menuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>

      </div>

      {/* 네비게이션 바 */}
      <nav
        className="header-nav"
        style={{ background: '#ffffff', borderBottom: '1px solid #dddddd', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '56px' }}
      >
        {navItems.map((menu) => (
          <a
            key={menu}
            href={menu === '매물검색' ? '/map' : '#'}
            style={{ fontSize: '18px', fontWeight: '500', color: '#333333', textDecoration: 'none', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = '#e2a06e'}
            onMouseLeave={e => (e.target as HTMLElement).style.color = '#333333'}
          >
            {menu}
          </a>
        ))}
      </nav>

      {/* 모바일 메뉴 */}
      {menuOpen && (
        <div className="header-mobile-menu" style={{ background: '#111', borderTop: '1px solid #333' }}>
          {navItems.map((menu) => (
            <a
              key={menu}
              href="#"
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'block',
                padding: '14px 20px',
                fontSize: '16px',
                fontWeight: '500',
                color: '#ccc',
                textDecoration: 'none',
                borderBottom: '1px solid #222'
              }}
            >
              {menu}
            </a>
          ))}
          <div style={{ padding: '14px 20px', display: 'flex', gap: '16px', borderTop: '1px solid #333' }}>
            {user ? (
              <button onClick={handleLogout} style={{ color: '#999', fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>로그아웃</button>
            ) : (
              <a href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ color: '#999', fontSize: '14px', textDecoration: 'none' }}>로그인</a>
            )}
          </div>
        </div>
      )}

    </header>
  );
}
