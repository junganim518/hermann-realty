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

type Rect = { id: string; x: number; y: number; w: number; h: number; confirmedBrand?: string; idLabel?: string };

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

// ── 1F 층 레이아웃 (720×580 기준, 좌측 3행 + 코어 + 우측 스타벅스 + 하단 109·110) ──
const F1_UNITS: Rect[] = [
  // 상단 단독 - 101
  { id: '101', x: 20,  y: 20,  w: 300, h: 125 },
  // 중앙 상단열 (좌→우): 102(KT), 103-104(파리바게뜨), 105
  { id: '102', x: 20,  y: 147, w: 96,  h: 205, confirmedBrand: 'KT' },
  { id: '103', x: 118, y: 147, w: 128, h: 205, confirmedBrand: '파리바게뜨', idLabel: '103-104' },
  { id: '105', x: 248, y: 147, w: 72,  h: 205 },
  // 하단열 (좌→우): 106(분식), 107(메머드커피), 108
  { id: '106', x: 20,  y: 354, w: 96,  h: 206, confirmedBrand: '분식' },
  { id: '107', x: 118, y: 354, w: 128, h: 206, confirmedBrand: '메머드커피' },
  { id: '108', x: 248, y: 354, w: 72,  h: 206 },
  // 우측 대형 블록 - 스타벅스 111~114
  { id: '111', x: 404, y: 20,  w: 296, h: 330, confirmedBrand: '스타벅스', idLabel: '111~114' },
  // 우측 하단 - 109(좌), 110(우)
  { id: '109', x: 404, y: 352, w: 148, h: 208 },
  { id: '110', x: 554, y: 352, w: 146, h: 208 },
];

const F1_CORE: CoreBox = {
  x: 322, y: 147, w: 80, h: 413,
  label1: '코어',
  label2: '(계단·엘리베이터)',
};

// ── 2F 층 레이아웃 (720×580 기준, 3행 구조) ──────────────────
const F2_UNITS: Rect[] = [
  // Row 1 (y=20, h=170)
  { id: '201', x: 22,  y: 20, w: 69, h: 170 },
  { id: '202', x: 99,  y: 20, w: 60, h: 170 },
  { id: '203', x: 168, y: 20, w: 80, h: 170 },
  { id: '204', x: 257, y: 20, w: 60, h: 170 },
  { id: '205', x: 325, y: 20, w: 63, h: 170 },
  { id: '206', x: 397, y: 20, w: 33, h: 170 },
  { id: '207', x: 439, y: 20, w: 33, h: 170, confirmedBrand: '치과' },
  { id: '208', x: 480, y: 20, w: 33, h: 170 },
  { id: '209', x: 521, y: 20, w: 33, h: 170 },
  { id: '210', x: 562, y: 20, w: 33, h: 170 },
  { id: '211', x: 604, y: 20, w: 57, h: 170 },
  // Row 2 (y=210, h=170)
  { id: '212',   x: 22,  y: 210, w: 98,  h: 170 },
  { id: '213',   x: 129, y: 210, w: 113, h: 170 },
  { id: '214',   x: 251, y: 210, w: 105, h: 170 },
  { id: '215',   x: 364, y: 210, w: 82,  h: 170 },
  { id: '216',   x: 455, y: 210, w: 85,  h: 170 },
  { id: '217-1', x: 549, y: 210, w: 93,  h: 170 },
  { id: '217-2', x: 651, y: 210, w: 44,  h: 170 },
  // Row 3 (y=400, h=160)
  { id: '218-1', x: 22,  y: 400, w: 51,  h: 160 },
  { id: '218-2', x: 82,  y: 400, w: 59,  h: 160 },
  { id: '218-3', x: 150, y: 400, w: 60,  h: 160 },
  { id: '219',   x: 219, y: 400, w: 115, h: 160 },
  { id: '220',   x: 342, y: 400, w: 73,  h: 160 },
  { id: '221',   x: 424, y: 400, w: 79,  h: 160 },
  { id: '222',   x: 512, y: 400, w: 94,  h: 160 },
];

