'use client';

import { useState, useRef, useEffect } from 'react';

export type PublicUnit = {
  unit_no: string;
  floor: string;
  zone: string;
  exclusive_area_py: number;
  contract_area_py: number;
  status: string;
};

const ZONE_COLOR: Record<string, string> = {
  large: '#d97706',
  small: '#64748b',
  'street-fb': '#059669',
  'clinic-academy': '#2563eb',
  'mid-office': '#7c3aed',
  'section-office': '#db2777',
};

const ZONE_LABEL: Record<string, string> = {
  large: '대형 상가',
  small: '소형 창고',
  'street-fb': 'F&B 스트리트',
  'clinic-academy': '클리닉·학원',
  'mid-office': '중형 오피스',
  'section-office': '섹션 오피스',
};

const STATUS_LABEL: Record<string, string> = {
  vacant: '공실',
  inquiry: '문의중',
  leased: '임대완료',
};

type Rect = { id: string; x: number; y: number; w: number; h: number; confirmedBrand?: string };

// ── B1 층 레이아웃 (실제 도면 기반: 상단 4대형 + 좌측 세로 9소형 + 중앙 주차코어) ──
type CoreBox = { x: number; y: number; w: number; h: number; label1: string; label2?: string };

const B1_UNITS: Rect[] = [
  // 상단 대형 4개 (좌→우): B110, B111, B112, B113
  { id: 'B110', x: 20,  y: 20, w: 165, h: 165 },
  { id: 'B111', x: 187, y: 20, w: 162, h: 165 },
  { id: 'B112', x: 351, y: 20, w: 162, h: 165 },
  { id: 'B113', x: 515, y: 20, w: 165, h: 165 },
  // 좌측 세로 소형 9개 (위→아래): B109 ~ B101
  { id: 'B109', x: 20, y: 187, w: 165, h: 40 },
  { id: 'B108', x: 20, y: 229, w: 165, h: 40 },
  { id: 'B107', x: 20, y: 271, w: 165, h: 40 },
  { id: 'B106', x: 20, y: 313, w: 165, h: 40 },
  { id: 'B105', x: 20, y: 355, w: 165, h: 40 },
  { id: 'B104', x: 20, y: 397, w: 165, h: 40 },
  { id: 'B103', x: 20, y: 439, w: 165, h: 40 },
  { id: 'B102', x: 20, y: 481, w: 165, h: 40 },
  { id: 'B101', x: 20, y: 523, w: 165, h: 40 },
];

const B1_CORE: CoreBox = {
  x: 187, y: 187, w: 493, h: 376,
  label1: '주차장 · 코어',
  label2: '(계단 · 엘리베이터)',
};

// ── 1F 층 레이아웃 ──────────────────────────────────────────
const F1_UNITS: Rect[] = [
  { id: '101', x: 20,  y: 50, w: 90,  h: 155 },
  { id: '102', x: 118, y: 50, w: 120, h: 155, confirmedBrand: '스타벅스' },
  { id: '103', x: 246, y: 50, w: 90,  h: 155, confirmedBrand: '파리바게뜨' },
  { id: '104', x: 344, y: 50, w: 72,  h: 155, confirmedBrand: 'KT' },
  { id: '105', x: 424, y: 50, w: 88,  h: 155 },
  { id: '106', x: 520, y: 50, w: 73,  h: 155, confirmedBrand: '메머드커피' },
  { id: '107', x: 601, y: 50, w: 65,  h: 155, confirmedBrand: '분식' },
  { id: '108', x: 674, y: 50, w: 57,  h: 155 },
  { id: '109', x: 739, y: 50, w: 83,  h: 155 },
  { id: '110', x: 830, y: 50, w: 83,  h: 155 },
];

