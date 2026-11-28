// 프리센트 오피스텔 페이지 전용 — 직접 그린 라인+플랫 일러스트(순수 SVG, 서버에서도 렌더됨).
// 실존 브랜드/로고/캐릭터/실제 건물 특징을 모방하지 않은 단순 도형이며, 글자(<text>)는 전혀 쓰지 않는다.
// 다크 톤 전용 — 면은 어두운 남색/회색(CREAM), 보조 밝은 하이라이트(PAPER), 선/포인트는 골드(GOLD)와
// 밝은 베이지 선(INK)으로 재채색했다(기존 "밝은 면 + 어두운 선" 조합을 다크 배경에 맞게 뒤집은 것).
// 크기는 각 사용처의 CSS(officetel.module.css)가 descendant `svg` 선택자로 지정한다
// (여기서는 크기 속성을 주지 않음 — 장식용이라 aria-hidden="true").
import type { ReactNode } from 'react';

const INK = '#D9D4C8';     // 구조선(밝은 베이지) — 어두운 배경에서도 또렷하게 보임
const GOLD = '#C9A15B';    // 포인트 골드
const CREAM = '#262A36';   // 주요 면(어두운 남색/회색)
const PAPER = '#F2EEE6';   // 보조 하이라이트(밝은 베이지) — 불빛/창문 등
const OUTLINE = '#3A3E4A'; // 실루엣/덩어리

function Base({ viewBox, children, slice }: { viewBox: string; children: ReactNode; slice?: boolean }) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={slice ? 'xMidYMid slice' : undefined}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

/* ── 대형 일러스트 ── */

// 특별 혜택 — 건물 + 열쇠 + 동전 (방패 등 단정적 상징 없음)
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

// FAQ 제목 옆 — 말풍선 + 물음표(모양만, <text> 아님)
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

/* ── 카드 전체를 채우는 장면(photo-card 배경용, 1200x800, slice) ──
   깊은 남색~차콜 그라데이션 하늘 + 골드 포인트 + 은은한 창문/간판 불빛. 실제 노선 표기·로고·실제 건물
   특징은 쓰지 않는다. 카드 쪽 그라데이션 오버레이(officetel.module.css)가 글자 대비를 보장한다. */

// a) 교통 — 스카이라인 아래 고가 승강장과 전동차 실루엣, 버스, 가로등, 달
export function TransportScene() {
  return (
    <Base viewBox="0 0 1200 800" slice>
      <defs>
        <linearGradient id="scTransportSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A1E30" />
          <stop offset="1" stopColor="#0E0F17" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#scTransportSky)" />
      <circle cx="1040" cy="150" r="46" fill={PAPER} opacity="0.85" />
      <g opacity="0.5">
        <rect x="60" y="360" width="90" height="300" fill={OUTLINE} />
        <rect x="170" y="300" width="110" height="360" fill={OUTLINE} />
        <rect x="300" y="400" width="80" height="260" fill={OUTLINE} />
        <rect x="900" y="330" width="100" height="330" fill={OUTLINE} />
        <rect x="1020" y="380" width="90" height="280" fill={OUTLINE} />
      </g>
      <rect x="0" y="620" width="1200" height="30" fill={CREAM} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <rect key={i} x={30 + i * 130} y="650" width="14" height="90" fill={CREAM} />
      ))}
      <rect x="150" y="540" width="640" height="80" rx="14" fill={OUTLINE} />
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <rect key={i} x={180 + i * 86} y="562" width="46" height="34" rx="4" fill={GOLD} opacity="0.5" />
      ))}
      <rect x="880" y="560" width="200" height="90" rx="12" fill={OUTLINE} />
      <rect x="904" y="580" width="40" height="30" rx="3" fill={GOLD} opacity="0.45" />
      <rect x="956" y="580" width="40" height="30" rx="3" fill={GOLD} opacity="0.45" />
      <rect x="1008" y="580" width="40" height="30" rx="3" fill={GOLD} opacity="0.45" />
      <circle cx="920" cy="656" r="16" fill={CREAM} />
      <circle cx="1040" cy="656" r="16" fill={CREAM} />
      <rect x="60" y="500" width="6" height="150" fill={INK} opacity="0.6" />
      <circle cx="63" cy="494" r="10" fill={GOLD} />
    </Base>
  );
}

