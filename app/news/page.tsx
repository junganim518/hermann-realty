'use client';

import { useEffect, useState } from 'react';

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  thumbnail: string | null;
  source: string;
}

const formatDate = (pubDate: string): string => {
  if (!pubDate) return '';
  try {
    const d = new Date(pubDate);
    if (isNaN(d.getTime())) return pubDate;
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return pubDate;
  }
};

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/news', { next: { revalidate: 3600 } });
        const data = await res.json();
        if (data.error) setError(data.error);
        setItems(data.items ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '32px 16px' }}>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1024px) {
          .news-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 767px) {
          .news-grid { grid-template-columns: 1fr !important; }
          .news-page { padding: 0 !important; }
          .news-title { font-size: 24px !important; }
        }
      ` }} />

      <div className="news-page" style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 className="news-title" style={{ fontSize: '32px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px' }}>부동산 소식</h1>
          <p style={{ fontSize: '15px', color: '#888' }}>최신 부동산 뉴스를 한눈에 확인하세요</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#888' }}>
            <p style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</p>
            <p style={{ fontSize: '15px' }}>뉴스를 불러오는 중...</p>
          </div>
        ) : error || items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#aaa' }}>
            <p style={{ fontSize: '40px', marginBottom: '12px' }}>📰</p>
            <p style={{ fontSize: '15px', color: '#666', fontWeight: 600 }}>뉴스를 불러올 수 없습니다</p>
            {error && <p style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>{error}</p>}
          </div>
        ) : (
          <div className="news-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {items.map((item, i) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  background: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* 썸네일 */}
                <div style={{ width: '100%', aspectRatio: '16 / 10', background: '#f0f0f0', overflow: 'hidden', position: 'relative' }}>
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '40px' }}>📰</div>
                  )}
                </div>

                {/* 텍스트 */}
                <div style={{ padding: '16px 18px' }}>
                  <p style={{ fontSize: '11px', color: '#e2a06e', fontWeight: 700, marginBottom: '8px' }}>
                    {item.source} · {formatDate(item.pubDate)}
                  </p>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.title}
                  </h3>
                  {item.description && (
                    <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.description}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
