export type MinimalProperty = {
  property_number?: string | number | null;
  address?: string | null;
  building_name?: string | null;
  unit_number?: string | null;
};

// "중동 1059 · 푸르지오 시티 B102호" — 매물 식별 정보 (매물번호 제외)
export function formatPropertyTitle(p: MinimalProperty): string {
  const parts: string[] = [];
  if (p.address) parts.push(p.address);
  const bn = (p.building_name ?? '').trim();
  const un = (p.unit_number ?? '').trim();
  if (bn || un) parts.push([bn, un].filter(Boolean).join(' '));
  return parts.join(' · ');
}

// "10000 · 중동 1059 · 푸르지오 시티 B102호" — 매물번호 포함
export function formatPropertyTitleWithNumber(p: MinimalProperty): string {
  const title = formatPropertyTitle(p);
  const num = p.property_number != null && p.property_number !== '' ? String(p.property_number) : '';
  return [num, title].filter(Boolean).join(' · ');
}

// 매물에 대해 검색어가 매칭되는지 (주소/건물명/호수/매물번호)
export function propertyMatchesQuery(p: MinimalProperty, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return (
    (p.address ?? '').toLowerCase().includes(query) ||
    (p.building_name ?? '').toLowerCase().includes(query) ||
    (p.unit_number ?? '').toLowerCase().includes(query) ||
    String(p.property_number ?? '').toLowerCase().includes(query)
  );
}
