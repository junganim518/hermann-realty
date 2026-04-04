'use client';

export default function Header() {
  return (
    <header style={{ width: '100%', position: 'sticky', top: 0, zIndex: 1000 }}>

      {/* 로고 바 - 3열 구조 */}
      <div style={{ background: '#111111', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 500px', borderBottom: '1px solid #333' }}>

        {/* 좌측: 문의 전화 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#999', fontSize: '17px', fontWeight: '700', minWidth: '220px' }}>
          <span>☎ 문의</span>
          <span style={{ color: '#C8843A', fontWeight: '700', fontSize: '17px' }}>010-8680-8151</span>
        </div>

        {/* 중앙: 로고 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="로고" style={{ width: '52px', height: '52px', objectFit: 'contain' }} />
            <span style={{ fontSize: '32px', fontWeight: '700', color: '#C8843A' }}>헤르만부동산</span>
          </div>
          <div style={{ fontSize: '12px', letterSpacing: '0.2em', color: '#999' }}>REAL ESTATE & INVESTMENTS</div>
        </div>

        {/* 우측: 로그인 등 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', justifyContent: 'flex-end' }}>
          <a href="#" style={{ color: '#999', fontSize: '17px', fontWeight: '700', textDecoration: 'none' }}>직거래매물등록</a>
          <span style={{ color: '#555' }}>|</span>
          <a href="#" style={{ color: '#999', fontSize: '17px', fontWeight: '700', textDecoration: 'none' }}>로그인</a>
          <span style={{ color: '#555' }}>|</span>
          <a href="#" style={{ color: '#999', fontSize: '17px', fontWeight: '700', textDecoration: 'none' }}>회원가입</a>
        </div>

      </div>

      {/* 네비게이션 바 */}
      <nav style={{ background: '#ffffff', borderBottom: '1px solid #dddddd', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '56px' }}>
        {['매물검색', '매물 의뢰하기', '부동산 소식', '질문과 답변', '공지사항', '회사소개'].map((menu) => (
          <a key={menu} href="#" style={{ fontSize: '18px', fontWeight: '500', color: '#333333', textDecoration: 'none', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = '#C8843A'}
            onMouseLeave={e => (e.target as HTMLElement).style.color = '#333333'}>
            {menu}
          </a>
        ))}
      </nav>

    </header>
  );
}
