'use client';

import { useState, useRef, useEffect } from 'react';

export type PublicUnit = {
  unit_no: string;
  floor: string;
  zone: string;
  exclusive_area_py: number;
  contract_area_py: number;
  status: string;
  memo?: string | null;
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

    // ── 슬롯 정의 먼저 ──
  const upperSlots = [
    { id: 'B110', area: getArea('B110', 41.25) },
    { id: 'B111', area: getArea('B111', 40.50) },
    { id: 'B112', area: getArea('B112', 40.50) },
    { id: 'B113', area: getArea('B113', 41.25) },
  ];
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

  const availableW = CANVAS_W - LEFT_MARGIN - RIGHT_MARGIN; // 660
  const netW = availableW - GAP * (upperSlots.length - 1);   // 654
  const START_Y = TOP_MARGIN + UPPER_H + GAP;                // 187
  const availableH = CANVAS_H - START_Y - BOTTOM_MARGIN;     // 376
  const netH = availableH - GAP * (leftSlots.length - 1);    // 360

  const totalAreaUpper = upperSlots.reduce((s, sl) => s + sl.area, 0);
  const totalAreaLeft  = leftSlots.reduce((s, sl) => s + sl.area, 0);
  // 공통 스케일: UPPER_H = LEFT_W = 165 이므로 같은 S를 쓰면 픽셀 면적이 정확히 비례
  // netW(654)와 netH(360) 중 더 빨리 채워지는 방향이 S를 결정
  const S = Math.min(netW / totalAreaUpper, netH / totalAreaLeft);

  const rects: Rect[] = [];

  // 상단 4개: 너비 = area * S (UPPER_H=165 고정)
  let curX = LEFT_MARGIN;
  for (const sl of upperSlots) {
    const w = Math.round(sl.area * S);
    rects.push({ id: sl.id, x: curX, y: TOP_MARGIN, w, h: UPPER_H });
    curX += w + GAP;
  }

  // 좌측 9개: 높이 = area * S (LEFT_W=165 고정)
  let curY = START_Y;
  for (const sl of leftSlots) {
    const h = Math.round(sl.area * S);
    rects.push({ id: sl.id, x: LEFT_MARGIN, y: curY, w: LEFT_W, h });
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

// ── 2F 층 레이아웃: exclusive_area_py 비례 동적 계산 ──
//   공통 수평 스케일 S_h = RIGHT_W / max(totalAreaTop, totalAreaBot)
//   → 상단·하단 가로열이 동일한 1평당 px를 사용 (같은 면적 = 같은 너비)
//   왼쪽 열은 별도 S_v(수직)로 항상 LEFT_TOTAL_H를 채움
function computeF2Layout(units: PublicUnit[]): { rects: Rect[]; core: CoreBox } {
  const CANVAS_W = 720;
  const CANVAS_H = 580;
  const LEFT_X = 20;
  const LEFT_W = 196;           // BAND_H_TOP = BAND_H_BOT 와 통일 (2×196+147=539=LEFT_TOTAL_H)
  const TOP_MARGIN = 20;
  const BOT_MARGIN = 21;
  const RIGHT_X = 218;          // LEFT_X + LEFT_W + 2
  const RIGHT_W = 482;          // CANVAS_W - RIGHT_X - 20
  const CORE_W = 346;
  const BAND_H_TOP = 196;       // = LEFT_W ✓
  const BAND_H_MID = 147;
  const BAND_H_BOT = 196;       // = LEFT_W ✓
  const LEFT_TOTAL_H = CANVAS_H - TOP_MARGIN - BOT_MARGIN; // 539

  const getArea = (no: string, fallback: number) =>
    units.find(u => u.unit_no === no)?.exclusive_area_py ?? fallback;

  const rects: Rect[] = [];

  // ── 슬롯 정의 (스케일 계산 전에 모두 선언) ──
  const leftSlots: { id: string; area: number; confirmedBrand?: string }[] = [
    { id: '201', area: getArea('201', 49) },
    { id: '202', area: getArea('202', 49) },
    { id: '203', area: getArea('203', 49) },
    { id: '204', area: getArea('204', 49) },
    { id: '205', area: getArea('205', 49) },
    { id: '206', area: getArea('206', 49), confirmedBrand: '부동산' },
    { id: '207', area: getArea('207', 49) },
    { id: '208', area: getArea('208', 49) },
    { id: '209', area: getArea('209', 49) },
    { id: '210', area: getArea('210', 49) },
    { id: '211', area: getArea('211', 49) },
  ];
  const topSlots: { id: string; area: number }[] = [
    { id: '222',   area: getArea('222',   100) },
    { id: '221',   area: getArea('221',   95)  },
    { id: '220',   area: getArea('220',   100) },
    { id: '219',   area: getArea('219',   120) },
    { id: '218-3', area: getArea('218-3', 85)  },
    { id: '218-2', area: getArea('218-2', 68)  },
  ];
  const botSlots: { id: string; area: number }[] = [
    { id: '212', area: getArea('212', 100) },
    { id: '213', area: getArea('213', 115) },
    { id: '214', area: getArea('214', 110) },
    { id: '215', area: getArea('215', 110) },
    { id: '216', area: getArea('216', 133) },
  ];

  // ── 스케일 계산 ──
  const totalAreaLeft = leftSlots.reduce((s, sl) => s + sl.area, 0);
  const totalAreaTop  = topSlots.reduce((s, sl) => s + sl.area, 0);
  const totalAreaBot  = botSlots.reduce((s, sl) => s + sl.area, 0);
  // 단일 공통 스케일: LEFT_W = BAND_H_TOP = BAND_H_BOT = 196 이므로
  // S 하나로 모든 방향을 계산하면 픽셀 면적이 실제 면적에 정확히 비례
  const S = Math.min(
    LEFT_TOTAL_H / totalAreaLeft,
    RIGHT_W / Math.max(totalAreaTop, totalAreaBot)
  );

  // ── 왼쪽 열: S 적용 (LEFT_W=196 고정, 높이 비례) ──
  let curY = TOP_MARGIN;
  for (const sl of leftSlots) {
    const h = Math.round(sl.area * S);
    const r: Rect = { id: sl.id, x: LEFT_X, y: curY, w: LEFT_W, h };
    if (sl.confirmedBrand) r.confirmedBrand = sl.confirmedBrand;
    rects.push(r);
    curY += h;
  }

  // ── 오른쪽 상단 가로열: S 적용 (BAND_H_TOP=196 고정, 너비 비례) ──
  let curX = RIGHT_X;
  for (const sl of topSlots) {
    const w = Math.round(sl.area * S);
    rects.push({ id: sl.id, x: curX, y: TOP_MARGIN, w, h: BAND_H_TOP });
    curX += w;
  }

  // ── 오른쪽 중단: 코어 고정 + 217-2/right-col에 S 적용 (overflow 방지) ──
  const MID_Y = TOP_MARGIN + BAND_H_TOP;
  const MID_INNER_GAP = 2;
  const midRightNet = RIGHT_W - CORE_W - MID_INNER_GAP * 2; // 482-346-4=132
  const area2172 = getArea('217-2', 150);
  const area2181 = getArea('218-1', 72);
  const area2171 = getArea('217-1', 73);
  const raw2172    = Math.round(area2172 * S);
  const rawRightCW = Math.round((area2181 + area2171) * S);
  const midScale   = (raw2172 + rawRightCW + MID_INNER_GAP) > midRightNet
    ? midRightNet / (raw2172 + rawRightCW + MID_INNER_GAP) : 1;
  const w2172     = Math.max(10, Math.round(raw2172    * midScale));
  const rightColW = Math.max(20, Math.round(rawRightCW * midScale));
  const x2172    = RIGHT_X + CORE_W + MID_INNER_GAP;
  const xRightCol = x2172 + w2172 + MID_INNER_GAP;

  rects.push({ id: '217-2', x: x2172, y: MID_Y, w: w2172, h: BAND_H_MID });
  const netMidH = BAND_H_MID - MID_INNER_GAP;
  const h2181 = Math.round(area2181 / (area2181 + area2171) * netMidH);
  const h2171 = netMidH - h2181;
  rects.push({ id: '218-1', x: xRightCol, y: MID_Y,                         w: rightColW, h: h2181 });
  rects.push({ id: '217-1', x: xRightCol, y: MID_Y + h2181 + MID_INNER_GAP, w: rightColW, h: h2171 });

  // ── 오른쪽 하단 가로열: S 적용 (BAND_H_BOT=196 고정, 너비 비례) ──
  const BOT_Y = MID_Y + BAND_H_MID;
  curX = RIGHT_X;
  for (const sl of botSlots) {
    const w = Math.round(sl.area * S);
    rects.push({ id: sl.id, x: curX, y: BOT_Y, w, h: BAND_H_BOT });
    curX += w;
  }

  const core: CoreBox = {
    x: RIGHT_X, y: MID_Y, w: CORE_W, h: BAND_H_MID,
    label1: '코어',
    label2: '(계단·엘리베이터)',
  };

  return { rects, core };
}

// ── 3F 층 레이아웃: 2F와 동일 구조, 공통 수평 스케일 S_h 적용 ──
//   S_h = RIGHT_W / max(totalAreaTop, totalAreaBot) — 상단/하단 동일 1평당 px
function computeF3Layout(units: PublicUnit[]): { rects: Rect[]; core: CoreBox } {
  const CANVAS_W = 720;
  const CANVAS_H = 580;
  const LEFT_X = 20;
  const LEFT_W = 196;           // BAND_H_TOP = BAND_H_BOT 와 통일
  const TOP_MARGIN = 20;
  const BOT_MARGIN = 21;
  const RIGHT_X = 218;          // LEFT_X + LEFT_W + 2
  const RIGHT_W = 482;          // CANVAS_W - RIGHT_X - 20
  const CORE_W = 346;
  const BAND_H_TOP = 196;       // = LEFT_W ✓
  const BAND_H_MID = 147;
  const BAND_H_BOT = 196;       // = LEFT_W ✓
  const LEFT_TOTAL_H = CANVAS_H - TOP_MARGIN - BOT_MARGIN; // 539

  const getArea = (no: string, fallback: number) =>
    units.find(u => u.unit_no === no)?.exclusive_area_py ?? fallback;

  const rects: Rect[] = [];

  // ── 슬롯 정의 ──
  const leftSlots: { id: string; area: number; idLabel?: string }[] = [
    { id: '301-302', area: getArea('301-302', 98), idLabel: '301-302' },
    { id: '303', area: getArea('303', 49) },
    { id: '304', area: getArea('304', 49) },
    { id: '305', area: getArea('305', 49) },
    { id: '306', area: getArea('306', 49) },
    { id: '307', area: getArea('307', 49) },
    { id: '308', area: getArea('308', 49) },
    { id: '309', area: getArea('309', 49) },
    { id: '310', area: getArea('310', 49) },
    { id: '311', area: getArea('311', 49) },
  ];
  const topSlots: { id: string; area: number }[] = [
    { id: '322',   area: getArea('322',   95) },
    { id: '321',   area: getArea('321',   95) },
    { id: '320',   area: getArea('320',   95) },
    { id: '319',   area: getArea('319',   95) },
    { id: '318-3', area: getArea('318-3', 95) },
    { id: '318-2', area: getArea('318-2', 93) },
  ];
  const botSlots: { id: string; area: number }[] = [
    { id: '312', area: getArea('312', 113) },
    { id: '313', area: getArea('313', 114) },
    { id: '314', area: getArea('314', 114) },
    { id: '315', area: getArea('315', 114) },
    { id: '316', area: getArea('316', 113) },
  ];

  // ── 스케일 계산 ──
  const totalAreaLeft = leftSlots.reduce((s, sl) => s + sl.area, 0);
  const totalAreaTop  = topSlots.reduce((s, sl) => s + sl.area, 0);
  const totalAreaBot  = botSlots.reduce((s, sl) => s + sl.area, 0);
  // 단일 공통 스케일: LEFT_W = BAND_H_TOP = BAND_H_BOT = 196
  const S = Math.min(
    LEFT_TOTAL_H / totalAreaLeft,
    RIGHT_W / Math.max(totalAreaTop, totalAreaBot)
  );

  // ── 왼쪽 열: S 적용 (LEFT_W=196 고정, 높이 비례) ──
  let curY = TOP_MARGIN;
  for (const sl of leftSlots) {
    const h = Math.round(sl.area * S);
    const r: Rect = { id: sl.id, x: LEFT_X, y: curY, w: LEFT_W, h };
    if (sl.idLabel) r.idLabel = sl.idLabel;
    rects.push(r);
    curY += h;
  }

  // ── 오른쪽 상단 가로열: S 적용 (BAND_H_TOP=196 고정, 너비 비례) ──
  let curX = RIGHT_X;
  for (const sl of topSlots) {
    const w = Math.round(sl.area * S);
    rects.push({ id: sl.id, x: curX, y: TOP_MARGIN, w, h: BAND_H_TOP });
    curX += w;
  }

  // ── 오른쪽 중단: S 적용 (overflow 방지) ──
  const MID_Y = TOP_MARGIN + BAND_H_TOP;
  const MID_INNER_GAP = 2;
  const midRightNet = RIGHT_W - CORE_W - MID_INNER_GAP * 2; // 482-346-4=132
  const area3172 = getArea('317-2', 150);
  const area3181 = getArea('318-1', 72);
  const area3171 = getArea('317-1', 73);
  const raw3172    = Math.round(area3172 * S);
  const rawRightCW = Math.round((area3181 + area3171) * S);
  const midScale   = (raw3172 + rawRightCW + MID_INNER_GAP) > midRightNet
    ? midRightNet / (raw3172 + rawRightCW + MID_INNER_GAP) : 1;
  const w3172     = Math.max(10, Math.round(raw3172    * midScale));
  const rightColW = Math.max(20, Math.round(rawRightCW * midScale));
  const x3172    = RIGHT_X + CORE_W + MID_INNER_GAP;
  const xRightCol = x3172 + w3172 + MID_INNER_GAP;

  rects.push({ id: '317-2', x: x3172, y: MID_Y, w: w3172, h: BAND_H_MID });
  const netMidH = BAND_H_MID - MID_INNER_GAP;
  const h3181 = Math.round(area3181 / (area3181 + area3171) * netMidH);
  const h3171 = netMidH - h3181;
  rects.push({ id: '318-1', x: xRightCol, y: MID_Y,                         w: rightColW, h: h3181 });
  rects.push({ id: '317-1', x: xRightCol, y: MID_Y + h3181 + MID_INNER_GAP, w: rightColW, h: h3171 });

  // ── 오른쪽 하단 가로열: S 적용 (BAND_H_BOT=196 고정, 너비 비례) ──
  const BOT_Y = MID_Y + BAND_H_MID;
  curX = RIGHT_X;
  for (const sl of botSlots) {
    const w = Math.round(sl.area * S);
    rects.push({ id: sl.id, x: curX, y: BOT_Y, w, h: BAND_H_BOT });
    curX += w;
  }

  const core: CoreBox = {
    x: RIGHT_X, y: MID_Y, w: CORE_W, h: BAND_H_MID,
    label1: '코어',
    label2: '(계단·엘리베이터)',
  };

  return { rects, core };
}


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
  const f2 = computeF2Layout(units);
  const f3 = computeF3Layout(units);
  const FLOOR_CONFIG: { key: string; label: string; rects: Rect[]; viewBox: string; core?: CoreBox }[] = [
    { key: 'B1', label: 'B1', rects: b1.rects, viewBox: '0 0 720 580', core: b1.core },
    { key: '1F', label: '1F', rects: f1.rects, viewBox: '0 0 720 580', core: f1.core },
    { key: '2F', label: '2F', rects: f2.rects, viewBox: '0 0 720 580', core: f2.core },
    { key: '3F', label: '3F', rects: f3.rects, viewBox: '0 0 720 580', core: f3.core },
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
            // memo에서 브랜드명 추출: "치과(입점확정)" → "치과"
            const memoLabel = u?.memo ? u.memo.replace(/\s*\(.*?\)\s*$/, '').trim() : null;
            const secondLabel = confirmed ? rect.confirmedBrand! : isLeased ? (memoLabel ?? '임대완료') : null;
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
