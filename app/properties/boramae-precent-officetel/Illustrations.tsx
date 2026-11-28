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
const LIGHT_GOLD = '#E8C27A'; // 장면 속 창문/간판 점등 전용 — 눈에 확실히 들어오는 밝은 골드

function Base({ viewBox, children, slice }: { viewBox: string; children: ReactNode; slice?: boolean }) {
  return (
    <svg
      viewBox={viewBox}
      // xMidYMin: 카드가 글 길이에 따라 세로로 길어져도(slice로 꽉 채우면서) 항상 장면의 "위쪽"이
      // 기준으로 보이게 한다 — xMidYMid(가운데 기준)였을 때 카드가 세로로 길어지면 장면 중간부가
      // 과도하게 확대되어 보이면서 주요 사물이 글자 영역까지 내려와 겹치는 문제가 있었다.
      preserveAspectRatio={slice ? 'xMidYMin slice' : undefined}
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

// a) 교통 — 고가 승강장 위 전동차와 버스. 카드가 글 길이에 따라 세로로 길어질 때도(slice가 카드
// 비율에 따라 위아래를 자르지 않고 좌우만 자르는 경우가 있어) 아래 글자 영역과 겹치지 않도록
// 주요 사물을 전체 높이(800) 중 위쪽 절반(약 0~380)에만 모아 그린다.
export function TransportScene() {
  return (
    <Base viewBox="0 0 1200 800" slice>
      <defs>
        <linearGradient id="scTransportSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B2A4A" />
          <stop offset="0.6" stopColor="#3B3A5A" />
          <stop offset="1" stopColor="#C98B4A" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#scTransportSky)" />
      <circle cx="1040" cy="80" r="36" fill={PAPER} opacity="0.9" />
      {/* 전동차 — 밝은 베이지 몸체, 창문은 확실히 점등 */}
      <rect x="140" y="50" width="680" height="150" rx="16" fill={INK} />
      <rect x="140" y="50" width="680" height="28" rx="16" fill={OUTLINE} />
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <rect key={i} x={172 + i * 94} y="90" width="58" height="42" rx="6" fill={LIGHT_GOLD} />
      ))}
      <rect x="140" y="200" width="680" height="16" fill={OUTLINE} />
      {/* 승강장 지붕/기둥 */}
      <rect x="40" y="226" width="840" height="18" fill={CREAM} />
      {[0, 1, 2, 3, 4, 5].map(i => (
        <rect key={i} x={70 + i * 150} y="244" width="16" height="80" fill={CREAM} />
      ))}
      {/* 버스 */}
      <rect x="900" y="80" width="250" height="130" rx="16" fill={INK} />
      <rect x="928" y="112" width="54" height="40" rx="5" fill={LIGHT_GOLD} />
      <rect x="996" y="112" width="54" height="40" rx="5" fill={LIGHT_GOLD} />
      <rect x="1064" y="112" width="54" height="40" rx="5" fill={LIGHT_GOLD} />
      <circle cx="944" cy="222" r="20" fill={OUTLINE} />
      <circle cx="1106" cy="222" r="20" fill={OUTLINE} />
      {/* 가로등 */}
      <rect x="50" y="110" width="8" height="150" fill={OUTLINE} />
      <circle cx="54" cy="102" r="12" fill={LIGHT_GOLD} />
    </Base>
  );
}

// b) 생활 인프라 — 상업 건물과 점등된 상점창(글자 없음), 공원 산책로·나무·벤치, 쇼핑백.
// 주요 사물을 위쪽 약 0~380 영역에 모아 카드가 세로로 길어져도 아래 글자와 겹치지 않게 한다.
export function InfraScene() {
  return (
    <Base viewBox="0 0 1200 800" slice>
      <defs>
        <linearGradient id="scInfraSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B2A4A" />
          <stop offset="0.6" stopColor="#3B3A5A" />
          <stop offset="1" stopColor="#C98B4A" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#scInfraSky)" />
      {/* 상업 건물 — 밝은 베이지 몸체, 점등된 상점창(글자 없음) */}
      <rect x="90" y="40" width="420" height="280" fill={INK} />
      {[0, 1].map(r => (
        <g key={r}>
          <rect x="120" y={70 + r * 90} width="100" height="62" fill={LIGHT_GOLD} />
          <rect x="250" y={70 + r * 90} width="100" height="62" fill={LIGHT_GOLD} />
          <rect x="380" y={70 + r * 90} width="100" height="62" fill={LIGHT_GOLD} />
        </g>
      ))}
      <rect x="90" y="320" width="420" height="26" fill={OUTLINE} />
      {/* 쇼핑백 — 밝은 포인트 */}
      <path d="M580 120h90l-9 90h-72Z" fill={LIGHT_GOLD} />
      <path d="M596 120v-20a14 14 0 0 1 28 0v20" fill="none" stroke={LIGHT_GOLD} strokeWidth="6" />
      {/* 공원 나무·벤치(보조 요소) */}
      <circle cx="790" cy="230" r="54" fill="#333A4C" />
      <rect x="778" y="282" width="24" height="60" fill="#333A4C" />
      <circle cx="1000" cy="180" r="60" fill="#2B3142" />
      <rect x="986" y="236" width="28" height="70" fill="#2B3142" />
      <rect x="1080" y="300" width="130" height="12" fill={OUTLINE} />
      <rect x="1092" y="312" width="12" height="34" fill={OUTLINE} />
      <rect x="1186" y="312" width="12" height="34" fill={OUTLINE} />
    </Base>
  );
}

