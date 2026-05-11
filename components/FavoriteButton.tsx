'use client';

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { isFavorite, toggleFavorite } from '@/lib/favorites';

type Size = 'sm' | 'md' | 'lg';

interface Props {
  property: { id: string; property_number: string | number | null };
  size?: Size;
  /** 카드 위 오버레이로 사용 시 true — 흰 배경 + 그림자 */
  overlay?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP: Record<Size, { btn: number; icon: number }> = {
  sm: { btn: 28, icon: 16 },
  md: { btn: 36, icon: 20 },
  lg: { btn: 44, icon: 24 },
};

export default function FavoriteButton({ property, size = 'md', overlay = false, className, style }: Props) {
  const [active, setActive] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dims = SIZE_MAP[size];

  useEffect(() => {
    setActive(isFavorite(property.id));
    const handler = () => setActive(isFavorite(property.id));
    window.addEventListener('favoritesChanged', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('favoritesChanged', handler);
      window.removeEventListener('storage', handler);
    };
  }, [property.id]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nowActive = toggleFavorite(property);
    setActive(nowActive);
  };

  const bgColor = overlay ? 'rgba(255,255,255,0.95)' : 'transparent';
  const heartColor = active ? '#e05050' : (overlay ? '#666' : '#999');
  const fill = active ? '#e05050' : 'none';

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={active ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      title={active ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      className={className}
      style={{
        width: dims.btn,
        height: dims.btn,
        borderRadius: '50%',
        background: bgColor,
        border: overlay ? 'none' : '1px solid #ddd',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: overlay ? '0 2px 6px rgba(0,0,0,0.18)' : 'none',
        transform: hovered ? 'scale(1.1)' : 'scale(1)',
        transition: 'transform 0.15s, background 0.15s',
        padding: 0,
        ...style,
      }}
    >
      <Heart
        size={dims.icon}
        strokeWidth={2}
        color={heartColor}
        fill={fill}
      />
    </button>
  );
}
