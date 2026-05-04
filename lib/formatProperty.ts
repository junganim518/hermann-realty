// 매물 가격/관리비 등 표시용 헬퍼 (만원 단위 → "20만원", "1억", "1억 5,000만원")

export function formatPrice(v: number | null | undefined): string {
  if (!v) return '-';
  const uk = Math.floor(v / 10000);
  const man = v % 10000;
  if (uk > 0) return man > 0 ? `${uk}억 ${man.toLocaleString()}만원` : `${uk}억`;
  return `${v.toLocaleString()}만원`;
}

// 관리비: 0 또는 빈 값 → "별도" (부동산 관행 표현)
export function formatMaintenance(v: number | null | undefined): string {
  if (!v || v === 0) return '별도';
  return formatPrice(v);
}
