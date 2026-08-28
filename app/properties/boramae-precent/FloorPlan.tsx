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

const ZONE_RECOMMEND: Record<string, string> = {
  large: '피트니스·대형 학원·대형 F&B 등',
  small: '창고·수납 공간 등',
  'street-fb': '카페·식음료·테이크아웃 등',
  'clinic-academy': '병의원·클리닉·학원·상담센터 등',
  'mid-office': '사무실·뷰티샵·헬스케어 등',
  'section-office': '1인 사무실·스타트업·프리랜서 등',
};

const STATUS_LABEL: Record<string, string> = {
  vacant: '공실',
  inquiry: '문의중',
  leased: '임대완료',
};

type Rect = { id: string; x: number; y: number; w: number; h: number; confirmedBrand?: string; idLabel?: string };

// ── B1 층 레이아웃 (실제 도면 기반: 상단 4대형 + 좌측 세로 9소형 + 중앙 주차코어) ──
type CoreBox = { x: number; y: number; w: number; h: number; label1: string; label2?: string };

// 상단 4개(B110~B113): 너비를 exclusive_area_py 비례로 계산
// 좌측 9개(B109~B101): 높이를 exclusive_area_py 비례로 계산
// 코어·캔버스 크기는 기존 고정값 유지
function computeB1Layout(units: PublicUnit[]): { rects: Rect[]; core: CoreBox } {
  const CANVAS_W = 720;
  const CANVAS_H = 580;
  const LEFT_MARGIN = 20;
  const RIGHT_MARGIN = 40; // 우측 여백 (원본 기준 680px 우단)
  const TOP_MARGIN = 20;
  const BOTTOM_MARGIN = 17;
  const UPPER_H = 165; // 상단 행 고정 높이
  const LEFT_W = 165;  // 좌측 열 고정 너비
  const GAP = 2;

  const getArea = (no: string, fallback: number) =>
    units.find(u => u.unit_no === no)?.exclusive_area_py ?? fallback;

  // 상단 4개: 너비 비례 (원본 165:162:162:165 비율이 기본값)
  const upperSlots = [
    { id: 'B110', area: getArea('B110', 41.25) },
    { id: 'B111', area: getArea('B111', 40.50) },
    { id: 'B112', area: getArea('B112', 40.50) },
    { id: 'B113', area: getArea('B113', 41.25) },
  ];

  const availableW = CANVAS_W - LEFT_MARGIN - RIGHT_MARGIN; // 660
  const netW = availableW - GAP * (upperSlots.length - 1);   // 654
  const totalAreaUpper = upperSlots.reduce((s, sl) => s + sl.area, 0);
  const scaleW = netW / totalAreaUpper;

  const rects: Rect[] = [];
  let curX = LEFT_MARGIN;
  const upperWidths: number[] = [];
  for (let i = 0; i < upperSlots.length; i++) {
    const w = i < upperSlots.length - 1
      ? Math.round(upperSlots[i].area * scaleW)
      : netW - upperWidths.reduce((s, v) => s + v, 0);
    upperWidths.push(w);
    rects.push({ id: upperSlots[i].id, x: curX, y: TOP_MARGIN, w, h: UPPER_H });
    curX += w + GAP;
  }

  // 좌측 9개: 높이 비례 (위→아래: B109~B101, 원본은 모두 h=40으로 균등)
  const leftSlots = [
    { id: 'B109', area: getArea('B109', 4.44) },
    { id: 'B108', area: getArea('B108', 4.44) },
    { id: 'B107', area: getArea('B107', 4.44) },
    { id: 'B106', area: getArea('B106', 4.44) },
    { id: 'B105', area: getArea('B105', 4.44) },
    { id: 'B104', area: getArea('B104', 4.44) },
    { id: 'B103', area: getArea('B103', 4.44) },
    { id: 'B102', area: getArea('B102', 4.44) },
    { id: 'B101', area: getArea('B101', 4.44) },
  ];

  const START_Y = TOP_MARGIN + UPPER_H + GAP; // 187
  const availableH = CANVAS_H - START_Y - BOTTOM_MARGIN; // 376
  const netH = availableH - GAP * (leftSlots.length - 1); // 360
  const totalAreaLeft = leftSlots.reduce((s, sl) => s + sl.area, 0);
  const scaleH = netH / totalAreaLeft;

  let curY = START_Y;
  const leftHeights: number[] = [];
  for (let i = 0; i < leftSlots.length; i++) {
    const h = i < leftSlots.length - 1
      ? Math.round(leftSlots[i].area * scaleH)
      : netH - leftHeights.reduce((s, v) => s + v, 0);
    leftHeights.push(h);
    rects.push({ id: leftSlots[i].id, x: LEFT_MARGIN, y: curY, w: LEFT_W, h });
    curY += h + GAP;
  }

  const CORE_X = LEFT_MARGIN + LEFT_W + GAP; // 187
  const CORE_W = CANVAS_W - RIGHT_MARGIN - CORE_X; // 493
  const core: CoreBox = {
    x: CORE_X, y: START_Y, w: CORE_W, h: availableH,
    label1: '주차장 · 코어',
    label2: '(계단 · 엘리베이터)',
  };

  return { rects, core };
}

