'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === '/map') return; // 지도 페이지는 스크롤 유지
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
