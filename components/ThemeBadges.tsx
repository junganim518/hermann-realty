'use client';

import { useState, useEffect } from 'react';
import { sortAndLimitThemes, getThemeIcon, splitThemes } from '@/lib/themeUtils';

interface Props {
  themeType?: string | string[] | null;
  variant?: 'card' | 'detail';
  // card: PC 3개 / 모바일 2개 + 알약. detail: 전체 표시
  // detail 모드는 살짝 큰 폰트/패딩
}

export default function ThemeBadges({ themeType, variant = 'card' }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const themes = splitThemes(themeType);
  if (themes.length === 0) return null;

  const max = variant === 'detail' ? Number.POSITIVE_INFINITY : (isMobile ? 2 : 3);
  const { primary, overflow } = sortAndLimitThemes(themes, max);

  const isCompact = variant === 'card';
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: isCompact ? '1px 8px' : '4px 12px',
    fontSize: isCompact ? '11px' : '13px',
    background: '#f3f4f6',
    color: '#374151',
    borderRadius: '999px',
    fontWeight: 500,
    lineHeight: 1.5,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px',
      marginTop: isCompact ? '4px' : '8px',
      marginBottom: isCompact ? '4px' : '0',
    }}>
      {primary.map(t => {
        const icon = getThemeIcon(t);
        return (
          <span key={t} style={baseStyle}>
            {icon ? `${icon} ${t}` : t}
          </span>
        );
      })}
      {overflow > 0 && (
        <span style={{ ...baseStyle, background: '#fff', color: '#6b7280', border: '1px dashed #d1d5db' }}>
          +{overflow}
        </span>
      )}
    </div>
  );
}
