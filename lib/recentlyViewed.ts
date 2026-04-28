// 최근 본 매물 localStorage 헬퍼
// 키: "recently_viewed_properties" — 매물 UUID 배열 (최신이 0번째)

const STORAGE_KEY = 'recently_viewed_properties';
const MAX_ITEMS = 20;

function safeRead(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

function safeWrite(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 용량 초과/사파리 프라이빗 모드 등 — 무시
  }
}

export function getRecentlyViewed(): string[] {
  return safeRead();
}

export function addRecentlyViewed(propertyId: string): void {
  if (!propertyId) return;
  const list = safeRead();
  // 이미 있으면 제거 (재추가 시 맨 앞으로 이동)
  const next = [propertyId, ...list.filter(id => id !== propertyId)].slice(0, MAX_ITEMS);
  safeWrite(next);
}

export function removeRecentlyViewed(propertyId: string): void {
  if (!propertyId) return;
  const next = safeRead().filter(id => id !== propertyId);
  safeWrite(next);
}

export function clearRecentlyViewed(): void {
  safeWrite([]);
}

// localStorage에 있지만 DB에는 없는 ID들을 정리 (정합성 체크)
export function syncRecentlyViewed(existingIds: string[]): void {
  const valid = new Set(existingIds);
  const current = safeRead();
  const cleaned = current.filter(id => valid.has(id));
  if (cleaned.length !== current.length) {
    safeWrite(cleaned);
  }
}
