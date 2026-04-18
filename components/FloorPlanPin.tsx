'use client';

import { useState } from 'react';

const FLOOR_PLAN_BASE = 'https://pub-f74a12fe75844385b015b3336498abe7.r2.dev/floor-plans';

export function getFloorPlanUrl(floor: string | number | null | undefined): string | null {
  if (floor == null || floor === '') return null;
  const s = String(floor).trim().replace(/층$/, '').replace(/\s/g, '');

  // 지하1 / 지하1층 / B1
  if (/^(지하|B|b)-?\d+$/.test(s)) {
    const n = s.match(/\d+/)?.[0];
    if (n === '1') return `${FLOOR_PLAN_BASE}/B1F.jpg`;
    return null;
  }
  if (s === '-1') return `${FLOOR_PLAN_BASE}/B1F.jpg`;

  const n = parseInt(s, 10);
  if (!isNaN(n) && n >= 1 && n <= 5) return `${FLOOR_PLAN_BASE}/${n}F.jpg`;
  return null;
}

export function getFloorPlanLabel(floor: string | number | null | undefined): string {
  if (floor == null || floor === '') return '';
  const s = String(floor).trim();
  if (s.endsWith('층')) return s;
  if (s.startsWith('지하')) return `${s}층`;
  return `${s}층`;
}

// ── 관리자용 picker ──────────────────────────────────────────
export function FloorPlanPicker({
  floor, x, y, onChange,
}: {
  floor: string;
  x: string;
  y: string;
  onChange: (x: string, y: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const url = getFloorPlanUrl(floor);

  if (!url) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', background: '#fafafa', border: '1px dashed #ddd', borderRadius: '6px', color: '#999', fontSize: '13px' }}>
        {floor ? `${floor}층 배치도는 아직 등록되지 않았습니다.` : '현재층을 먼저 입력하면 배치도가 표시됩니다.'}
        <div style={{ marginTop: '6px', fontSize: '11px', color: '#bbb' }}>배치도 지원: 지하1층, 1~5층</div>
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * 100;
    const cy = ((e.clientY - rect.top) / rect.height) * 100;
    onChange(cx.toFixed(2), cy.toFixed(2));
  };

  const hasPin = x !== '' && y !== '' && !isNaN(parseFloat(x)) && !isNaN(parseFloat(y));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '13px', color: '#666' }}>
          {hasPin
            ? <>📍 핀 위치: <strong>X {x}%, Y {y}%</strong></>
            : '배치도 위를 클릭해 호실 위치를 지정하세요.'}
        </div>
        {hasPin && (
          <button
            type="button"
            onClick={() => onChange('', '')}
            style={{ padding: '4px 10px', fontSize: '12px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', color: '#666', cursor: 'pointer' }}
          >
            핀 초기화
          </button>
        )}
      </div>
      <div
        onClick={handleClick}
        style={{
          position: 'relative', width: '100%', border: '1px solid #e0e0e0', borderRadius: '6px',
          overflow: 'hidden', cursor: 'crosshair', background: '#f0f0f0', lineHeight: 0,
        }}
      >
        <img
          src={url}
          alt={`${floor}층 배치도`}
          onLoad={() => setLoaded(true)}
          style={{ width: '100%', height: 'auto', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
          draggable={false}
        />
        {!loaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '13px' }}>
            배치도 불러오는 중...
          </div>
        )}
        {hasPin && (
          <div
            style={{
              position: 'absolute',
              left: `${x}%`, top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              width: '22px', height: '22px',
              borderRadius: '50%',
              background: '#e2a06e',
              border: '3px solid #fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── 사용자용 read-only 표시 (깜빡임) ───────────────────────────
export function FloorPlanDisplay({
  floor, x, y,
}: {
  floor: string | number | null | undefined;
  x: number | string | null | undefined;
  y: number | string | null | undefined;
}) {
  const url = getFloorPlanUrl(floor);
  const xn = x == null || x === '' ? NaN : parseFloat(String(x));
  const yn = y == null || y === '' ? NaN : parseFloat(String(y));
  if (!url || isNaN(xn) || isNaN(yn)) return null;

  return (
    <div style={{ marginBottom: '16px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fp-pulse {
          0%   { transform: translate(-50%, -50%) scale(1);   box-shadow: 0 0 0 0   rgba(226,160,110, 0.6); }
          70%  { transform: translate(-50%, -50%) scale(1.15); box-shadow: 0 0 0 14px rgba(226,160,110, 0); }
          100% { transform: translate(-50%, -50%) scale(1);   box-shadow: 0 0 0 0   rgba(226,160,110, 0); }
        }
        @keyframes fp-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      ` }} />
      <div style={{ fontSize: '13px', color: '#888', marginBottom: '6px' }}>
        📐 {getFloorPlanLabel(floor)} 배치도 (호실 위치 표시)
      </div>
      <div style={{ position: 'relative', width: '100%', border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden', background: '#f0f0f0', lineHeight: 0 }}>
        <img
          src={url}
          alt={`${getFloorPlanLabel(floor)} 배치도`}
          style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
          draggable={false}
        />
        <div
          style={{
            position: 'absolute',
            left: `${xn}%`, top: `${yn}%`,
            width: '20px', height: '20px',
            borderRadius: '50%',
            background: '#e2a06e',
            border: '3px solid #fff',
            animation: 'fp-pulse 1.6s ease-out infinite',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
