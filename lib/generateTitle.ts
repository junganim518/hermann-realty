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

// 모든 템플릿은 [부천 {동이름} {매물종류} {거래유형}] 접두부로 시작
const TEMPLATES = [
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {역세권} {거래장점} {층수특성}',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {역세권} {면적표현} {매물종류} {거래장점}',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {건물특성} {거래장점} {층수특성}',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {층수특성} {건물특성} {거래장점}',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {면적표현} {매물종류} {거래장점} 추천매물',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {역세권} {건물특성} {거래장점}',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {거래장점} {층수특성} {건물특성}',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {건물특성} {면적표현} {매물종류} 추천',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {역세권} {층수특성} {거래장점}',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {면적표현} {매물종류} {층수특성} {거래장점}',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {거래장점} {층수특성} 공실',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {건물특성} {거래장점} 도보 5분',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} 초역세권 {층수특성} {거래장점}',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {면적표현} {매물종류} {건물특성}',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {층수특성} {거래장점} 추천매물',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {역세권} {거래장점} 공실',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {거래장점} {건물특성}',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {면적표현} {매물종류} {거래장점} 공실',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {건물특성} {층수특성} {거래장점}',
  '[부천 {지역} {매물종류} {거래유형}] {전용평수} {거래장점} {면적표현} {매물종류} 추천',
];

// 주소에서 '동'으로 끝나는 단어 추출 (예: 중동, 상동, 소사동, 원미동)
function extractRegion(addr: string): string {
  if (!addr) return '';
  const tokens = addr.split(/\s+/);
  for (const t of tokens) {
    if (/^[가-힣]{2,}동$/.test(t)) return t;
  }
  return '';
}

// 층수 특성: "1층 황금입지" / "지하 알짜상가" / "3층 독립공간"
function floorFeature(floor: string): string {
  if (!floor) return '';
  const s = String(floor).trim();
  if (/지하/.test(s) || s.startsWith('-')) return '지하 알짜상가';
  const n = parseInt(s, 10);
  if (isNaN(n)) return '';
  if (n === 1) return '1층 황금입지';
  if (n >= 2) return `${n}층 독립공간`;
  return '';
}

// 역세권: 주소에 신중동/소사 등 포함 시
function subwayFeature(addr: string, seed: number): string {
  if (!addr) return '';
  if (addr.includes('신중동')) {
    return seed % 2 === 0 ? '신중동역 도보 5분' : '7호선 역세권';
  }
  if (addr.includes('소사')) return '소사역 역세권';
  if (addr.includes('부천시청')) return '부천시청역 역세권';
  if (addr.includes('송내')) return '송내역 역세권';
  return '';
}

// 건물 특성: description/admin_memo 키워드 기반
function buildingFeature(form: TitleForm): string {
  const text = `${form.description ?? ''} ${form.admin_memo ?? ''}`;
  if (/신축/.test(text)) return '신축건물';
  if (/채광/.test(text)) return '채광 좋은';
  if (/깔끔/.test(text)) return '깔끔한 내부';
  if (/리모델링/.test(text)) return '리모델링 완료';
  if (/테라스/.test(text)) return '테라스 보유';
  if (/코너/.test(text)) return '코너자리';
  return '';
}

// 거래 장점
function dealBenefit(form: TitleForm): string {
  const premNum = parseFloat(form.premium ?? '');
  const noPrem = !form.premium || (!isNaN(premNum) && premNum === 0);
  const text = `${form.description ?? ''} ${form.admin_memo ?? ''}`;
  if (/렌트프리|랜트프리/.test(text)) return '렌트프리 혜택';
  if (/즉시입주|즉시/.test(text)) return '즉시입주 가능';
  if (noPrem) return '권리금 없는';
  if (/저렴/.test(text)) return '저렴한 임대료';
  return '';
}

// 면적 표현: 10평 이하 아담한 / 10~15 적정규모 / 15~20 넓은 / 20+ 대형
function sizeDescription(pyeong: number): string {
  if (!pyeong || pyeong <= 0) return '';
  if (pyeong < 10) return '아담한';
  if (pyeong < 15) return '적정규모';
  if (pyeong < 20) return '넓은';
  return '대형';
}

function pickTemplateIndex(seedStr: string): number {
  const s = String(seedStr || '0');
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  return sum % TEMPLATES.length;
}

export function generateTitle(form: TitleForm): string {
  const region = extractRegion(form.address ?? '');
  const exArea = parseFloat(form.exclusive_area ?? '');
  const pyeongNum = !isNaN(exArea) && exArea > 0 ? exArea / 3.3058 : 0;
  const pyeongStr = pyeongNum > 0 ? `${Number(pyeongNum.toFixed(1))}평` : '';
  const pyeongWithLabel = pyeongStr ? `전용 ${pyeongStr}` : '';

  const seed = (() => {
    const s = String(form.property_number ?? '0');
    let sum = 0;
    for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
    return sum;
  })();

  const floorFeat = floorFeature(form.current_floor ?? '');
  const subway = subwayFeature(form.address ?? '', seed);
  const buildingFeat = buildingFeature(form);
  const benefit = dealBenefit(form);
  const sizeDesc = sizeDescription(pyeongNum);
  const propType = (form.property_type ?? '').trim();
  const txType = (form.transaction_type ?? '').trim();

  const idx = pickTemplateIndex(form.property_number ?? '');
  const template = TEMPLATES[idx];

  const replaced = template
    .replace(/\{지역\}/g, region)
    .replace(/\{전용평수\}/g, pyeongWithLabel)
    .replace(/\{층수특성\}/g, floorFeat)
    .replace(/\{역세권\}/g, subway)
    .replace(/\{건물특성\}/g, buildingFeat)
    .replace(/\{거래장점\}/g, benefit)
    .replace(/\{면적표현\}/g, sizeDesc)
    .replace(/\{매물종류\}/g, propType)
    .replace(/\{거래유형\}/g, txType);

  return replaced
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']')
    .replace(/\[\s*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
