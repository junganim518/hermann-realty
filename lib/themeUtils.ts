// 검색/필터 페이지 공용 테마 목록 (properties/map 페이지 import해서 사용)
export const FILTER_THEMES: { id: string; name: string }[] = [
  { id: '추천매물', name: '추천매물' },
  { id: '사옥형및통임대', name: '사옥형 및 통임대' },
  { id: '대형상가', name: '대형 상가' },
  { id: '대형사무실', name: '대형사무실' },
  { id: '무권리상가', name: '무권리 상가' },
  { id: '프랜차이즈양도양수', name: '프랜차이즈 양도양수' },
  { id: '1층상가', name: '1층 상가' },
  { id: '2층이상상가', name: '2층 이상 상가' },
  { id: '카페', name: '카페' },
  { id: '사무실', name: '사무실' },
  { id: '음식점', name: '음식점' },
  { id: '병원', name: '병원' },
  { id: '학원', name: '학원' },
  { id: '뷰티', name: '뷰티' },
  { id: '편의점', name: '편의점' },
  { id: '헬스장', name: '헬스장' },
  { id: '유흥/주류', name: '유흥/주류' },
];

// 모든 테마 ID — 매물 등록/손님 조건 폼에서 체크박스로 표시할 순서
// (매물 등록 페이지의 THEME_TYPES와 동일 순서로 일관성 유지)
export const ALL_THEMES: string[] = [
  '추천매물', '사옥형및통임대', '대형상가', '대형사무실', '무권리상가', '프랜차이즈양도양수', '1층상가', '2층이상상가',
  '역세권매물', '신축매물', '저렴한매물', '코너매물', '메인상권', '즉시입주', '대로변매물', '노출좋음', '인기매물',
  '카페', '사무실', '음식점', '병원', '학원', '뷰티', '편의점', '헬스장', '유흥/주류',
];

// 테마 표시 우선순위 (위에서부터 우선 표시)
const THEME_PRIORITY: string[] = [
  '추천매물',
  '신축매물',
  '즉시입주',
  '역세권매물',
  '메인상권',
  '인기매물',
  '코너매물',
  '대로변매물',
  '노출좋음',
  '무권리상가',
  '1층상가',
  '2층이상상가',
  '저렴한매물',
  '대형상가',
  '대형사무실',
  '사옥형및통임대',
  '프랜차이즈양도양수',
  '카페',
  '사무실',
  '음식점',
  '병원',
  '학원',
  '뷰티',
  '편의점',
  '헬스장',
  '유흥/주류',
];

const THEME_ICONS: Record<string, string> = {
  '추천매물': '⭐',
  '사옥형및통임대': '🏢',
  '대형상가': '🏬',
  '대형사무실': '🏢',
  '무권리상가': '💰',
  '프랜차이즈양도양수': '🤝',
  '1층상가': '1️⃣',
  '2층이상상가': '2️⃣',
  '역세권매물': '🚇',
  '신축매물': '🌟',
  '저렴한매물': '💸',
  '코너매물': '📐',
  '메인상권': '🎯',
  '즉시입주': '🔑',
  '대로변매물': '🛣️',
  '노출좋음': '👀',
  '인기매물': '🔥',
  '카페': '☕',
  '사무실': '💼',
  '음식점': '🍴',
  '병원': '🏥',
  '학원': '📚',
  '뷰티': '💇',
  '편의점': '🏪',
  '헬스장': '🏋️',
  '유흥/주류': '🍺',
};

export function getThemeIcon(theme: string): string {
  return THEME_ICONS[theme] ?? '';
}

// theme_type 컬럼을 배열로 파싱 (콤마 구분 문자열 또는 배열 모두 지원)
export function splitThemes(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(s => String(s).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// 우선순위에 따라 정렬 후 max개로 제한, 초과분 카운트 반환
export function sortAndLimitThemes(themes: string[], max: number): { primary: string[]; overflow: number } {
  const seen = new Set<string>();
  const unique = themes.filter(t => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
  const sorted = [...unique].sort((a, b) => {
    const ai = THEME_PRIORITY.indexOf(a);
    const bi = THEME_PRIORITY.indexOf(b);
    const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    return aRank - bRank;
  });
  if (max >= sorted.length) return { primary: sorted, overflow: 0 };
  return { primary: sorted.slice(0, max), overflow: sorted.length - max };
}
