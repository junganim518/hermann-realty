'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type GalleryItem = {
  id: string;
  url: string;
  caption: string | null;
  category: string | null;
  sort_order: number;
};

export default function Gallery({ items }: { items: GalleryItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const syncArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 2);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    syncArrows();
    el.addEventListener('scroll', syncArrows, { passive: true });
    const ro = new ResizeObserver(syncArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', syncArrows);
      ro.disconnect();
    };
  }, [syncArrows, items.length]);

  const scrollSlide = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.querySelector('.g-slide') as HTMLElement | null;
    const amt = slide ? slide.offsetWidth + 12 : el.clientWidth;
    el.scrollBy({ left: dir * amt, behavior: 'smooth' });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) scrollSlide(diff > 0 ? 1 : -1);
    touchStartX.current = null;
  };

  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setLightbox(i => i !== null ? Math.min(items.length - 1, i + 1) : null);
      else if (e.key === 'ArrowLeft') setLightbox(i => i !== null ? Math.max(0, i - 1) : null);
      else if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, items.length]);

  useEffect(() => {
    document.body.style.overflow = lightbox !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightbox]);

  if (!items.length) return null;

  const cur = lightbox !== null ? items[lightbox] : null;

  return (
    <>
      <style>{GALLERY_CSS}</style>

      <div style={{ position: 'relative' }}>
        {/* 슬라이드 트랙 */}
        <div
          ref={trackRef}
          className="g-track"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="g-slide"
              onClick={() => setLightbox(idx)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.caption ?? `갤러리 이미지 ${idx + 1}`}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {item.caption && (
                <div className="g-caption">{item.caption}</div>
              )}
            </div>
          ))}
        </div>

        {canPrev && (
          <button className="g-arrow g-arrow-left" onClick={() => scrollSlide(-1)} aria-label="이전">‹</button>
        )}
        {canNext && (
          <button className="g-arrow g-arrow-right" onClick={() => scrollSlide(1)} aria-label="다음">›</button>
        )}
      </div>
      <p className="g-hint">← 좌우로 스와이프하거나 화살표로 넘기세요 →</p>

      {/* 라이트박스 */}
      {lightbox !== null && cur && (
        <div className="g-lightbox" onClick={() => setLightbox(null)}>
          <button className="g-lb-close" onClick={() => setLightbox(null)} aria-label="닫기">✕</button>
          <span className="g-lb-counter">{lightbox + 1} / {items.length}</span>

          <div className="g-lb-body" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.url} alt={cur.caption ?? ''} className="g-lb-img" />
            {cur.caption && <p className="g-lb-caption">{cur.caption}</p>}
          </div>

          {lightbox > 0 && (
            <button
              className="g-lb-arrow g-lb-arrow-left"
              aria-label="이전"
              onClick={e => { e.stopPropagation(); setLightbox(i => i !== null ? Math.max(0, i - 1) : null); }}
            >‹</button>
          )}
          {lightbox < items.length - 1 && (
            <button
              className="g-lb-arrow g-lb-arrow-right"
              aria-label="다음"
              onClick={e => { e.stopPropagation(); setLightbox(i => i !== null ? Math.min(items.length - 1, i + 1) : null); }}
            >›</button>
          )}
        </div>
      )}
    </>
  );
}

const GALLERY_CSS = `
  .g-track {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding-bottom: 2px;
  }
  .g-track::-webkit-scrollbar { display: none; }
  .g-slide {
    flex: 0 0 calc(33.333% - 8px);
    aspect-ratio: 4 / 3;
    position: relative;
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    scroll-snap-align: start;
    background: #e5e7eb;
    transition: opacity 0.15s;
  }
  .g-slide:hover { opacity: 0.88; }
  .g-caption {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    background: linear-gradient(transparent, rgba(0,0,0,0.72));
    color: #fff;
    font-size: 12px;
    padding: 24px 10px 8px;
    pointer-events: none;
    line-height: 1.4;
  }
  .g-arrow {
    position: absolute;
    top: 50%; transform: translateY(-50%);
    width: 38px; height: 38px;
    border-radius: 50%;
    background: #1a1a1a;
    color: #e2a06e;
    border: none;
    font-size: 22px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    z-index: 2;
    transition: background 0.15s;
  }
  .g-arrow:hover { background: #333; }
  .g-arrow-left { left: -19px; }
  .g-arrow-right { right: -19px; }
  .g-hint {
    text-align: center;
    font-size: 12px;
    color: #bbb;
    margin: 10px 0 0;
  }
  .g-lightbox {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.93);
    display: flex; align-items: center; justify-content: center;
  }
  .g-lb-close {
    position: absolute; top: 14px; right: 18px;
    background: none; border: none;
    color: rgba(255,255,255,0.7);
    font-size: 26px; cursor: pointer; line-height: 1;
    padding: 4px 8px;
    transition: color 0.15s;
  }
  .g-lb-close:hover { color: #fff; }
  .g-lb-counter {
    position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
    color: rgba(255,255,255,0.5); font-size: 13px;
  }
  .g-lb-body { max-width: 92vw; text-align: center; }
  .g-lb-img {
    max-width: 92vw; max-height: 78vh;
    object-fit: contain; display: block; margin: 0 auto;
    border-radius: 4px;
  }
  .g-lb-caption {
    color: rgba(255,255,255,0.72);
    font-size: 13px;
    margin: 10px 0 0;
    line-height: 1.5;
  }
  .g-lb-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    width: 48px; height: 48px; border-radius: 50%;
    background: rgba(255,255,255,0.12);
    color: #fff; border: none;
    font-size: 26px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .g-lb-arrow:hover { background: rgba(255,255,255,0.22); }
  .g-lb-arrow-left { left: 16px; }
  .g-lb-arrow-right { right: 16px; }
  @media (max-width: 767px) {
    .g-slide { flex: 0 0 calc(85% - 6px); }
    .g-arrow { display: none; }
    .g-lb-arrow-left { left: 8px; }
    .g-lb-arrow-right { right: 8px; }
  }
`;
