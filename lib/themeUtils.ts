// 모든 테마 ID — 매물 등록/손님 조건 폼에서 체크박스로 표시할 순서
// (매물 등록 페이지의 THEME_TYPES와 동일 순서로 일관성 유지)
export const ALL_THEMES: string[] = [
  '추천매물', '사옥형및통임대', '대형상가', '대형사무실', '무권리상가', '프랜차이즈양도양수', '1층상가', '2층이상상가',
  '역세권매물', '신축매물', '저렴한매물', '코너매물', '메인상권', '즉시입주', '대로변매물', '노출좋음', '인기매물',
  '카페', '사무실', '음식점', '병원', '학원', '뷰티', '편의점', '헬스장',
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
