'use client';

import { useEffect } from 'react';
import styles from './officetel.module.css';

// 점진적 향상: 기본(서버 HTML, JS 없음)에는 아무 영향이 없고(officetel.module.css의
// [data-reveal] 기본 규칙이 opacity:1), 이 컴포넌트가 마운트된 뒤에만 루트에 jsReveal
// 클래스를 붙여서 [data-reveal] 요소들이 "아래에서 살짝 올라오며 페이드 인"하게 만든다.
// prefers-reduced-motion이면 아무것도 하지 않음(= 바로 다 보이는 상태 그대로 유지).
export default function RevealObserver({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    root.classList.add(styles.jsReveal);
    const els = root.querySelectorAll('[data-reveal]');

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealed);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [rootId]);

  return null;
}