// c) 교육 — 학교 건물(점등된 창문), 책과 졸업모 모티프, 나무. 주요 사물을 위쪽 약 0~380 영역에
// 모아 카드가 세로로 길어져도 아래 글자와 겹치지 않게 한다.
export function EducationScene() {
  return (
    <Base viewBox="0 0 1200 800" slice>
      <defs>
        <linearGradient id="scEduSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B2A4A" />
          <stop offset="0.6" stopColor="#3B3A5A" />
          <stop offset="1" stopColor="#C98B4A" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#scEduSky)" />
      {/* 학교 건물 — 밝은 베이지 몸체, 점등된 창문 2열 */}
      <rect x="280" y="40" width="560" height="260" fill={INK} />
      {[0, 1, 2, 3, 4].map(i => (
        <rect key={i} x={312 + i * 102} y="68" width="64" height="48" fill={LIGHT_GOLD} />
      ))}
      {[0, 1, 2, 3, 4].map(i => (
        <rect key={i} x={312 + i * 102} y="136" width="64" height="48" fill={LIGHT_GOLD} />
      ))}
      <rect x="500" y="212" width="120" height="88" fill={OUTLINE} />
      <rect x="280" y="300" width="560" height="22" fill={OUTLINE} />
      {/* 나무(보조 요소) */}
      <circle cx="170" cy="250" r="54" fill="#333A4C" />
      <rect x="156" y="300" width="28" height="60" fill="#333A4C" />
      {/* 책 + 졸업모 모티프 — 밝은 포인트 */}
      <rect x="930" y="250" width="200" height="22" fill={LIGHT_GOLD} />
      <rect x="930" y="272" width="200" height="60" fill={INK} />
      <path d="M880 210 1030 160 1180 210 1030 260Z" fill={LIGHT_GOLD} />
      <line x1="1180" y1="210" x2="1180" y2="258" stroke={LIGHT_GOLD} strokeWidth="5" />
      <circle cx="1180" cy="266" r="7" fill={LIGHT_GOLD} />
    </Base>
  );
}

// d) 건물·주거 특징 — 벽으로 나뉜 투룸 실내 단면(왼쪽 침실: 침대·베개·창문·펜던트 조명,
// 오른쪽 거실: 소파·협탁·큰 창문·식물), 바닥선과 따뜻한 조명 빛 번짐. 베이지 상자 두 개만
// 보이지 않도록 가구/조명을 또렷하게 그린다. 다른 장면과 마찬가지로 주요 사물을 위쪽 약 0~380
// 영역에 모아, 카드가 세로로 길어져도(slice가 좌우만 잘라 전체 높이가 그대로 보이는 경우가 있어)
// 아래 글자 영역과 겹치지 않게 한다.
export function LivingScene() {
  return (
    <Base viewBox="0 0 1200 800" slice>
      <defs>
        <linearGradient id="scLivingSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B2A4A" />
          <stop offset="0.6" stopColor="#3B3A5A" />
          <stop offset="1" stopColor="#5A4438" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#scLivingSky)" />
      {/* 방 벽/바닥 */}
      <rect x="80" y="20" width="1040" height="300" fill={CREAM} />
      <rect x="80" y="320" width="1040" height="18" fill={OUTLINE} />
      <line x1="600" y1="20" x2="600" y2="320" stroke={INK} strokeWidth="10" />

      {/* 왼쪽: 침실 — 창문 빛 번짐 + 펜던트 조명 + 침대/베개 */}
      <circle cx="260" cy="110" r="92" fill={LIGHT_GOLD} opacity="0.18" />
      <rect x="150" y="50" width="220" height="120" rx="6" fill={LIGHT_GOLD} opacity="0.4" />
      <rect x="150" y="50" width="220" height="120" rx="6" fill="none" stroke={INK} strokeWidth="4" />
      <line x1="500" y1="20" x2="500" y2="90" stroke={INK} strokeWidth="4" />
      <circle cx="500" cy="100" r="18" fill={LIGHT_GOLD} />
      <rect x="140" y="236" width="380" height="68" rx="12" fill={PAPER} />
      <rect x="140" y="210" width="380" height="34" rx="10" fill={PAPER} opacity="0.9" />
      <rect x="160" y="186" width="90" height="40" rx="16" fill={PAPER} />
      <rect x="260" y="186" width="90" height="40" rx="16" fill={PAPER} />

      {/* 오른쪽: 거실 — 큰 창문, 소파, 협탁, 식물 */}
      <circle cx="930" cy="120" r="108" fill={LIGHT_GOLD} opacity="0.16" />
      <rect x="820" y="50" width="260" height="150" rx="6" fill={LIGHT_GOLD} opacity="0.38" />
      <rect x="820" y="50" width="260" height="150" rx="6" fill="none" stroke={INK} strokeWidth="4" />
      <rect x="700" y="236" width="300" height="76" rx="18" fill={PAPER} />
      <rect x="690" y="210" width="320" height="42" rx="14" fill={PAPER} opacity="0.92" />
      <rect x="1030" y="248" width="66" height="54" rx="6" fill={OUTLINE} />
      <circle cx="1048" cy="228" r="22" fill={OUTLINE} />
      <circle cx="1068" cy="236" r="16" fill={OUTLINE} />
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
