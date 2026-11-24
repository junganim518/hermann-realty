// 주소 문자열 맨 앞의 시/도 + 시/군/구만 읽어서 반환한다.
// 사이트가 부천 외 전국 매물을 다루게 되면서, 검색엔진용 설명/JSON-LD에 지역명을
// "부천시"로 고정해두면 다른 지역 매물에는 틀린 정보가 나가므로 이 함수로 대체한다.
// 시/도를 알아볼 수 없으면 추측하지 않고 null을 반환한다 — 호출부는 그 경우 지역 문구를 생략해야 함.

const SIDO_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /^서울(특별시)?/, label: '서울' },
  { re: /^부산(광역시)?/, label: '부산' },
  { re: /^대구(광역시)?/, label: '대구' },
  { re: /^인천(광역시)?/, label: '인천' },
  { re: /^광주(광역시)?/, label: '광주' },
  { re: /^대전(광역시)?/, label: '대전' },
  { re: /^울산(광역시)?/, label: '울산' },
  { re: /^세종(특별자치시)?/, label: '세종' },
  { re: /^경기(도)?/, label: '경기도' },
  { re: /^강원(특별자치도|도)?/, label: '강원도' },
  { re: /^충청북도/, label: '충북' },
  { re: /^충북/, label: '충북' },
  { re: /^충청남도/, label: '충남' },
  { re: /^충남/, label: '충남' },
  { re: /^전북특별자치도/, label: '전북' },
  { re: /^전라북도/, label: '전북' },
  { re: /^전북/, label: '전북' },
  { re: /^전라남도/, label: '전남' },
  { re: /^전남/, label: '전남' },
  { re: /^경상북도/, label: '경북' },
  { re: /^경북/, label: '경북' },
  { re: /^경상남도/, label: '경남' },
  { re: /^경남/, label: '경남' },
  { re: /^제주(특별자치도|도)?/, label: '제주' },
];

export type CityRegion = { region: string; locality: string };

export function extractCityRegion(address: string | null | undefined): CityRegion | null {
  const trimmed = (address ?? '').trim();
  if (!trimmed) return null;

  for (const { re, label } of SIDO_PATTERNS) {
    const sidoMatch = trimmed.match(re);
    if (!sidoMatch) continue;

    const rest = trimmed.slice(sidoMatch[0].length).trim();
    const cityMatch = rest.match(/^([가-힣]+(?:시|군|구))(?=\s|$)/);
    if (!cityMatch) return null;

    return { region: label, locality: cityMatch[1] };
  }

  return null;
}
