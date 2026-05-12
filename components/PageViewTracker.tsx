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

function categorizeReferrer(): string {
  if (typeof document === 'undefined') return 'direct';
  const ref = document.referrer;
  if (!ref) return 'direct';
  const lower = ref.toLowerCase();
  if (lower.includes('naver')) return 'naver';
  if (lower.includes('google')) return 'google';
  if (lower.includes('kakao')) return 'kakao';
  return ref;
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