// ── 1F 층 레이아웃: exclusive_area_py 비례 동적 계산 ──
//   왼쪽: 단일 세로열 101→108, 각 칸 높이를 면적 비례로 계산
//   오른쪽 상단: 스타벅스(111~114) — 101+102 높이 범위
//   오른쪽 중단: 코어 — 103-104+105 높이 범위
//   오른쪽 하단: 110(위)+109(아래) — 106+107+108 높이 범위, 면적 비례 분할
function computeF1Layout(units: PublicUnit[]): { rects: Rect[]; core: CoreBox } {
  const CANVAS_H = 580;
  const MARGIN = 10;
  const GAP = 2;
  const LEFT_X = 20;
  const LEFT_W = 200;
  const RIGHT_X = 228;
  const RIGHT_W = 472;

  const getArea = (no: string, fallback: number) =>
    units.find(u => u.unit_no === no)?.exclusive_area_py ?? fallback;

  // 왼쪽 단일 열: 위→아래 순서, 확정 입점 칸은 참조 면적으로 높이 할당
  const leftSlots: { id: string; area: number; confirmedBrand?: string; idLabel?: string }[] = [
    { id: '101',     area: getArea('101', 10.68) },
    { id: '102',     area: 10.0,  confirmedBrand: 'KT' },
    { id: '103-104', area: 20.0,  confirmedBrand: '파리바게뜨', idLabel: '103-104' },
    { id: '105',     area: getArea('105', 10.08) },
    { id: '106',     area: 10.0,  confirmedBrand: '분식' },
    { id: '107',     area: 10.0,  confirmedBrand: '메머드커피' },
    { id: '108',     area: getArea('108', 6.01) },
  ];

  const totalArea = leftSlots.reduce((s, sl) => s + sl.area, 0);
  const totalGap = GAP * (leftSlots.length - 1);
  const scaleH = (CANVAS_H - MARGIN * 2 - totalGap) / totalArea;

  const rects: Rect[] = [];
  const slotYs: number[] = [];
  const slotHs: number[] = [];
  let curY = MARGIN;

  for (const slot of leftSlots) {
    const h = Math.round(slot.area * scaleH);
    slotYs.push(curY);
    slotHs.push(h);
    const r: Rect = { id: slot.id, x: LEFT_X, y: curY, w: LEFT_W, h };
    if (slot.confirmedBrand) r.confirmedBrand = slot.confirmedBrand;
    if (slot.idLabel) r.idLabel = slot.idLabel;
    rects.push(r);
    curY += h + GAP;
  }

  // 오른쪽 상단 — 스타벅스(111~114): 101+102 높이 범위
  const sbY = slotYs[0];
  const sbH = slotYs[1] + slotHs[1] - slotYs[0];
  rects.push({ id: '111', x: RIGHT_X, y: sbY, w: RIGHT_W, h: sbH + GAP, confirmedBrand: '스타벅스', idLabel: '111~114' });

  // 오른쪽 하단 — 110(위)/109(아래): 106+107+108 높이 범위, 면적 비례 2분할
  const bottomY = slotYs[4];
  const bottomTotalH = slotYs[6] + slotHs[6] - slotYs[4];
  const area110 = getArea('110', 9.56);
  const area109 = getArea('109', 9.56);
  const h110 = Math.round(bottomTotalH * area110 / (area110 + area109));
  const h109 = bottomTotalH - h110 - GAP;
  rects.push({ id: '110', x: RIGHT_X, y: bottomY, w: RIGHT_W, h: h110 });
  rects.push({ id: '109', x: RIGHT_X, y: bottomY + h110 + GAP, w: RIGHT_W, h: h109 });

  // 코어: 103-104+105 높이 범위
  const coreY = slotYs[2];
  const coreH = slotYs[3] + slotHs[3] - slotYs[2] + GAP;
  const core: CoreBox = { x: RIGHT_X, y: coreY, w: RIGHT_W, h: coreH, label1: '코어 · 로비', label2: '(계단 · 엘리베이터)' };

  return { rects, core };
}

