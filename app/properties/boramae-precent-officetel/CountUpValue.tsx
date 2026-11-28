'use client';

import { useEffect, useRef, useState } from 'react';

// 숫자 띠 값 — 서버 HTML에는 항상 최종 문자열(value)이 그대로 들어가고(예: "약 150m"),
// 마운트 후 화면에 들어오면 그 숫자 부분만 0에서 최종값까지 올라가는 연출을 클라이언트에서만 더한다.
// prefers-reduced-motion이면 애니메이션 없이 최종 값 그대로 유지.
export default function CountUpValue({ value }: { value: string }) {
  const match = value.match(/^(\D*?)(\d+(?:\.\d+)?)(\D*)$/);
  const ref = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    setDisplay(value);
    startedRef.current = false;
  }, [value]);

  useEffect(() => {
    if (!match) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;

    const [, prefix, numStr, suffix] = match;
    const target = parseFloat(numStr);
    const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          const duration = 1200;
          const startTime = performance.now();
          const tick = (now: number) => {
            const progress = Math.min(1, (now - startTime) / duration);
            const current = target * progress;
            setDisplay(`${prefix}${current.toFixed(decimals)}${suffix}`);
            if (progress < 1) requestAnimationFrame(tick);
            else setDisplay(value); // 원래 문자열 그대로 마무리(표기 보존)
          };
          requestAnimationFrame(tick);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.4 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [match, value]);

  return <span ref={ref}>{display}</span>;
}
