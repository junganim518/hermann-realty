// 프리센트 오피스텔 특별분양 페이지의 사진 용도 태그 — 관리자 사진 관리 화면과
// 방문자/미리보기 화면(OfficetelLanding)이 공용으로 쓰는 단일 정의.
export const PHOTO_TAGS = [
  { value: 'view', label: '전망' },
  { value: 'exterior', label: '외관' },
  { value: 'around', label: '주변' },
  { value: 'transport', label: '교통' },
  { value: 'infra', label: '생활인프라' },
  { value: 'school', label: '교육' },
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

// 설명(caption) 끝에 "(이미지컷)"을 적으면 화면에서는 그 문구를 지우고 대신 작은 배지로 표시한다.
// (참고용 이미지라는 뜻 — 분양사 제공 이미지컷 등) 모자이크/줄 사진/라이트박스가 공용으로 사용.
export function parsePhotoCaption(caption?: string | null): { text: string | null; isImageCut: boolean } {
  if (!caption) return { text: null, isImageCut: false };
  const isImageCut = caption.includes('이미지컷');
  const text = caption.replace(/\(?\s*이미지컷\s*\)?/g, '').trim();
  return { text: text || null, isImageCut };
}
