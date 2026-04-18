'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const BOT_REGEX = /bot|crawler|spider|crawling|slurp|mediapartners|facebookexternalhit|embedly|quora|outbrain|vkshare|whatsapp|kakaotalk|line|telegram|discordbot|preview/i;

function isBot(): boolean {
  if (typeof navigator === 'undefined') return false;
  return BOT_REGEX.test(navigator.userAgent);
}

function detectDevice(): 'mobile' | 'pc' {
  if (typeof navigator === 'undefined') return 'pc';
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    ? 'mobile'
    : 'pc';
}

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return;
    if (pathname === '/login') return;
    if (isBot()) return;

    const key = `viewed_${pathname}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage 접근 불가(privacy mode 등) — 그대로 진행
    }

    supabase
      .from('page_views')
      .insert({ page: pathname, device: detectDevice() })
      .then(({ error }) => {
        if (error) console.warn('[PageViewTracker]', error.message);
      });
  }, [pathname]);

  return null;
}
