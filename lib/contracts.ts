// 계약 관련 헬퍼

import { formatPrice } from '@/lib/formatProperty';

export type ContractType = '월세' | '전세' | '매매';
export type ContractStatus = '진행중' | '입주완료' | '만기임박' | '만기' | '재계약' | '종료';

export const CONTRACT_TYPES: ContractType[] = ['월세', '전세', '매매'];
export const CONTRACT_STATUSES: ContractStatus[] = ['진행중', '입주완료', '만기임박', '만기', '재계약', '종료'];

/** 만기일까지 남은 일수. 양수=남음, 0=오늘, 음수=지남. null=계산 불가 */
export function calculateDDay(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return null;
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export type DDayUrgency = 'normal' | 'warning' | 'urgent' | 'critical' | 'expired' | 'na';

export function getDDayInfo(endDate: string | null | undefined, contractType: ContractType): {
  dDay: number | null;
  urgency: DDayUrgency;
  label: string;
  color: string;
  bg: string;
} {
  // 매매는 만기 개념 없음
  if (contractType === '매매') {
    return { dDay: null, urgency: 'na', label: '-', color: '#888', bg: '#f5f5f5' };
  }
  const dd = calculateDDay(endDate);
  if (dd === null) {
    return { dDay: null, urgency: 'na', label: '-', color: '#888', bg: '#f5f5f5' };
  }
  if (dd < 0) {
    return { dDay: dd, urgency: 'expired', label: `만기 +${Math.abs(dd)}일`, color: '#666', bg: '#f0f0f0' };
  }
  if (dd === 0) {
    return { dDay: dd, urgency: 'critical', label: 'D-DAY', color: '#fff', bg: '#dc2626' };
  }
  if (dd <= 7) {
    return { dDay: dd, urgency: 'critical', label: `D-${dd}`, color: '#fff', bg: '#dc2626' };
  }
  if (dd <= 30) {
    return { dDay: dd, urgency: 'urgent', label: `D-${dd}`, color: '#9a3412', bg: '#fed7aa' };
  }
  if (dd <= 60) {
    return { dDay: dd, urgency: 'warning', label: `D-${dd}`, color: '#854d0e', bg: '#fef9c3' };
  }
  return { dDay: dd, urgency: 'normal', label: `D-${dd}`, color: '#666', bg: '#f3f4f6' };
}

/** 만기 임박 여부 (60일 이내, 임대 계약만) */
export function isExpiringSoon(c: { contract_type: ContractType; end_date?: string | null; status?: ContractStatus }): boolean {
  if (c.contract_type === '매매') return false;
  if (c.status === '종료' || c.status === '재계약') return false;
  const dd = calculateDDay(c.end_date);
  if (dd === null) return false;
  return dd >= 0 && dd <= 60;
}

/** 클라이언트 측 자동 상태 표시: DB status 우선, 단 진행중/입주완료인데 60일 이내면 "만기임박" 표시 */
export function effectiveStatus(c: { contract_type: ContractType; end_date?: string | null; status?: ContractStatus }): ContractStatus {
  const stored: ContractStatus = (c.status as ContractStatus) ?? '진행중';
  if (c.contract_type === '매매') return stored;
  if (stored === '종료' || stored === '재계약' || stored === '만기') return stored;
  if (isExpiringSoon(c)) return '만기임박';
  return stored;
}

const STATUS_COLORS: Record<ContractStatus, { bg: string; color: string; border: string }> = {
  '진행중':   { bg: '#e0f2fe', color: '#075985', border: '#7dd3fc' },
  '입주완료': { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  '만기임박': { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  '만기':     { bg: '#fed7aa', color: '#9a3412', border: '#fdba74' },
  '재계약':   { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
  '종료':     { bg: '#f3f4f6', color: '#525252', border: '#d4d4d4' },
};

export function getStatusColors(status: ContractStatus | string | null | undefined): { bg: string; color: string; border: string } {
  return STATUS_COLORS[(status as ContractStatus) ?? '진행중'] ?? STATUS_COLORS['진행중'];
}

/** 계약 가격 한 줄 요약 — "보 3,000 / 월 100" / "전세 5,000" / "매매 3억 5,000" */
export function formatContractPrice(c: {
  contract_type: ContractType;
  deposit?: number | null;
  monthly_rent?: number | null;
  sale_price?: number | null;
}): string {
  if (c.contract_type === '매매') {
    if (c.sale_price) return `매매 ${formatPrice(c.sale_price)}`;
    if (c.deposit) return `매매 ${formatPrice(c.deposit)}`;
    return '매매 -';
  }
  if (c.contract_type === '전세') {
    return `전세 ${c.deposit ? formatPrice(c.deposit) : '-'}`;
  }
  // 월세
  const parts = [];
  if (c.deposit) parts.push(`보 ${c.deposit.toLocaleString()}`);
  if (c.monthly_rent) parts.push(`월 ${c.monthly_rent.toLocaleString()}`);
  return parts.length > 0 ? parts.join(' / ') : '월세 -';
}

/** "YYYY.MM.DD" */
export function formatDateShort(date: string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** "YYYY.MM.DD ~ YYYY.MM.DD" */
export function formatPeriod(start: string | null | undefined, end: string | null | undefined): string {
  if (!start && !end) return '-';
  return `${formatDateShort(start)} ~ ${formatDateShort(end)}`;
}
