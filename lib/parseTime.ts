// 자유 형식 시간 문자열을 파싱해 { h, m } 반환. 실패 시 null.
// 허용 예: "14:00", "14:0", "14", "오후 2시", "오전 10시 30분", "2시 30분"
export function parseTimeString(raw: string): { h: number; m: number } | null {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return null;

  // HH:MM  (예: 14:00, 9:5)
  let m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mn = parseInt(m[2], 10);
    if (h >= 0 && h < 24 && mn >= 0 && mn < 60) return { h, m: mn };
    return null;
  }

  // HH  (예: 14)
  m = s.match(/^(\d{1,2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    if (h >= 0 && h < 24) return { h, m: 0 };
    return null;
  }

  // 오전/오후 H시 [M분]
  m = s.match(/^(오전|오후)\s*(\d{1,2})시\s*(?:(\d{1,2})분?)?$/);
  if (m) {
    let h = parseInt(m[2], 10);
    const mn = m[3] ? parseInt(m[3], 10) : 0;
    if (h < 0 || h > 12 || mn < 0 || mn >= 60) return null;
    if (m[1] === '오후' && h < 12) h += 12;
    if (m[1] === '오전' && h === 12) h = 0;
    return { h, m: mn };
  }

  // H시 [M분]  (오전/오후 없음)
  m = s.match(/^(\d{1,2})시\s*(?:(\d{1,2})분?)?$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mn = m[2] ? parseInt(m[2], 10) : 0;
    if (h >= 0 && h < 24 && mn >= 0 && mn < 60) return { h, m: mn };
    return null;
  }

  return null;
}

// ISO 문자열 → "HH:MM" (로컬 시간 기준)
export function isoToTimeString(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ISO 문자열 → "YYYY-MM-DD" (로컬 기준)
export function isoToDateString(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 날짜(YYYY-MM-DD) + 시간 문자열(자유형식) → ISO 문자열. 둘 다 없으면 null. 시간 파싱 실패 시 { error } 반환.
export function combineDateTime(date: string, timeRaw: string): { iso: string | null; error?: string } {
  if (!date) return { iso: null };
  const parsed = timeRaw.trim() ? parseTimeString(timeRaw) : { h: 0, m: 0 };
  if (!parsed) return { iso: null, error: '시간 형식을 인식할 수 없습니다.' };
  const [y, mo, d] = date.split('-').map(n => parseInt(n, 10));
  const dt = new Date(y, mo - 1, d, parsed.h, parsed.m, 0, 0);
  return { iso: dt.toISOString() };
}
