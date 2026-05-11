// 매물 즐겨찾기 localStorage 헬퍼 — 로그인 없이 동작
// 키: "hermann_favorites" — 최신 추가 순 (0번째가 가장 최근)

const STORAGE_KEY = 'hermann_favorites';
const MAX_ITEMS = 100;

export interface Favorite {
  propertyId: string;
  propertyNumber: string;
  addedAt: string;
}

function safeRead(): Favorite[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is Favorite =>
        v && typeof v === 'object' && typeof v.propertyId === 'string'
    );
  } catch {
    return [];
  }
}

function safeWrite(items: Favorite[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('favoritesChanged'));
  } catch {
    // 용량 초과/사파리 프라이빗 모드 등 — 무시
  }
}

export function getFavorites(): Favorite[] {
  return safeRead();
}

export function isFavorite(propertyId: string): boolean {
  return safeRead().some(f => f.propertyId === propertyId);
}

export function addFavorite(property: { id: string; property_number: string | number | null }): void {
  if (!property.id) return;
  const list = safeRead();
  if (list.some(f => f.propertyId === property.id)) return;
  const next: Favorite[] = [
    {
      propertyId: property.id,
      propertyNumber: String(property.property_number ?? ''),
      addedAt: new Date().toISOString(),
    },
    ...list,
  ].slice(0, MAX_ITEMS);
  safeWrite(next);
}

export function removeFavorite(propertyId: string): void {
  if (!propertyId) return;
  const next = safeRead().filter(f => f.propertyId !== propertyId);
  safeWrite(next);
}

export function clearFavorites(): void {
  safeWrite([]);
}

// 토글 — true 반환 시 즐겨찾기 추가됨, false 반환 시 제거됨
export function toggleFavorite(property: { id: string; property_number: string | number | null }): boolean {
  if (isFavorite(property.id)) {
    removeFavorite(property.id);
    return false;
  }
  addFavorite(property);
  return true;
}

// 정합성: localStorage에 있지만 DB에는 없는 ID 정리
export function syncFavorites(existingIds: string[]): void {
  const valid = new Set(existingIds);
  const current = safeRead();
  const cleaned = current.filter(f => valid.has(f.propertyId));
  if (cleaned.length !== current.length) safeWrite(cleaned);
}
