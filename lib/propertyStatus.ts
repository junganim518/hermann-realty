export type PropertyStatus = '거래중' | '보류' | '거래완료' | '공동중개매물';

export const PROPERTY_STATUSES: PropertyStatus[] = ['거래중', '보류', '거래완료', '공동중개매물'];

// 하위호환: status 컬럼이 있으면 그걸 쓰고, 없으면 is_sold로 추론
export function getPropertyStatus(p: { status?: string | null; is_sold?: boolean | null }): PropertyStatus {
  if (p.status === '보류' || p.status === '거래완료' || p.status === '거래중' || p.status === '공동중개매물') return p.status;
  return p.is_sold ? '거래완료' : '거래중';
}

// 사이트 일반 사용자에게 노출 여부 — 보류·공동중개매물은 숨김
export function isPubliclyVisible(p: { status?: string | null; is_sold?: boolean | null }): boolean {
  const s = getPropertyStatus(p);
  return s !== '보류' && s !== '공동중개매물';
}

export function getStatusBadgeColors(status: PropertyStatus): { bg: string; color: string; border: string } {
  switch (status) {
    case '보류':         return { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' };
    case '거래완료':     return { bg: '#fef0ee', color: '#e04a4a', border: '#f5c2bd' };
    case '공동중개매물': return { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' };
    default:             return { bg: '#dcfce7', color: '#166534', border: '#86efac' };
  }
}

// status 변경 시 is_sold도 동기화 (하위호환)
export function statusToPayload(status: PropertyStatus): { status: PropertyStatus; is_sold: boolean } {
  return { status, is_sold: status === '거래완료' };
}

// 토글 순환: 거래중 → 보류 → 거래완료 → 공동중개매물 → 거래중
export function nextStatus(current: PropertyStatus): PropertyStatus {
  const idx = PROPERTY_STATUSES.indexOf(current);
  return PROPERTY_STATUSES[(idx + 1) % PROPERTY_STATUSES.length];
}
