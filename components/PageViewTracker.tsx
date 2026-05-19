'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isBot } from '@/lib/isBot';

function detectDevice(): 'mobile' | 'pc' {
  if (typeof navigator === 'undefined') return 'pc';
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    ? 'mobile'
    : 'pc';
}

const AI_KEYWORDS = ['chatgpt', 'openai', 'gemini', 'bard', 'perplexity', 'copilot', 'claude'];
const OWN_HOSTS = ['hermann-realty.com', 'vercel.app', 'localhost'];

function classifyAI(lower: string): string {
  if (lower.includes('chatgpt') || lower.includes('openai')) return 'ai:chatgpt';
  if (lower.includes('gemini') || lower.includes('bard')) return 'ai:gemini';
  if (lower.includes('perplexity')) return 'ai:perplexity';
  if (lower.includes('copilot')) return 'ai:copilot';
  if (lower.includes('claude')) return 'ai:claude';
  return 'ai:기타';
}

function classifySource(src: string): string {
  const lower = src.toLowerCase();
  if (AI_KEYWORDS.some(k => lower.includes(k))) return classifyAI(lower);
  if (lower.includes('naver')) return 'naver';
  if (lower.includes('google')) return 'google';
  if (lower.includes('kakao')) return 'kakao';
  if (lower.includes('daum')) return 'daum';
  return src;
}

function categorizeReferrer(): string {
  if (typeof document === 'undefined') return 'direct';

  // 1) utm_source 최우선 — 자기 도메인이어도 utm_source 있으면 그걸로 분류
  const utmSource = new URLSearchParams(window.location.search).get('utm_source') ?? '';
  if (utmSource) return classifySource(utmSource);

  // 2) utm_source 없을 때만 referrer 확인
  const ref = document.referrer;
  if (!ref) return 'direct';

  // 3) referrer가 자기 도메인이면 직접접속(내부 이동)
  try {
    const host = new URL(ref).hostname;
    if (OWN_HOSTS.some(h => host.includes(h))) return 'direct';
  } catch { /* URL 파싱 실패 시 아래로 */ }

  return classifySource(ref);
}

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return;
    if (pathname === '/login') return;
    if (typeof navigator !== 'undefined' && isBot(navigator.userAgent)) return;

    const key = `viewed_${pathname}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage 접근 불가(privacy mode 등) — 그대로 진행
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        console.log('[PageViewTracker] 로그인 사용자 — 수집 제외');
        return;
      }
      supabase
        .from('page_views')
        .insert({ page: pathname, device: detectDevice(), referrer: categorizeReferrer() })
        .then(({ error }) => {
          if (error) console.warn('[PageViewTracker]', error.message);
        });
    });
  }, [pathname]);

  return null;
}
