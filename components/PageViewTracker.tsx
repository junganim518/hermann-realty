'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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

    supabase
      .from('page_views')
      .insert({ page: pathname, device: detectDevice() })
      .then(({ error }) => {
        if (error) console.warn('[PageViewTracker]', error.message);
      });
  }, [pathname]);

  return null;
}