// ── 2F 층 레이아웃 ──────────────────────────────────────────
const F2_UNITS: Rect[] = [
  // Row 1
  { id: '201', x: 20,  y: 25, w: 63, h: 110 },
  { id: '202', x: 91,  y: 25, w: 55, h: 110 },
  { id: '203', x: 154, y: 25, w: 73, h: 110 },
  { id: '204', x: 235, y: 25, w: 55, h: 110 },
  { id: '205', x: 298, y: 25, w: 58, h: 110 },
  { id: '206', x: 364, y: 25, w: 30, h: 110 },
  { id: '207', x: 402, y: 25, w: 30, h: 110, confirmedBrand: '치과' },
  { id: '208', x: 440, y: 25, w: 30, h: 110 },
  { id: '209', x: 478, y: 25, w: 30, h: 110 },
  { id: '210', x: 516, y: 25, w: 30, h: 110 },
  { id: '211', x: 554, y: 25, w: 53, h: 110 },
  // Row 2
  { id: '212',   x: 20,  y: 155, w: 90,  h: 110 },
  { id: '213',   x: 118, y: 155, w: 104, h: 110 },
  { id: '214',   x: 230, y: 155, w: 96,  h: 110 },
  { id: '215',   x: 334, y: 155, w: 75,  h: 110 },
  { id: '216',   x: 417, y: 155, w: 78,  h: 110 },
  { id: '217-1', x: 503, y: 155, w: 85,  h: 110 },
  { id: '217-2', x: 596, y: 155, w: 41,  h: 110 },
  // Row 3
  { id: '218-1', x: 20,  y: 285, w: 47,  h: 110 },
  { id: '218-2', x: 75,  y: 285, w: 54,  h: 110 },
  { id: '218-3', x: 137, y: 285, w: 55,  h: 110 },
  { id: '219',   x: 200, y: 285, w: 105, h: 110 },
  { id: '220',   x: 313, y: 285, w: 67,  h: 110 },
  { id: '221',   x: 388, y: 285, w: 72,  h: 110 },
  { id: '222',   x: 468, y: 285, w: 86,  h: 110 },
];

// ── 3F 층 레이아웃 (2F와 동일 구조, 확정 임차 다름) ─────────
const F3_UNITS: Rect[] = [
  // Row 1
  { id: '301', x: 20,  y: 25, w: 63, h: 110, confirmedBrand: '부동산' },
  { id: '302', x: 91,  y: 25, w: 55, h: 110, confirmedBrand: '언어발달' },
  { id: '303', x: 154, y: 25, w: 73, h: 110 },
  { id: '304', x: 235, y: 25, w: 55, h: 110 },
  { id: '305', x: 298, y: 25, w: 58, h: 110 },
  { id: '306', x: 364, y: 25, w: 30, h: 110 },
  { id: '307', x: 402, y: 25, w: 30, h: 110 },
  { id: '308', x: 440, y: 25, w: 30, h: 110, confirmedBrand: '입점완료' },
  { id: '309', x: 478, y: 25, w: 30, h: 110 },
  { id: '310', x: 516, y: 25, w: 30, h: 110, confirmedBrand: '입점완료' },
  { id: '311', x: 554, y: 25, w: 53, h: 110 },
  // Row 2
  { id: '312',   x: 20,  y: 155, w: 90,  h: 110 },
  { id: '313',   x: 118, y: 155, w: 104, h: 110 },
  { id: '314',   x: 230, y: 155, w: 96,  h: 110 },
  { id: '315',   x: 334, y: 155, w: 75,  h: 110 },
  { id: '316',   x: 417, y: 155, w: 78,  h: 110 },
  { id: '317-1', x: 503, y: 155, w: 85,  h: 110 },
  { id: '317-2', x: 596, y: 155, w: 41,  h: 110 },
  // Row 3
  { id: '318-1', x: 20,  y: 285, w: 47,  h: 110 },
  { id: '318-2', x: 75,  y: 285, w: 54,  h: 110 },
  { id: '318-3', x: 137, y: 285, w: 55,  h: 110 },
  { id: '319',   x: 200, y: 285, w: 105, h: 110 },
  { id: '320',   x: 313, y: 285, w: 67,  h: 110 },
  { id: '321',   x: 388, y: 285, w: 72,  h: 110 },
  { id: '322',   x: 468, y: 285, w: 86,  h: 110 },
];

