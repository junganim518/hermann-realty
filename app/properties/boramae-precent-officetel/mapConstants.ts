// 입지·교통 섹션의 지도 — 주소/URL을 한 곳에만 둔다(관리자 입력 필드 없음, API 키 불필요).
export const OFFICETEL_ADDRESS = '서울특별시 동작구 신대방동 377-1 보라매역 프리센트';

export const OFFICETEL_MAP_EMBED_SRC =
  `https://www.google.com/maps?q=${encodeURIComponent(OFFICETEL_ADDRESS)}&output=embed&hl=ko`;

export const OFFICETEL_MAP_SEARCH_URL =
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(OFFICETEL_ADDRESS)}`;
