// 매물 제목 자동 생성

type TitleForm = {
  address?: string;
  property_type?: string;
  transaction_type?: string;
  current_floor?: string;
  exclusive_area?: string;
  description?: string;
  admin_memo?: string;
  building_name?: string;
  property_number?: string;
  premium?: string;
};

const TEMPLATES = [
  '신중동역 초역세권 {층수} {면적키워드} {매물종류} {거래유형} {장점}',
  '부천 중동 {층수} {평수} {매물종류} {장점} {거래유형}',
  '{지역} {면적키워드} {매물종류} {거래유형} {층수} {평수} {장점}',
  '부천 {매물종류} {거래유형} {층수} {면적키워드} {장점} 공실',
  '신중동역 {층수} {평수} {장점} {매물종류} {거래유형} 임대',
  '{지역} {층수} {면적키워드} {매물종류} {거래유형} {장점} 추천',
  '부천 신중동 {매물종류} {거래유형} {평수} {층수} {장점}',
  '{지역} {장점} {매물종류} {거래유형} {층수} {평수} 공실',
  '부천 {지역} {매물종류} 임대 {면적키워드} {층수} {평수}',
  '신중동역 {면적키워드} {매물종류} {거래유형} {장점} {층수}',
  '{지역} {층수} {매물종류} {거래유형} {평수} {장점} 추천매물',
  '부천 {면적키워드} {매물종류} {거래유형} {지역} {층수} {장점}',
  '신중동역 역세권 {장점} {층수} {평수} {매물종류} {거래유형}',
  '{지역} {층수} {매물종류} {거래유형} {면적키워드} {장점}',
  '부천 {지역} {면적키워드} {장점} {매물종류} {거래유형} {평수}',
  '신중동 {층수} {평수} {매물종류} {거래유형} {장점}',
  '{지역} {매물종류} {거래유형} {면적키워드} {층수} {장점}',
  '부천 {지역} 초역세권 {층수} {평수} {매물종류} {거래유형}',
  '{지역} {장점} {층수} {평수} {매물종류} {거래유형} 공실',
  '신중동역 {층수} {면적키워드} {매물종류} {거래유형} {평수} 임대',
];

function extractRegion(addr: string): string {
  if (!addr) return '';
  const tokens = addr.split(/\s+/);
  for (const t of tokens) {
    if (/^[가-힣]{2,}(동|가)$/.test(t)) return t;
  }
  for (const t of tokens) {
    const m = t.match(/^([가-힣]{2,}(?:동|가))(?=[\d\-]|$)/);
    if (m) return m[1];
  }
  return '';
}

function formatFloor(floor: string): string {
  if (!floor) return '';
  const s = String(floor).trim();
  if (s.endsWith('층')) return s;
  if (s.startsWith('지하')) return `${s}층`;
  return `${s}층`;
}

function sizeKeyword(pyeong: number): string {
  if (!pyeong || pyeong <= 0) return '';
  if (pyeong < 10) return '소형';
  if (pyeong < 15) return '알짜';
  if (pyeong < 20) return '중형';
  return '대형';
}

function detectAdvantages(form: TitleForm): string[] {
  const adv: string[] = [];
  const premNum = parseFloat(form.premium ?? '');
  if (!form.premium || (!isNaN(premNum) && premNum === 0)) adv.push('무권리');

  const text = `${form.description ?? ''} ${form.admin_memo ?? ''}`.toLowerCase();
  if (/렌트프리|랜트프리/.test(text)) adv.push('렌트프리');
  if (/즉시입주|즉시/.test(text)) adv.push('즉시입주');
  if (/신축/.test(text)) adv.push('신축');
  if (/역세권/.test(text)) adv.push('초역세권');
  if (/저렴/.test(text)) adv.push('저렴한 임대료');
  if (/테라스/.test(text)) adv.push('테라스');
  if (/코너/.test(text)) adv.push('코너');
  if (/채광/.test(text)) adv.push('채광');
  return adv;
}

function pickTemplateIndex(seedStr: string): number {
  const s = String(seedStr || '0');
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  return sum % TEMPLATES.length;
}

export function generateTitle(form: TitleForm): string {
  const region = extractRegion(form.address ?? '');
  const floor = formatFloor(form.current_floor ?? '');
  const exArea = parseFloat(form.exclusive_area ?? '');
  const pyeongNum = !isNaN(exArea) && exArea > 0 ? exArea / 3.3058 : 0;
  const pyeong = pyeongNum > 0 ? `${pyeongNum.toFixed(1)}평` : '';
  const sizeKw = sizeKeyword(pyeongNum);
  const propType = (form.property_type ?? '').trim();
  const txType = (form.transaction_type ?? '').trim();
  const advantages = detectAdvantages(form);
  const advantage = advantages.slice(0, 2).join(' ');

  const idx = pickTemplateIndex(form.property_number ?? '');
  const template = TEMPLATES[idx];

  const replaced = template
    .replace(/\{지역\}/g, region)
    .replace(/\{층수\}/g, floor)
    .replace(/\{평수\}/g, pyeong)
    .replace(/\{면적키워드\}/g, sizeKw)
    .replace(/\{매물종류\}/g, propType)
    .replace(/\{거래유형\}/g, txType)
    .replace(/\{장점\}/g, advantage);

  return replaced.replace(/\s+/g, ' ').trim();
}
