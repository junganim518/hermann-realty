'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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
  const [isAdmin, setIsAdmin] = useState(false);

  // 블로그 프롬프트 모달
  const [blogOpen, setBlogOpen] = useState(false);
  const [blogText, setBlogText] = useState('');
  const [newsLoading, setNewsLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAdmin(!!data.user));
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const openNewsBlogModal = async () => {
    if (newsLoading) return;
    setNewsLoading(true);
    setBlogText('');
    setBlogOpen(true);
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      const newsItems: any[] = data?.items ?? [];
      if (newsItems.length === 0) throw new Error('뉴스를 불러올 수 없습니다');

      const today = new Date();
      const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
      const yy = String(today.getFullYear()).slice(-2);
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const shortDate = `${yy}.${mm}.${dd}`;
      const newsLines = newsItems.slice(0, 5)
        .map((n, i) => `${i + 1}. ${n.title}\n   요약: ${n.description || '(요약 없음)'}`)
        .join('\n\n');

      const prompt = `당신은 부동산 전문 블로거입니다.
아래 오늘의 부동산 뉴스를 바탕으로
네이버 블로그에 올릴 정보전달식 블로그 글을 작성해주세요.

작성 규칙:
━━━━━━━━━━━━━━━━━━━━━━
[0단계] 추천 블로그 제목 3개 먼저 생성
- 글 맨 위에 "📌 추천 제목:" 섹션 배치
- 형식: [${shortDate}] + 핵심 키워드 + 흥미로운 문구
- 예) [${shortDate}] 부천 소사역 e편한세상 분양 시작! 오늘의 부동산 핵심 요약
- 3개 모두 다른 각도·톤으로 작성 (뉴스별 강조점 다르게)
- 번호 매기기 (1, 2, 3)
━━━━━━━━━━━━━━━━━━━━━━

[1단계] 본문 작성:
- 첫 문장: "안녕하세요 헤르만부동산입니다." 로 시작
- 오늘 날짜 포함 (예: ${dateStr} 부동산 소식)
- 각 뉴스를 쉽고 친근하게 요약 설명
- 독자에게 도움이 되는 인사이트 추가
- 판매글 느낌 없이 순수 정보전달
- 마무리: 헤르만부동산 소개 + 연락처(010-8680-8151)
- 이모지 적절히 사용
- 전체 길이 1500자 이상
- 해시태그 30개 글 맨 마지막

오늘의 부동산 뉴스 (${dateStr}):
${newsLines}`;

      setBlogText(prompt);
    } catch (err: any) {
      setBlogText(`뉴스 불러오기 실패: ${err?.message ?? '알 수 없는 오류'}`);
    } finally {
      setNewsLoading(false);
    }
  };

  const closeBlogModal = () => {
    setBlogOpen(false);
    setBlogText('');
  };

  const copyBlogText = async () => {
    if (!blogText) return;
    try {
      await navigator.clipboard.writeText(blogText);
      showToast('프롬프트가 복사되었습니다');
    } catch {
      showToast('복사 실패');
    }
  };

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

        {/* 관리자 전용: 오늘의 부동산 소식 블로그 글 생성 버튼 */}
        {isAdmin && (
          <div style={{ marginBottom: '24px' }}>
            <button
              onClick={openNewsBlogModal}
              disabled={newsLoading}
              style={{
                width: '100%', padding: '14px 20px',
                background: '#1a1a1a', color: '#e2a06e',
                border: '1px solid #e2a06e', borderRadius: '8px',
                fontSize: '15px', fontWeight: 700,
                cursor: newsLoading ? 'wait' : 'pointer',
                opacity: newsLoading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {newsLoading ? '뉴스 불러오는 중...' : '📰 오늘의 부동산 소식 블로그 글 생성'}
            </button>
          </div>
        )}

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

      {/* 토스트 */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', color: '#e2a06e', padding: '12px 24px', borderRadius: '8px',
          fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          zIndex: 9999,
        }}>
          {toastMsg}
        </div>
      )}

      {/* 블로그 프롬프트 모달 */}
      {blogOpen && (
        <div
          onClick={closeBlogModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '12px', maxWidth: '720px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 20px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#e2a06e' }}>
                📰 오늘의 부동산 소식 프롬프트
              </h3>
              <button onClick={closeBlogModal} style={{ background: 'none', border: 'none', color: '#e2a06e', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
                아래 프롬프트를 복사해 ChatGPT / Claude / Gemini 등에 붙여넣어 블로그 글을 생성하세요.
              </p>
              {newsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '60px 0', color: '#888' }}>
                  <div style={{ width: '36px', height: '36px', border: '3px solid #f0f0f0', borderTop: '3px solid #e2a06e', borderRadius: '50%', animation: 'news-blog-spin 0.8s linear infinite' }} />
                  <p style={{ fontSize: '14px' }}>오늘의 부동산 뉴스를 불러오는 중...</p>
                  <style>{`@keyframes news-blog-spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.7, color: '#333', margin: 0, background: '#fafafa', padding: '14px', borderRadius: '6px', border: '1px solid #eee' }}>
                  {blogText}
                </pre>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={closeBlogModal} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ddd', color: '#666', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                닫기
              </button>
              <button
                onClick={copyBlogText}
                disabled={!blogText || newsLoading}
                style={{ padding: '8px 20px', background: '#1a1a1a', border: '1px solid #1a1a1a', color: '#e2a06e', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: (!blogText || newsLoading) ? 'not-allowed' : 'pointer', opacity: (!blogText || newsLoading) ? 0.5 : 1 }}
              >
                📋 복사하기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
