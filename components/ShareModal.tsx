'use client';

import { useEffect, useState } from 'react';

interface ShareModalProps {
  propertyTitle: string;
  propertyNumber: string;
  imageUrl: string;
  description: string;
  shareUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({
  propertyTitle,
  propertyNumber,
  imageUrl,
  description,
  shareUrl,
  isOpen,
  onClose,
}: ShareModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const fallbackCopy = (text: string): boolean => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        showToast('링크가 복사되었습니다');
        return;
      }
    } catch {
      // fall through to fallback
    }
    if (fallbackCopy(shareUrl)) {
      showToast('링크가 복사되었습니다');
    } else {
      showToast('링크 복사에 실패했습니다');
    }
  };

  const handleKakaoShare = () => {
    if (!window.Kakao) {
      showToast('카카오 SDK 로드 중입니다');
      return;
    }
    const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? '';
    if (!window.Kakao.isInitialized()) {
      if (!appKey) {
        showToast('카카오 공유 설정이 필요합니다');
        return;
      }
      window.Kakao.init(appKey);
    }

    // 절대 URL 보장: 전달받은 shareUrl이 http(s)로 시작하지 않으면 현재 페이지의 canonical URL로 대체
    const absShareUrl = /^https?:\/\//i.test(shareUrl)
      ? shareUrl
      : `${window.location.origin}${window.location.pathname}`;

    const absImageUrl = /^https?:\/\//i.test(imageUrl)
      ? imageUrl
      : 'https://hermann-realty.com/og-image.png';

    const safeTitle = propertyTitle || `매물번호 ${propertyNumber}`;

    console.log('카카오 공유 데이터:', {
      title: safeTitle,
      description,
      imageUrl: absImageUrl,
      shareUrl: absShareUrl,
    });

    try {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: safeTitle,
          description,
          imageUrl: absImageUrl,
          link: {
            mobileWebUrl: absShareUrl,
            webUrl: absShareUrl,
          },
        },
        buttons: [
          {
            title: '매물 보기',
            link: {
              mobileWebUrl: absShareUrl,
              webUrl: absShareUrl,
            },
          },
        ],
      });
    } catch (err) {
      console.error('[ShareModal] 카카오 공유 실패:', err);
      showToast('카카오 공유에 실패했습니다');
    }
  };

  const smsBody = `[헤르만부동산] ${propertyTitle || `매물 ${propertyNumber}`}\n${shareUrl}`;
  const smsHref = `sms:?&body=${encodeURIComponent(smsBody)}`;

  if (!mounted || !isOpen) return null;

  const iconCellSt: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
    background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px',
    textDecoration: 'none',
  };
  const iconCircleSt: React.CSSProperties = {
    width: '56px', height: '56px', borderRadius: '50%',
    background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '24px', flexShrink: 0,
  };
  const labelSt: React.CSSProperties = {
    fontSize: '12px', color: '#333', fontWeight: 500, textAlign: 'center',
  };

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 9998, display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          animation: 'share-fade-in 0.18s ease-out',
        }}
      >
        {/* 시트/모달 */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#fff',
            width: '100%',
            maxWidth: isMobile ? '100%' : '420px',
            borderRadius: isMobile ? '16px 16px 0 0' : '12px',
            boxShadow: '0 -6px 24px rgba(0,0,0,0.18)',
            padding: '18px 20px 24px',
            animation: isMobile ? 'share-slide-up 0.22s ease-out' : 'share-fade-in 0.18s ease-out',
          }}
        >
          {/* 핸들 (모바일) */}
          {isMobile && (
            <div style={{ width: '40px', height: '4px', background: '#e0e0e0', borderRadius: '2px', margin: '0 auto 14px' }} />
          )}

          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>공유하기</h3>
            <button
              onClick={onClose}
              aria-label="닫기"
              style={{ background: 'none', border: 'none', fontSize: '22px', color: '#888', cursor: 'pointer', lineHeight: 1, padding: '4px' }}
            >
              ×
            </button>
          </div>

          {/* 옵션 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <button onClick={handleCopyLink} style={iconCellSt} aria-label="링크 복사">
              <div style={iconCircleSt}>🔗</div>
              <span style={labelSt}>링크 복사</span>
            </button>

            <button onClick={handleKakaoShare} style={iconCellSt} aria-label="카카오톡 공유">
              <div style={{ ...iconCircleSt, background: '#fee500' }}>
                <span style={{ fontSize: '20px', fontWeight: 900, color: '#3c1e1e' }}>K</span>
              </div>
              <span style={labelSt}>카카오톡</span>
            </button>

            <a href={smsHref} style={iconCellSt} aria-label="문자 메시지">
              <div style={iconCircleSt}>💬</div>
              <span style={labelSt}>문자</span>
            </a>

            <button onClick={onClose} style={iconCellSt} aria-label="닫기">
              <div style={iconCircleSt}>✕</div>
              <span style={labelSt}>닫기</span>
            </button>
          </div>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div
          style={{
            position: 'fixed', bottom: isMobile ? '180px' : '40px', left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(26,26,26,0.92)', color: '#e2a06e',
            padding: '10px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
            zIndex: 10000, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          {toast}
        </div>
      )}

      <style>{`
        @keyframes share-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes share-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
