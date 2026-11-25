// page_views 전체 조회 헬퍼 — .range()로 1000건씩 반복 조회해 5000건 한도를 없앤다.
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // 안전장치: 최대 50,000건

export async function fetchAllPageViews<T = any>(
  client: typeof supabase,
  columns: string,
  sinceIso: string,
): Promise<T[]> {
  const result: T[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await client
      .from('page_views')
      .select(columns)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.warn('[fetchAllPageViews] 조회 중 오류 발생, 지금까지 가져온 데이터만 반환:', error.message);
      return result;
    }

    const rows = (data as T[] | null) ?? [];
    result.push(...rows);

    if (rows.length < PAGE_SIZE) {
      return result; // 마지막 페이지 (더 가져올 데이터 없음)
    }

    if (page === MAX_PAGES - 1) {
      console.warn(`[fetchAllPageViews] 최대 ${MAX_PAGES * PAGE_SIZE}건 한도에 도달 — 이후 데이터는 누락될 수 있음`);
    }
  }

  return result;
}
