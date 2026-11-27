import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ background: '#f5f5f5', minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '420px' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏚</div>
        <p style={{ fontSize: '20px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>페이지를 찾을 수 없습니다</p>
        <p style={{ fontSize: '15px', color: '#999', marginBottom: '28px' }}>요청하신 매물이 존재하지 않거나 삭제되었습니다.</p>
        <Link href="/properties" style={{ display: 'inline-block', padding: '14px 28px', background: '#1a1a1a', color: '#fff', fontWeight: 700, borderRadius: '8px', textDecoration: 'none', fontSize: '15px' }}>
          전체 매물 보기
        </Link>
      </div>
    </main>
  );
}
