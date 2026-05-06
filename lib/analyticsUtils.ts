// page_views 데이터 분석용 그룹핑 헬퍼

export type PageView = {
  created_at: string;
  page?: string | null;
  device?: string | null;
  referrer?: string | null;
};

const pad = (n: number) => String(n).padStart(2, '0');

// "YYYY-MM-DD" 키로 변환
export function dateKey(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 날짜별 카운트 (최근 N일, 빈 날짜 0으로 채움)
export function groupByDate(views: PageView[], days: number): Array<{ date: string; count: number; label: string }> {
  const counts: Record<string, number> = {};
  for (const v of views) {
    const k = dateKey(v.created_at);
    if (k) counts[k] = (counts[k] ?? 0) + 1;
  }
  const out: Array<{ date: string; count: number; label: string }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    out.push({ date: k, count: counts[k] ?? 0, label });
  }
  return out;
}

// 요일(0=일,1=월,...,6=토) × 시간(0~23) 히트맵 카운트
// 화면에서는 월~일 순서로 표시(아래 toMatrixWeek 활용)
export function groupByHourAndDay(views: PageView[]): number[][] {
  // matrix[day][hour]
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const v of views) {
    const d = new Date(v.created_at);
    if (isNaN(d.getTime())) continue;
    const day = d.getDay();      // 0=Sun
    const hour = d.getHours();   // 0~23
    matrix[day][hour]++;
  }
  return matrix;
}

// Sun-first matrix → Mon-first matrix (월~일 순서)
export function toMatrixWeek(matrixSun: number[][]): { rows: number[][]; labels: string[] } {
  const order = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
  const labels = ['월', '화', '수', '목', '금', '토', '일'];
  return { rows: order.map(i => matrixSun[i]), labels };
}

export function groupByDevice(views: PageView[]): { mobile: number; pc: number; unknown: number } {
  let mobile = 0, pc = 0, unknown = 0;
  for (const v of views) {
    if (v.device === 'mobile') mobile++;
    else if (v.device === 'pc') pc++;
    else unknown++;
  }
  return { mobile, pc, unknown };
}

// referrer를 라벨로 카테고리화 (PageViewTracker와 일관성)
function categorizeReferrer(ref: string | null | undefined): string {
  if (!ref || ref === 'direct') return '직접접속';
  const lower = ref.toLowerCase();
  if (lower.includes('naver')) return '네이버';
  if (lower.includes('google')) return '구글';
  if (lower.includes('kakao')) return '카카오';
  if (lower.includes('daum')) return '다음';
  return '기타';
}

export function groupByReferrer(views: PageView[]): Array<{ label: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const v of views) {
    const k = categorizeReferrer(v.referrer);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  // 표시 순서: 직접접속 → 네이버 → 구글 → 카카오 → 다음 → 기타
  const order = ['직접접속', '네이버', '구글', '카카오', '다음', '기타'];
  return order.filter(k => counts[k] > 0).map(k => ({ label: k, count: counts[k] }));
}

export function groupByPage(views: PageView[], limit: number): Array<{ page: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const v of views) {
    const k = v.page ?? '(unknown)';
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
