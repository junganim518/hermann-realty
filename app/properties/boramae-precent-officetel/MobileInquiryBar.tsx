'use client';

import { useEffect, useState } from 'react';
import styles from './officetel.module.css';

// 모바일 전용 하단 고정 "문의하기" 바. 문의 섹션이 화면에 보이면 자동으로 숨긴다.
// JS 실행 전/실패 시에도 기본 CSS(.mobileBar)로 그냥 보이는 상태라 progressive enhancement에 안전함.
export default function MobileInquiryBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const target = document.getElementById('officetel-inquiry');
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`${styles.mobileBar} ${hidden ? styles.mobileBarHidden : ''}`}>
      <a href="#officetel-inquiry" className={styles.mobileBarBtn}>문의하기</a>
    </div>
  );
}