// ── 3F 층 레이아웃 (2F와 동일 구조, 확정 임차 다름) ─────────
const F3_UNITS: Rect[] = [
  // Row 1 (y=20, h=170)
  { id: '301', x: 22,  y: 20, w: 69, h: 170, confirmedBrand: '부동산' },
  { id: '302', x: 99,  y: 20, w: 60, h: 170, confirmedBrand: '언어발달' },
  { id: '303', x: 168, y: 20, w: 80, h: 170 },
  { id: '304', x: 257, y: 20, w: 60, h: 170 },
  { id: '305', x: 325, y: 20, w: 63, h: 170 },
  { id: '306', x: 397, y: 20, w: 33, h: 170 },
  { id: '307', x: 439, y: 20, w: 33, h: 170 },
  { id: '308', x: 480, y: 20, w: 33, h: 170, confirmedBrand: '입점완료' },
  { id: '309', x: 521, y: 20, w: 33, h: 170 },
  { id: '310', x: 562, y: 20, w: 33, h: 170, confirmedBrand: '입점완료' },
  { id: '311', x: 604, y: 20, w: 57, h: 170 },
  // Row 2 (y=210, h=170)
  { id: '312',   x: 22,  y: 210, w: 98,  h: 170 },
  { id: '313',   x: 129, y: 210, w: 113, h: 170 },
  { id: '314',   x: 251, y: 210, w: 105, h: 170 },
  { id: '315',   x: 364, y: 210, w: 82,  h: 170 },
  { id: '316',   x: 455, y: 210, w: 85,  h: 170 },
  { id: '317-1', x: 549, y: 210, w: 93,  h: 170 },
  { id: '317-2', x: 651, y: 210, w: 44,  h: 170 },
  // Row 3 (y=400, h=160)
  { id: '318-1', x: 22,  y: 400, w: 51,  h: 160 },
  { id: '318-2', x: 82,  y: 400, w: 59,  h: 160 },
  { id: '318-3', x: 150, y: 400, w: 60,  h: 160 },
  { id: '319',   x: 219, y: 400, w: 115, h: 160 },
  { id: '320',   x: 342, y: 400, w: 73,  h: 160 },
  { id: '321',   x: 424, y: 400, w: 79,  h: 160 },
  { id: '322',   x: 512, y: 400, w: 94,  h: 160 },
];

const FLOOR_CONFIG: { key: string; label: string; rects: Rect[]; viewBox: string; core?: CoreBox }[] = [
  { key: 'B1', label: 'B1', rects: B1_UNITS, viewBox: '0 0 720 580', core: B1_CORE },
  { key: '1F', label: '1F', rects: F1_UNITS, viewBox: '0 0 720 580', core: F1_CORE },
  { key: '2F', label: '2F', rects: F2_UNITS, viewBox: '0 0 720 580' },
  { key: '3F', label: '3F', rects: F3_UNITS, viewBox: '0 0 720 580' },
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
    if (rect.confirmedBrand) return '#dc2626';
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
          <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#dc2626', flexShrink: 0, display: 'inline-block' }} />
          입점확정
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
                  fillOpacity={confirmed ? 0.9 : 0.85}
                  stroke={confirmed ? '#b91c1c' : (ZONE_COLOR[zone] ?? '#94a3b8')}
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
                  fontSize={confirmed ? Math.max(9, Math.min(Math.floor(Math.min(rect.w, rect.h) / 10), 14)) : (Math.min(rect.w, rect.h) < 60 ? 7 : 9)}
                  fontWeight="700"
                  fill="#fff"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {rect.idLabel ?? rect.id}
                </text>
                {/* 확정 브랜드명 */}
                {confirmed && (
                  <text
                    x={rect.x + rect.w / 2}
                    y={rect.y + rect.h * 0.65}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.max(8, Math.min(Math.floor(Math.min(rect.w, rect.h) / 9), 18))}
                    fontWeight="700"
                    fill="rgba(255,255,255,0.95)"
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