// b) 생활 인프라 — 상업 건물과 상점 간판 실루엣(글자 없음), 공원 산책로, 가로수와 벤치, 쇼핑백
export function InfraScene() {
  return (
    <Base viewBox="0 0 1200 800" slice>
      <defs>
        <linearGradient id="scInfraSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1C2230" />
          <stop offset="1" stopColor="#10121A" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#scInfraSky)" />
      <rect x="80" y="260" width="360" height="400" fill={OUTLINE} />
      {[0, 1].map(r => (
        <g key={r}>
          <rect x="110" y={300 + r * 100} width="80" height="60" fill={GOLD} opacity="0.4" />
          <rect x="210" y={300 + r * 100} width="80" height="60" fill={GOLD} opacity="0.4" />
          <rect x="310" y={300 + r * 100} width="80" height="60" fill={GOLD} opacity="0.4" />
        </g>
      ))}
      <rect x="80" y="560" width="360" height="24" fill={GOLD} opacity="0.65" />
      <path d="M520 800 C 650 650 850 650 1200 760" stroke={CREAM} strokeWidth="34" fill="none" opacity="0.5" />
      <circle cx="640" cy="560" r="42" fill={OUTLINE} />
      <rect x="632" y="602" width="16" height="50" fill={OUTLINE} />
      <circle cx="840" cy="510" r="48" fill={OUTLINE} />
      <rect x="830" y="558" width="18" height="60" fill={OUTLINE} />
      <rect x="980" y="620" width="120" height="10" fill={INK} opacity="0.6" />
      <rect x="990" y="630" width="10" height="30" fill={INK} opacity="0.6" />
      <rect x="1080" y="630" width="10" height="30" fill={INK} opacity="0.6" />
      <path d="M560 520h70l-7 70h-56Z" fill={GOLD} opacity="0.75" />
      <path d="M572 520v-16a11 11 0 0 1 22 0v16" fill="none" stroke={GOLD} strokeWidth="4" opacity="0.75" />
    </Base>
  );
}

// c) 교육 — 학교 건물(단순 형태)과 운동장, 책과 졸업모 모티프, 나무
export function EducationScene() {
  return (
    <Base viewBox="0 0 1200 800" slice>
      <defs>
        <linearGradient id="scEduSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A2026" />
          <stop offset="1" stopColor="#0E1013" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#scEduSky)" />
      <rect x="300" y="300" width="500" height="360" fill={OUTLINE} />
      {[0, 1, 2, 3, 4].map(i => (
        <rect key={i} x={340 + i * 90} y="340" width="60" height="60" fill={GOLD} opacity="0.4" />
      ))}
      <rect x="500" y="500" width="100" height="160" fill={CREAM} />
      <rect x="0" y="660" width="1200" height="140" fill={OUTLINE} opacity="0.3" />
      <circle cx="180" cy="560" r="50" fill={OUTLINE} />
      <rect x="170" y="610" width="20" height="60" fill={OUTLINE} />
      <rect x="900" y="560" width="160" height="20" fill={GOLD} opacity="0.85" />
      <rect x="900" y="580" width="160" height="60" fill={CREAM} />
      <path d="M860 540 980 500 1100 540 980 580Z" fill={GOLD} opacity="0.75" />
    </Base>
  );
}