// ── 2F 층 레이아웃 (720×580 기준, 실제 도면 구조)
//   왼쪽: 단일 세로열 201→211 (h=49×11)
//   오른쪽 상단: 222,221,220,219,218-3,218-2 가로열 (y=20, h=196)
//   오른쪽 중단: 코어(좌) + 217-2(중) + 218-1/217-1(우) (y=216, h=147)
//   오른쪽 하단: 212,213,214,215,216 가로열 (y=363, h=196)
const F2_UNITS: Rect[] = [
  // ─ 왼쪽 단일 열 (x=20, w=110, h=49) ─
  { id: '201', x: 20, y: 20,  w: 110, h: 49 },
  { id: '202', x: 20, y: 69,  w: 110, h: 49 },
  { id: '203', x: 20, y: 118, w: 110, h: 49 },
  { id: '204', x: 20, y: 167, w: 110, h: 49 },
  { id: '205', x: 20, y: 216, w: 110, h: 49 },
  { id: '206', x: 20, y: 265, w: 110, h: 49, confirmedBrand: '부동산' },
  { id: '207', x: 20, y: 314, w: 110, h: 49 },
  { id: '208', x: 20, y: 363, w: 110, h: 49 },
  { id: '209', x: 20, y: 412, w: 110, h: 49 },
  { id: '210', x: 20, y: 461, w: 110, h: 49 },
  { id: '211', x: 20, y: 510, w: 110, h: 49 },
  // ─ 오른쪽 상단 가로열 (222→218-2, 좌→우, y=20, h=196) ─
  { id: '222',   x: 132, y: 20, w: 100, h: 196 },
  { id: '221',   x: 232, y: 20, w: 95,  h: 196 },
  { id: '220',   x: 327, y: 20, w: 100, h: 196 },
  { id: '219',   x: 427, y: 20, w: 120, h: 196 },
  { id: '218-3', x: 547, y: 20, w: 85,  h: 196 },
  { id: '218-2', x: 632, y: 20, w: 68,  h: 196 },
  // ─ 오른쪽 중단: 217-2 + 218-1(위)/217-1(아래) (y=216, h=147) ─
  { id: '217-2', x: 480, y: 216, w: 150, h: 147 },
  { id: '218-1', x: 632, y: 216, w: 68,  h: 72  },
  { id: '217-1', x: 632, y: 290, w: 68,  h: 73  },
  // ─ 오른쪽 하단 가로열 (212→216, 좌→우, y=363, h=196) ─
  { id: '212', x: 132, y: 363, w: 100, h: 196 },
  { id: '213', x: 232, y: 363, w: 115, h: 196 },
  { id: '214', x: 347, y: 363, w: 110, h: 196 },
  { id: '215', x: 457, y: 363, w: 110, h: 196 },
  { id: '216', x: 567, y: 363, w: 133, h: 196 },
];

