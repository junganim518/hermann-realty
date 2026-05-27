/** 숫자 범위 필터 — min/max 빈 문자열이면 무제한 */
export function matchRange(value: any, min: string, max: string): boolean {
  if (!min && !max) return true;
  const v = Number(value);
  if (isNaN(v)) return false;
  if (min && v < Number(min)) return false;
  if (max && v > Number(max)) return false;
  return true;
}

/** 면적 범위 필터 — DB는 ㎡ 저장, min/max는 평 단위 입력 */
export function matchAreaRange(exclusiveArea: any, supplyArea: any, min: string, max: string): boolean {
  if (!min && !max) return true;
  const sqm = parseFloat(exclusiveArea) || parseFloat(supplyArea);
  if (isNaN(sqm) || !sqm) return false;
  const pyeong = sqm / 3.3058;
  if (min && pyeong < Number(min)) return false;
  if (max && pyeong > Number(max)) return false;
  return true;
}

/** 층수 단일 선택 필터 */
export function matchFloor(floor: any, range: string): boolean {
  if (range === '전체') return true;
  const s = String(floor ?? '').trim();
  if (!s) return false;
  if (range === '지하') return s.includes('지하') || s.startsWith('-') || s.startsWith('B');
  if (range === '1층') { const n = parseInt(s); return !isNaN(n) && n === 1; }
  if (range === '2층 이상') { const n = parseInt(s); return !isNaN(n) && n >= 2; }
  return true;
}
