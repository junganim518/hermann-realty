'use client';

import { useCallback, useEffect, useRef } from 'react';
import { photoTagLabel } from '@/lib/precentOfficetelTags';
import styles from './officetel.module.css';
import type { OfficetelPhoto } from './OfficetelLanding';

export type LightboxState = { photos: OfficetelPhoto[]; index: number } | null;

// Gallery.tsx(상가 페이지)의 라이트박스와 같은 동작 — 중앙 모달, 닫기 버튼 항상 보임,
// 이전/다음 이동, Esc로 닫기, 뒷배경 스크롤 잠금. Gallery.tsx 자체는 건드리지 않고
// 이 페이지 전용으로 같은 동작을 구현한다(모자이크/공간 둘러보기/평면도/지그재그 사진 공용).
export default function PhotoLightbox({
  state, onClose, onNavigate,
}: {
  state: LightboxState;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const touchStartX = useRef<number | null>(null);

  const goPrev = useCallback(() => {
    if (!state) return;
    onNavigate(Math.max(0, state.index - 1));
  }, [state, onNavigate]);

  const goNext = useCallback(() => {
    if (!state) return;
    onNavigate(Math.min(state.photos.length - 1, state.index + 1));
  }, [state, onNavigate]);

  useEffect(() => {
    if (!state) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [state, onClose, goPrev, goNext]);

  if (!state) return null;
  const photo = state.photos[state.index];
  if (!photo) return null;
  const hasMultiple = state.photos.length > 1;
  const alt = photo.caption || `프리센트 오피스텔 ${photoTagLabel(photo.tag)}`;

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx > 0) goPrev(); else goNext();
  };

  return (
    <div className={styles.lightbox} onClick={onClose}>
      <button className={styles.lightboxClose} onClick={onClose} aria-label="닫기">✕</button>
      {hasMultiple && (
        <span className={styles.lightboxCounter}>{state.index + 1} / {state.photos.length}</span>
      )}
      <div
        className={styles.lightboxBody}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={alt} className={styles.lightboxImg} />
        {photo.caption && <p className={styles.lightboxCaption}>{photo.caption}</p>}
      </div>
      {hasMultiple && state.index > 0 && (
        <button
          className={`${styles.lightboxArrow} ${styles.lightboxArrowLeft}`}
          aria-label="이전 사진"
          onClick={e => { e.stopPropagation(); goPrev(); }}
        >‹</button>
      )}
      {hasMultiple && state.index < state.photos.length - 1 && (
        <button
          className={`${styles.lightboxArrow} ${styles.lightboxArrowRight}`}
          aria-label="다음 사진"
          onClick={e => { e.stopPropagation(); goNext(); }}
        >›</button>
      )}
    </div>
  );
}