const F2_CORE: CoreBox = {
  x: 132, y: 216, w: 346, h: 147,
  label1: '코어',
  label2: '(계단·엘리베이터)',
};

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

  const b1 = computeB1Layout(units);
  const f1 = computeF1Layout(units);
  const FLOOR_CONFIG: { key: string; label: string; rects: Rect[]; viewBox: string; core?: CoreBox }[] = [
    { key: 'B1', label: 'B1', rects: b1.rects, viewBox: '0 0 720 580', core: b1.core },
    { key: '1F', label: '1F', rects: f1.rects, viewBox: '0 0 720 580', core: f1.core },
    { key: '2F', label: '2F', rects: F2_UNITS, viewBox: '0 0 720 580', core: F2_CORE },
    { key: '3F', label: '3F', rects: F3_UNITS, viewBox: '0 0 720 580' },
  ];

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

  const VACANT_COLOR = '#2563eb';
  const LEASED_COLOR = '#9ca3af';

  const getBg = (rect: Rect) => {
    if (rect.confirmedBrand) return LEASED_COLOR;
    const u = unitMap.get(rect.id);
    if (!u) return '#e5e7eb';
    if (u.status === 'leased') return LEASED_COLOR;
    return VACANT_COLOR; // vacant + inquiry 동일 강조색
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
      <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#555' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#2563eb', flexShrink: 0, display: 'inline-block' }} />
          공실
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#555' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#9ca3af', flexShrink: 0, display: 'inline-block' }} />
          임대완료
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
            const isLeased = !confirmed && u?.status === 'leased';
            const unavailable = confirmed || isLeased;
            const bg = getBg(rect);
            const secondLabel = confirmed ? rect.confirmedBrand! : isLeased ? '임대완료' : null;
            return (
              <g key={rect.id}>
                <rect
                  x={rect.x} y={rect.y} width={rect.w} height={rect.h}
                  fill={bg}
                  fillOpacity={unavailable ? 0.9 : 0.85}
                  stroke={unavailable ? '#94a3b8' : '#1d4ed8'}
                  strokeWidth={1.5}
                  rx={3}
                  style={{ cursor: unavailable ? 'default' : 'pointer' }}
                  onClick={unavailable ? undefined : (e) => { e.stopPropagation(); handleClick(rect, e); }}
                />
                {/* 호실 번호 — 고정 폰트 9px */}
                <text
                  x={rect.x + rect.w / 2}
                  y={rect.y + (unavailable ? rect.h * 0.38 : u ? rect.h * 0.38 : rect.h * 0.5)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9}
                  fontWeight="700"
                  fill="#fff"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {rect.idLabel ?? rect.id}
                </text>
                {/* 임대완료·확정브랜드 — 고정 폰트 10px */}
                {secondLabel && (
                  <text
                    x={rect.x + rect.w / 2}
                    y={rect.y + rect.h * 0.65}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={10}
                    fontWeight="700"
                    fill="rgba(255,255,255,0.9)"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {secondLabel}
                  </text>
                )}
                {/* 공실 면적 — 고정 폰트 8px */}
                {!unavailable && u && (
                  <text
                    x={rect.x + rect.w / 2}
                    y={rect.y + rect.h * 0.65}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={8}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>전용면적</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{popover.exclusivePy.toFixed(1)}평</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>계약면적</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{popover.contractPy.toFixed(1)}평</div>
              </div>
            </div>
            {ZONE_RECOMMEND[popover.zone] && (
              <div style={{ background: '#f0f9ff', borderRadius: '6px', padding: '7px 10px', marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: 700, marginBottom: '2px' }}>추천 업종</div>
                <div style={{ fontSize: '11px', color: '#0c4a6e' }}>{ZONE_RECOMMEND[popover.zone]}</div>
              </div>
            )}
            <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '10px', textAlign: 'center' }}>임대조건 문의 시 안내</div>
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
