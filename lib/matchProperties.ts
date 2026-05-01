// 손님 조건 ↔ 매물 매칭 로직

export type DesiredConditions = {
  property_types?: string[];
  transaction_types?: string[];
  deposit_min?: number | null;
  deposit_max?: number | null;
  monthly_rent_min?: number | null;
  monthly_rent_max?: number | null;
  sale_price_min?: number | null;
  sale_price_max?: number | null;
  area_min?: number | null;       // 평 단위
  area_max?: number | null;
  floor_min?: number | null;
  floor_max?: number | null;
  region?: string;
  /** @deprecated "무권리상가" 테마로 통합됨 — 기존 데이터 호환용으로만 유지 */
  no_premium?: boolean;
  desired_themes?: string[];      // 원하는 테마 (1개라도 일치하면 점수 가산)
  additional_memo?: string;
};

export type MatchedProperty = {
  property: any;
  score: number; // 0~100
};

const PYEONG_PER_SQM = 1 / 3.3058;
const TOLERANCE = 0.1; // ±10% 부분 점수 허용

// 범위 내 여부 — 1점(완전일치) / 0.5점(±10%) / 0점(벗어남)
function rangeScore(val: number, min?: number | null, max?: number | null): number {
  if (val == null || isNaN(val)) return 0;
  const hasMin = min != null;
  const hasMax = max != null;
  if (!hasMin && !hasMax) return 1;

  if (hasMin && hasMax) {
    if (val >= (min as number) && val <= (max as number)) return 1;
    const lo = (min as number) * (1 - TOLERANCE);
    const hi = (max as number) * (1 + TOLERANCE);
    if (val >= lo && val <= hi) return 0.5;
    return 0;
  }
  if (hasMin) {
    if (val >= (min as number)) return 1;
    if (val >= (min as number) * (1 - TOLERANCE)) return 0.5;
    return 0;
  }
  // hasMax only
  if (val <= (max as number)) return 1;
  if (val <= (max as number) * (1 + TOLERANCE)) return 0.5;
  return 0;
}

// 매물 1건 매칭률 계산 (0~100)
export function matchProperty(p: any, c: DesiredConditions): number {
  let total = 0;
  let scored = 0;

  if (c.property_types && c.property_types.length > 0) {
    total++;
    if (c.property_types.includes(p.property_type)) scored += 1;
  }
  if (c.transaction_types && c.transaction_types.length > 0) {
    total++;
    if (c.transaction_types.includes(p.transaction_type)) scored += 1;
  }
  // 보증금 (월세/전세 거래에 의미)
  if ((c.deposit_min != null || c.deposit_max != null) && p.transaction_type !== '매매') {
    total++;
    scored += rangeScore(Number(p.deposit) || 0, c.deposit_min, c.deposit_max);
  }
  // 월세 (월세 거래에만)
  if ((c.monthly_rent_min != null || c.monthly_rent_max != null) && p.transaction_type === '월세') {
    total++;
    scored += rangeScore(Number(p.monthly_rent) || 0, c.monthly_rent_min, c.monthly_rent_max);
  }
  // 매매가 (매매 거래에만)
  if ((c.sale_price_min != null || c.sale_price_max != null) && p.transaction_type === '매매') {
    total++;
    scored += rangeScore(Number(p.sale_price) || 0, c.sale_price_min, c.sale_price_max);
  }
  // 면적 (평 단위)
  if (c.area_min != null || c.area_max != null) {
    total++;
    const sqm = Number(p.exclusive_area) || 0;
    const pyeong = sqm * PYEONG_PER_SQM;
    scored += rangeScore(pyeong, c.area_min, c.area_max);
  }
  // 층수
  if (c.floor_min != null || c.floor_max != null) {
    total++;
    const floor = parseInt(String(p.current_floor ?? ''), 10);
    if (!isNaN(floor)) scored += rangeScore(floor, c.floor_min, c.floor_max);
  }
  // 지역
  if (c.region && c.region.trim()) {
    total++;
    if (typeof p.address === 'string' && p.address.includes(c.region.trim())) scored += 1;
  }
  // 원하는 테마 (1개라도 일치하면 1점, 부분 일치는 0.5점) — 손님이 1개 이상 선택한 경우만 평가
  // 참고: 과거 별도 항목이던 no_premium 은 이제 desired_themes 의 "무권리상가" 테마로 통합됨
  if (c.desired_themes && c.desired_themes.length > 0) {
    total++;
    const propThemes = String(p.theme_type ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (propThemes.length > 0) {
      const matchCount = c.desired_themes.filter(t => propThemes.includes(t)).length;
      if (matchCount === c.desired_themes.length) scored += 1;          // 모두 일치
      else if (matchCount > 0) scored += 0.5;                            // 일부 일치
    }
  }

  if (total === 0) return 0;
  return Math.round((scored / total) * 100);
}

// 전체 매물 목록에서 매칭 후 정렬된 결과 반환 (거래완료 제외, minScore 미만 제외)
export function findMatches(
  properties: any[],
  conditions: DesiredConditions,
  opts?: { minScore?: number }
): MatchedProperty[] {
  const minScore = opts?.minScore ?? 50;
  return properties
    .filter(p => !p.is_sold)
    .map(p => ({ property: p, score: matchProperty(p, conditions) }))
    .filter(m => m.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

// 조건이 비어있는지 (사용자가 어떤 조건도 입력하지 않음)
export function hasConditions(c: DesiredConditions | null | undefined): boolean {
  if (!c) return false;
  return Boolean(
    (c.property_types?.length ?? 0) > 0 ||
    (c.transaction_types?.length ?? 0) > 0 ||
    c.deposit_min != null || c.deposit_max != null ||
    c.monthly_rent_min != null || c.monthly_rent_max != null ||
    c.sale_price_min != null || c.sale_price_max != null ||
    c.area_min != null || c.area_max != null ||
    c.floor_min != null || c.floor_max != null ||
    (c.region && c.region.trim()) ||
    (c.desired_themes?.length ?? 0) > 0 ||
    (c.additional_memo && c.additional_memo.trim())
  );
}
