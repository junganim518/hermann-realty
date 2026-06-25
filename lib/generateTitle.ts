type TitleForm = {
  address?: string;
  property_type?: string;
  transaction_type?: string;
  exclusive_area?: string;
};

function extractRegion(addr: string): string {
  if (!addr) return '';
  const tokens = addr.split(/\s+/);
  return tokens.find(t =>
    t.endsWith('동') &&
    !t.endsWith('구') &&
    !t.endsWith('시') &&
    !t.endsWith('도') &&
    t.length >= 2
  ) || '';
}

export function generateTitle(form: TitleForm): string {
  const region = extractRegion(form.address ?? '');
  const propType = (form.property_type ?? '').trim();
  const rawTx = (form.transaction_type ?? '').trim();
  const txType = (rawTx === '월세' || rawTx === '전세') ? '임대' : rawTx;

  const exArea = parseFloat(form.exclusive_area ?? '');
  const pyeongNum = !isNaN(exArea) && exArea > 0 ? exArea / 3.3058 : 0;
  const pyeongWithLabel = pyeongNum > 0 ? `전용 ${Number(pyeongNum.toFixed(1))}평` : '';

  const parts = [region, propType, txType].filter(Boolean).join(' ');
  const prefix = parts ? `[부천 ${parts}]` : '[부천]';
  return [prefix, pyeongWithLabel].filter(Boolean).join(' ');
}