// d) 건물·주거 특징 — 거실/침실이 분리된 투룸 실내 단면, 따뜻한 창문 조명
export function LivingScene() {
  return (
    <Base viewBox="0 0 1200 800" slice>
      <defs>
        <linearGradient id="scLivingSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1E2230" />
          <stop offset="1" stopColor="#10121A" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#scLivingSky)" />
      <rect x="100" y="150" width="1000" height="500" fill={CREAM} />
      <line x1="600" y1="150" x2="600" y2="650" stroke={INK} strokeWidth="8" opacity="0.5" />
      <circle cx="280" cy="290" r="90" fill={GOLD} opacity="0.1" />
      <circle cx="840" cy="290" r="90" fill={GOLD} opacity="0.1" />
      <rect x="150" y="400" width="300" height="140" rx="20" fill={OUTLINE} />
      <rect x="180" y="220" width="200" height="140" rx="6" fill={GOLD} opacity="0.3" />
      <rect x="700" y="420" width="260" height="160" rx="10" fill={OUTLINE} />
      <rect x="700" y="420" width="260" height="40" rx="10" fill={GOLD} opacity="0.25" />
      <rect x="760" y="220" width="160" height="140" rx="6" fill={GOLD} opacity="0.3" />
    </Base>
  );
}

/* ── 추천 대상 카드용 작은 아이콘 4종(골드, 64px 이상으로 사용) ── */

function TargetNewBuilding() {
  return (
    <Base viewBox="0 0 48 48">
      <rect x="10" y="12" width="22" height="32" rx="2" fill="none" stroke={GOLD} strokeWidth="2.4" />
      {[0, 1, 2].map(r => (
        <g key={r}>
          <rect x="14" y={18 + r * 7} width="5" height="5" fill={GOLD} />
          <rect x="23" y={18 + r * 7} width="5" height="5" fill={GOLD} />
        </g>
      ))}
      <path d="M38 8l2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" fill={GOLD} />
    </Base>
  );
}
function TargetTwoRoom() {
  return (
    <Base viewBox="0 0 48 48">
      <rect x="6" y="10" width="36" height="28" fill="none" stroke={GOLD} strokeWidth="2.4" />
      <line x1="24" y1="10" x2="24" y2="38" stroke={GOLD} strokeWidth="2.4" />
      <rect x="10" y="26" width="10" height="8" fill={GOLD} opacity="0.5" />
      <rect x="30" y="14" width="8" height="8" rx="4" fill={GOLD} opacity="0.5" />
    </Base>
  );
}
function TargetCommute() {
  return (
    <Base viewBox="0 0 48 48">
      <circle cx="14" cy="14" r="5" fill="none" stroke={GOLD} strokeWidth="2.4" />
      <path d="M8 34c0-10 12-10 12 0" fill="none" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M34 8c6 0 10 4 10 10 0 7-10 16-10 16s-10-9-10-16c0-6 4-10 10-10Z"
        fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinejoin="round"
      />
      <circle cx="34" cy="18" r="3.5" fill={GOLD} />
    </Base>
  );
}
function TargetHouseCoin() {
  return (
    <Base viewBox="0 0 48 48">
      <path d="M8 26 20 14 32 26" fill="none" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="12" y="26" width="16" height="14" fill="none" stroke={GOLD} strokeWidth="2.2" />
      <circle cx="36" cy="34" r="9" fill="none" stroke={GOLD} strokeWidth="2.2" />
      <line x1="36" y1="29" x2="36" y2="39" stroke={GOLD} strokeWidth="1.8" />
    </Base>
  );
}

export const TARGET_ICONS: Array<() => JSX.Element> = [TargetNewBuilding, TargetTwoRoom, TargetCommute, TargetHouseCoin];

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
      <rect x="8" y="28" width="32" height="10" rx="2" fill={CREAM} stroke={INK} strokeWidth="2.2" />
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
      <rect x="17" y="11" width="14" height="20" rx="2" fill={CREAM} stroke={GOLD} strokeWidth="1.8" />
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
      <circle cx="17" cy="20" r="3" fill={CREAM} stroke={GOLD} strokeWidth="1.8" />
      <circle cx="31" cy="20" r="3" fill={CREAM} stroke={GOLD} strokeWidth="1.8" />
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
      <rect x="10" y="16" width="7" height="6" fill={CREAM} stroke={GOLD} strokeWidth="1.5" />
      <rect x="20.5" y="16" width="7" height="6" fill={CREAM} stroke={GOLD} strokeWidth="1.5" />
      <rect x="31" y="16" width="7" height="6" fill={CREAM} stroke={GOLD} strokeWidth="1.5" />
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