const FLOOR_CONFIG: { key: string; label: string; rects: Rect[]; viewBox: string; core?: CoreBox }[] = [
  { key: 'B1', label: 'B1', rects: B1_UNITS, viewBox: '0 0 720 580', core: B1_CORE },
  { key: '1F', label: '1F', rects: F1_UNITS, viewBox: '0 0 930 255' },
  { key: '2F', label: '2F', rects: F2_UNITS, viewBox: '0 0 660 415' },
  { key: '3F', label: '3F', rects: F3_UNITS, viewBox: '0 0 660 415' },
];

type Popover = {
  unitNo: string;
  zone: string;
  exclusivePy: number;
  contractPy: number;
  status: string;
  svgX: number;
  svgY: number;
};

export default function FloorPlan({ units }: { units: PublicUnit[] }) {
  const [activeFloor, setActiveFloor] = useState('B1');
  const [popover, setPopover] = useState<Popover | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => { setPopover(null); }, [activeFloor]);

  const unitMap = new Map(units.map(u => [u.unit_no, u]));
  const floor = FLOOR_CONFIG.find(f => f.key === activeFloor)!;

  const handleClick = (rect: Rect, e: React.MouseEvent<SVGRectElement>) => {
    if (rect.confirmedBrand) return;
    const u = unitMap.get(rect.id);
    if (!u) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();
    const vb = floor.viewBox.split(' ').map(Number);
    const scaleX = svgRect.width / vb[2];
    const scaleY = svgRect.height / vb[3];
    setPopover({
      unitNo: rect.id,
      zone: u.zone,
      exclusivePy: u.exclusive_area_py,
      contractPy: u.contract_area_py,
      status: u.status,
      svgX: (rect.x + rect.w / 2) * scaleX,
      svgY: rect.y * scaleY,
    });
  };

  const getBg = (rect: Rect) => {
    if (rect.confirmedBrand) return '#9ca3af';
    const u = unitMap.get(rect.id);
    if (!u) return '#e5e7eb';
    const base = ZONE_COLOR[u.zone] ?? '#94a3b8';
    if (u.status === 'leased') return '#9ca3af';
    if (u.status === 'inquiry') return '#fbbf24';
    return base;
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* 탭 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {FLOOR_CONFIG.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFloor(f.key)}
            style={{
              padding: '8px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '14px', transition: 'all 0.15s',
              background: activeFloor === f.key ? '#1a1a1a' : '#f0f0f0',
              color: activeFloor === f.key ? '#e2a06e' : '#555',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 범례 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        {Object.entries(ZONE_LABEL).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#555' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: ZONE_COLOR[k], flexShrink: 0, display: 'inline-block' }} />
            {v}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#555' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#9ca3af', flexShrink: 0, display: 'inline-block' }} />
          입점완료
        </div>
      </div>

      {/* SVG 평면도 */}
      <div
        style={{ position: 'relative', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', background: '#f8f9fa', cursor: 'default' }}
        onClick={() => setPopover(null)}
      >
        <svg
          ref={svgRef}
          viewBox={floor.viewBox}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {/* 주차장·코어 박스 (B1 전용) */}
          {floor.core && (
            <g>
              <rect
                x={floor.core.x} y={floor.core.y} width={floor.core.w} height={floor.core.h}
                fill="#e5e7eb" fillOpacity={0.7} stroke="#d1d5db" strokeWidth={1.5}
                strokeDasharray="8 4" rx={4}
              />
              <text
                x={floor.core.x + floor.core.w / 2} y={floor.core.y + floor.core.h / 2 - 12}
                textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight="700" fill="#9ca3af"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {floor.core.label1}
              </text>
              {floor.core.label2 && (
                <text
                  x={floor.core.x + floor.core.w / 2} y={floor.core.y + floor.core.h / 2 + 12}
                  textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#b0b8c1"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {floor.core.label2}
                </text>
              )}
            </g>
          )}
          {floor.rects.map(rect => {
            const confirmed = !!rect.confirmedBrand;
            const u = unitMap.get(rect.id);
            const zone = u?.zone ?? '';
            const bg = getBg(rect);
            return (
              <g key={rect.id}>
                <rect
                  x={rect.x} y={rect.y} width={rect.w} height={rect.h}
                  fill={bg}
                  fillOpacity={confirmed ? 0.55 : 0.85}
                  stroke={confirmed ? '#9ca3af' : (ZONE_COLOR[zone] ?? '#94a3b8')}
                  strokeWidth={1.5}
                  rx={3}
                  style={{ cursor: confirmed ? 'default' : 'pointer' }}
                  onClick={confirmed ? undefined : (e) => { e.stopPropagation(); handleClick(rect, e); }}
                />
                {/* 호실 번호 */}
                <text
                  x={rect.x + rect.w / 2}
                  y={rect.y + (confirmed ? rect.h * 0.38 : rect.h * 0.42)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(rect.w, rect.h) < 60 ? 7 : 9}
                  fontWeight="700"
                  fill={confirmed ? '#6b7280' : '#fff'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {rect.id}
                </text>
                {/* 확정 브랜드명 */}
                {confirmed && (
                  <text
                    x={rect.x + rect.w / 2}
                    y={rect.y + rect.h * 0.65}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.min(rect.w, rect.h) < 60 ? 6 : 8}
                    fill="#6b7280"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {rect.confirmedBrand}
                  </text>
                )}
                {/* 공실 면적 표시 (빈 유닛) */}
                {!confirmed && u && (
                  <text
                    x={rect.x + rect.w / 2}
                    y={rect.y + rect.h * 0.72}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.min(rect.w, rect.h) < 60 ? 6 : 8}
                    fill="rgba(255,255,255,0.85)"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {u.exclusive_area_py.toFixed(1)}평
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* 팝오버 */}
        {popover && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(popover.svgX - 100, (svgRef.current?.clientWidth ?? 400) - 210),
              top: Math.max(popover.svgY - 160, 8),
              width: '200px',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              padding: '14px',
              zIndex: 10,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontWeight: 800, fontSize: '15px', color: '#1a1a1a' }}>{popover.unitNo}호</span>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                background: popover.status === 'vacant' ? '#dcfce7' : '#fef9c3',
                color: popover.status === 'vacant' ? '#166534' : '#92400e',
              }}>
                {STATUS_LABEL[popover.status] ?? popover.status}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>존</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{ZONE_LABEL[popover.zone] ?? popover.zone}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>전용면적</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{popover.exclusivePy.toFixed(1)}평</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>계약면적</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{popover.contractPy.toFixed(1)}평</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>임대조건</div>
                <div style={{ fontSize: '11px', color: '#888' }}>문의 시 안내</div>
              </div>
            </div>
            <a
              href="#precent-inquiry"
              style={{ display: 'block', textAlign: 'center', background: '#c47c30', color: '#fff', fontWeight: 700, fontSize: '13px', padding: '9px', borderRadius: '5px', textDecoration: 'none' }}
              onClick={() => setPopover(null)}
            >
              임대 문의하기
            </a>
          </div>
        )}
      </div>

      <p style={{ fontSize: '11px', color: '#aaa', marginTop: '8px', textAlign: 'center' }}>
        * 평면도는 실제 도면과 상이할 수 있는 개략도입니다. 호실 클릭 시 상세 정보를 확인하세요.
      </p>
    </div>
  );
}
