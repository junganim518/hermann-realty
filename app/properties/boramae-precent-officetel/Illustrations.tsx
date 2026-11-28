// 프리센트 오피스텔 페이지 전용 — 직접 그린 라인+플랫 일러스트(순수 SVG, 서버에서도 렌더됨).
// 실존 브랜드/로고/캐릭터를 모방하지 않은 단순 도형이며, 글자(<text>)는 전혀 쓰지 않는다.
// 크기는 각 사용처의 CSS(officetel.module.css)가 descendant `svg` 선택자로 지정한다
// (여기서는 크기 속성을 주지 않음 — 장식용이라 aria-hidden="true").
import type { ReactNode } from 'react';

const INK = '#3A2F26';
const GOLD = '#B8873B';
const CREAM = '#F3EADB';
const PAPER = '#FFFFFF';

function Base({ viewBox, children }: { viewBox: string; children: ReactNode }) {
  return (
    <svg viewBox={viewBox} aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}

/* ── 대형 일러스트 ── */

// a) 특별 혜택 — 건물 + 열쇠 + 동전 (방패 등 단정적 상징 없음)
export function BenefitIllustration() {
  return (
    <Base viewBox="0 0 160 160">
      <rect x="18" y="38" width="62" height="100" rx="6" fill={CREAM} stroke={INK} strokeWidth="2.5" />
      {[0, 1, 2, 3].map(row => (
        <g key={row}>
          <rect x={30} y={52 + row * 20} width="12" height="12" rx="2" fill={PAPER} stroke={GOLD} strokeWidth="2" />
          <rect x={54} y={52 + row * 20} width="12" height="12" rx="2" fill={PAPER} stroke={GOLD} strokeWidth="2" />
        </g>
      ))}
      <rect x="40" y="118" width="18" height="20" rx="2" fill={GOLD} />
      <circle cx="118" cy="96" r="30" fill={CREAM} stroke={GOLD} strokeWidth="3" />
      <circle cx="118" cy="96" r="20" fill="none" stroke={GOLD} strokeWidth="2" />
      <line x1="118" y1="84" x2="118" y2="108" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <g transform="translate(94 22) rotate(35)">
        <circle cx="10" cy="10" r="10" fill="none" stroke={INK} strokeWidth="3" />
        <line x1="19" y1="10" x2="44" y2="10" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <line x1="34" y1="10" x2="34" y2="18" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <line x1="42" y1="10" x2="42" y2="16" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      </g>
    </Base>
  );
}

// d) 단지 개요 — 도시 건물(고층 오피스텔 스카이라인)
export function ComplexIllustration() {
  return (
    <Base viewBox="0 0 160 160">
      <circle cx="128" cy="34" r="14" fill={CREAM} stroke={GOLD} strokeWidth="2" />
      <rect x="20" y="70" width="28" height="68" fill={PAPER} stroke={INK} strokeWidth="2.5" rx="3" />
      <rect x="54" y="46" width="34" height="92" fill={CREAM} stroke={INK} strokeWidth="2.5" rx="3" />
      <rect x="94" y="58" width="30" height="80" fill={PAPER} stroke={INK} strokeWidth="2.5" rx="3" />
      {[0, 1, 2].map(r => (
        <g key={`a${r}`}>
          <rect x="26" y={82 + r * 18} width="8" height="8" fill={GOLD} opacity="0.5" />
          <rect x="38" y={82 + r * 18} width="8" height="8" fill={GOLD} opacity="0.5" />
        </g>
      ))}
      {[0, 1, 2, 3].map(r => (
        <g key={`b${r}`}>
          <rect x="60" y={56 + r * 18} width="8" height="8" fill={GOLD} opacity="0.6" />
          <rect x="74" y={56 + r * 18} width="8" height="8" fill={GOLD} opacity="0.6" />
        </g>
      ))}
      {[0, 1, 2].map(r => (
        <g key={`c${r}`}>
          <rect x="100" y={68 + r * 18} width="8" height="8" fill={GOLD} opacity="0.5" />
          <rect x="112" y={68 + r * 18} width="8" height="8" fill={GOLD} opacity="0.5" />
        </g>
      ))}
      <line x1="12" y1="138" x2="140" y2="138" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </Base>
  );
}

// e) 건물·주거 특징 — 투룸 평면을 단순화한 방/가구 장면
export function BuildingIllustration() {
  return (
    <Base viewBox="0 0 160 160">
      <rect x="18" y="18" width="124" height="124" fill={PAPER} stroke={INK} strokeWidth="3" rx="4" />
      <line x1="90" y1="18" x2="90" y2="142" stroke={INK} strokeWidth="2.5" />
      <rect x="30" y="34" width="46" height="30" rx="4" fill={CREAM} stroke={GOLD} strokeWidth="2" />
      <rect x="30" y="34" width="46" height="10" rx="4" fill={GOLD} opacity="0.4" />
      <rect x="102" y="96" width="42" height="24" rx="6" fill={CREAM} stroke={GOLD} strokeWidth="2" />
      <rect x="100" y="90" width="10" height="30" rx="4" fill={CREAM} stroke={GOLD} strokeWidth="2" />
      <rect x="136" y="90" width="10" height="30" rx="4" fill={CREAM} stroke={GOLD} strokeWidth="2" />
      <path d="M90 60 A24 24 0 0 1 112 82" fill="none" stroke={GOLD} strokeWidth="1.5" strokeDasharray="3 3" />
    </Base>
  );
}

// f) 이런 분께 추천 — 사람(단순 도형)과 집
export function TargetIllustration() {
  return (
    <Base viewBox="0 0 160 160">
      <rect x="86" y="84" width="48" height="52" fill={CREAM} stroke={INK} strokeWidth="2.5" />
      <path d="M80 84 L110 56 L140 84 Z" fill={PAPER} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="102" y="104" width="16" height="32" rx="2" fill={GOLD} />
      <circle cx="38" cy="58" r="14" fill={PAPER} stroke={INK} strokeWidth="3" />
      <path d="M18 138c0-28 40-28 40 0" fill={CREAM} stroke={INK} strokeWidth="3" />
    </Base>
  );
}

// g) FAQ 제목 옆 — 말풍선 + 물음표(모양만, <text> 아님)
export function FaqIllustration() {
  return (
    <Base viewBox="0 0 48 48">
      <path
        d="M8 10h32a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H20l-8 8v-8h-4a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z"
        fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round"
      />
      <path d="M19 20a5 5 0 1 1 7.8 4.1c-1.6 1.1-2.3 1.9-2.3 3.4" fill="none" stroke={GOLD} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24.2" cy="32.4" r="1.6" fill={GOLD} />
    </Base>
  );
}

/* ── 기본 제공 품목 아이콘 세트 ── */

function IconAircon() {
  return (
    <Base viewBox="0 0 48 48">
      <rect x="6" y="14" width="36" height="12" rx="4" fill={CREAM} stroke={INK} strokeWidth="2.2" />
      <line x1="12" y1="20" x2="36" y2="20" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
      <path d="M10 26c2 6 6 8 6 8M38 26c-2 6-6 8-6 8M24 26v10" stroke={GOLD} strokeWidth="2" fill="none" strokeLinecap="round" />
    </Base>
  );
}
function IconFridge() {
  return (
    <Base viewBox="0 0 48 48">
      <rect x="12" y="6" width="24" height="36" rx="3" fill={CREAM} stroke={INK} strokeWidth="2.2" />
      <line x1="12" y1="20" x2="36" y2="20" stroke={INK} strokeWidth="2.2" />
      <line x1="30" y1="10" x2="30" y2="16" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="30" y1="24" x2="30" y2="32" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" />
    </Base>
  );
}
function IconWasher() {
  return (
    <Base viewBox="0 0 48 48">
      <rect x="8" y="8" width="32" height="32" rx="4" fill={CREAM} stroke={INK} strokeWidth="2.2" />
      <circle cx="18" cy="14" r="1.6" fill={GOLD} />
      <circle cx="24" cy="14" r="1.6" fill={GOLD} />
      <circle cx="24" cy="27" r="9" fill="none" stroke={GOLD} strokeWidth="2.4" />
      <path d="M19 27a5 5 0 0 0 10 0" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
    </Base>
  );
}
function IconFloor() {
  return (
    <Base viewBox="0 0 48 48">
      <rect x="6" y="14" width="36" height="22" rx="2" fill={CREAM} stroke={INK} strokeWidth="2.2" />
      <line x1="6" y1="22" x2="42" y2="22" stroke={GOLD} strokeWidth="1.6" />
      <line x1="6" y1="29" x2="42" y2="29" stroke={GOLD} strokeWidth="1.6" />
      <line x1="16" y1="14" x2="16" y2="22" stroke={GOLD} strokeWidth="1.6" />
      <line x1="30" y1="22" x2="30" y2="29" stroke={GOLD} strokeWidth="1.6" />
      <line x1="22" y1="29" x2="22" y2="36" stroke={GOLD} strokeWidth="1.6" />
    </Base>
  );
}
function IconKitchen() {
  return (
    <Base viewBox="0 0 48 48">
      <path d="M14 10h20l-4 10H18Z" fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <line x1="24" y1="20" x2="24" y2="28" stroke={INK} strokeWidth="2.2" />
      <rect x="8" y="28" width="32" height="10" rx="2" fill={PAPER} stroke={INK} strokeWidth="2.2" />
      <circle cx="16" cy="33" r="2.4" fill={GOLD} />
      <circle cx="24" cy="33" r="2.4" fill={GOLD} />
      <circle cx="32" cy="33" r="2.4" fill={GOLD} />
    </Base>
  );
}
function IconWallpad() {
  return (
    <Base viewBox="0 0 48 48">
      <rect x="13" y="6" width="22" height="36" rx="4" fill={CREAM} stroke={INK} strokeWidth="2.2" />
      <rect x="17" y="11" width="14" height="20" rx="2" fill={PAPER} stroke={GOLD} strokeWidth="1.8" />
      <circle cx="24" cy="36" r="1.8" fill={GOLD} />
    </Base>
  );
}
function IconSwitch() {
  return (
    <Base viewBox="0 0 48 48">
      <rect x="10" y="18" width="28" height="16" rx="8" fill={CREAM} stroke={INK} strokeWidth="2.2" />
      <circle cx="30" cy="26" r="6" fill={GOLD} />
      <path d="M24 10a6 6 0 0 1 6 0M20 8l2 3M34 8l-2 3" stroke={GOLD} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </Base>
  );
}
function IconVent() {
  return (
    <Base viewBox="0 0 48 48">
      <rect x="6" y="6" width="36" height="36" rx="5" fill={CREAM} stroke={INK} strokeWidth="2.2" />
      <circle cx="24" cy="24" r="3" fill={GOLD} />
      <path
        d="M24 24c0-6 5-9 9-7M24 24c6 0 9 5 7 9M24 24c0 6-5 9-9 7M24 24c-6 0-9-5-7-9"
        stroke={GOLD} strokeWidth="2.2" fill="none" strokeLinecap="round"
      />
    </Base>
  );
}
function IconExpand() {
  return (
    <Base viewBox="0 0 48 48">
      <rect x="14" y="14" width="20" height="20" rx="3" fill="none" stroke={INK} strokeWidth="2.2" />
      <path d="M14 14L6 6M34 14l8-8M14 34l-8 8M34 34l8 8" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" />
    </Base>
  );
}
function IconCheckDefault() {
  return (
    <Base viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="18" fill={CREAM} stroke={INK} strokeWidth="2.2" />
      <path d="M16 25l6 6 12-14" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

export type ItemIconKey = 'aircon' | 'fridge' | 'washer' | 'floor' | 'kitchen' | 'wallpad' | 'switch' | 'vent' | 'expand' | 'default';

export const ITEM_ICON_MAP: Record<ItemIconKey, () => JSX.Element> = {
  aircon: IconAircon,
  fridge: IconFridge,
  washer: IconWasher,
  floor: IconFloor,
  kitchen: IconKitchen,
  wallpad: IconWallpad,
  switch: IconSwitch,
  vent: IconVent,
  expand: IconExpand,
  default: IconCheckDefault,
};

const ITEM_RULES: { keys: string[]; icon: ItemIconKey }[] = [
  { keys: ['에어컨'], icon: 'aircon' },
  { keys: ['냉장고'], icon: 'fridge' },
  { keys: ['세탁'], icon: 'washer' },
  { keys: ['마루'], icon: 'floor' },
  { keys: ['후드', '주방', '엔지니어스톤'], icon: 'kitchen' },
  { keys: ['월패드'], icon: 'wallpad' },
  { keys: ['소등', '스위치', '조명'], icon: 'switch' },
  { keys: ['환기'], icon: 'vent' },
  { keys: ['확장'], icon: 'expand' },
];

export function matchItemIcon(line: string): ItemIconKey {
  for (const rule of ITEM_RULES) {
    if (rule.keys.some(k => line.includes(k))) return rule.icon;
  }
  return 'default';
}

/* ── 입지 아이콘 세트 ── */

function IconSubway() {
  return (
    <Base viewBox="0 0 48 48">
      <rect x="8" y="10" width="32" height="22" rx="6" fill={CREAM} stroke={INK} strokeWidth="2.2" />
      <circle cx="17" cy="20" r="3" fill={PAPER} stroke={GOLD} strokeWidth="1.8" />
      <circle cx="31" cy="20" r="3" fill={PAPER} stroke={GOLD} strokeWidth="1.8" />
      <line x1="8" y1="32" x2="40" y2="32" stroke={INK} strokeWidth="2.2" />
      <circle cx="14" cy="37" r="2.6" fill={INK} />
      <circle cx="34" cy="37" r="2.6" fill={INK} />
    </Base>
  );
}
function IconBus() {
  return (
    <Base viewBox="0 0 48 48">
      <rect x="6" y="12" width="36" height="20" rx="4" fill={CREAM} stroke={INK} strokeWidth="2.2" />
      <rect x="10" y="16" width="7" height="6" fill={PAPER} stroke={GOLD} strokeWidth="1.5" />
      <rect x="20.5" y="16" width="7" height="6" fill={PAPER} stroke={GOLD} strokeWidth="1.5" />
      <rect x="31" y="16" width="7" height="6" fill={PAPER} stroke={GOLD} strokeWidth="1.5" />
      <circle cx="14" cy="36" r="2.6" fill={INK} />
      <circle cx="34" cy="36" r="2.6" fill={INK} />
    </Base>
  );
}
function IconShopping() {
  return (
    <Base viewBox="0 0 48 48">
      <path d="M14 18h20l-2 20H16Z" fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M18 18v-4a6 6 0 0 1 12 0v4" fill="none" stroke={GOLD} strokeWidth="2.2" />
    </Base>
  );
}
function IconPark() {
  return (
    <Base viewBox="0 0 48 48">
      <circle cx="24" cy="18" r="13" fill={CREAM} stroke={INK} strokeWidth="2.2" />
      <rect x="21" y="28" width="6" height="12" fill={GOLD} />
    </Base>
  );
}
function IconSchool() {
  return (
    <Base viewBox="0 0 48 48">
      <path d="M24 10 44 18 24 26 4 18Z" fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <line x1="38" y1="20" x2="38" y2="32" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
      <circle cx="38" cy="34" r="2" fill={GOLD} />
    </Base>
  );
}
function IconPin() {
  return (
    <Base viewBox="0 0 48 48">
      <path
        d="M24 6c8 0 14 6 14 14 0 10-14 22-14 22S10 30 10 20C10 12 16 6 24 6Z"
        fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round"
      />
      <circle cx="24" cy="20" r="5" fill={GOLD} />
    </Base>
  );
}

export type LocationIconKey = 'subway' | 'bus' | 'shopping' | 'park' | 'school' | 'pin';

export const LOCATION_ICON_MAP: Record<LocationIconKey, () => JSX.Element> = {
  subway: IconSubway,
  bus: IconBus,
  shopping: IconShopping,
  park: IconPark,
  school: IconSchool,
  pin: IconPin,
};

const LOCATION_RULES: { keys: string[]; icon: LocationIconKey }[] = [
  { keys: ['지하철', '역', '호선'], icon: 'subway' },
  { keys: ['버스', '환승'], icon: 'bus' },
  { keys: ['백화점', '다이소', '상가', '마트'], icon: 'shopping' },
  { keys: ['공원'], icon: 'park' },
  { keys: ['학교', '학군', '초', '중', '고'], icon: 'school' },
];

export function matchLocationIcon(line: string): LocationIconKey {
  for (const rule of LOCATION_RULES) {
    if (rule.keys.some(k => line.includes(k))) return rule.icon;
  }
  return 'pin';
}
