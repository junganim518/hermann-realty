'use client';

import { useEffect } from 'react';
import styles from './officetel.module.css';

// 점진적 향상: 기본(서버 HTML, JS 없음)에는 아무 영향이 없고(officetel.module.css의
// [data-reveal]/[data-reveal-card] 기본 규칙이 opacity:1), 이 컴포넌트가 마운트된 뒤에만
// 루트에 jsReveal 클래스를 붙여서 그 요소들이 "아래에서 살짝 올라오며 페이드 인"하게 만든다.
// - [data-reveal]: 섹션 컨테이너 단위(섹션 제목, 표, 목록 전체, 카드 전체 묶음 등) — 통째로 한 번에 등장.
// - [data-reveal-card]: 카드 그리드의 개별 카드(핵심 정보/모자이크/공간 둘러보기) — officetel.module.css의
//   nth-child 규칙으로 최대 6개까지 80ms씩 지연을 둬서 순차 등장(stagger)하게 함.
// 목록 줄/FAQ 질문 같은 작은 단위에는 이 속성을 걸지 않는다(중간 상태가 캡처되는 문제 방지).
// prefers-reduced-motion이면 아무것도 하지 않음(= 바로 다 보이는 상태 그대로 유지).
// 안전장치: 2.5초가 지나면 아직 안 보인 요소도 전부 강제로 보이게 한다(스크린샷 도구 등 대비).
export default function RevealObserver({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    root.classList.add(styles.jsReveal);
    const els = root.querySelectorAll('[data-reveal], [data-reveal-card]');

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

    const timeoutId = window.setTimeout(() => {
      els.forEach(el => {
        el.classList.add(styles.revealed);
        observer.unobserve(el);
      });
    }, 2500);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeoutId);
    };
  }, [rootId]);

  return null;
}
