// 프리센트 오피스텔 특별분양 페이지의 사진 용도 태그 — 관리자 사진 관리 화면과
// 방문자/미리보기 화면(OfficetelLanding)이 공용으로 쓰는 단일 정의.
export const PHOTO_TAGS = [
  { value: 'living', label: '거실' },
  { value: 'bedroom', label: '침실' },
  { value: 'kitchen', label: '주방' },
  { value: 'bath', label: '욕실' },
  { value: 'view', label: '전망' },
  { value: 'exterior', label: '외관' },
  { value: 'around', label: '주변' },
  { value: 'floorplan', label: '평면도' },
] as const;

export type PhotoTagValue = typeof PHOTO_TAGS[number]['value'];

// 태그가 비었거나 목록에 없는 값이면 "미분류"
export function photoTagLabel(tag?: string | null): string {
  return PHOTO_TAGS.find(t => t.value === tag)?.label ?? '미분류';
}

// SQL(precent_officetel_media.sql)이 아직 실행되지 않아 tag/caption/stats_text 컬럼이 없을 때
// Supabase가 돌려주는 에러를 구분해서 "SQL 적용이 필요합니다" 같은 안내를 보여주기 위한 헬퍼.
export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  return /column .* does not exist/i.test(error.message ?? '');
}
