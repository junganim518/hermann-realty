import { NextRequest, NextResponse } from 'next/server';

// 공공데이터포털 특일정보 - 국경일/공휴일 조회 (XML 응답 파싱)
// https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  if (!year || !month) {
    return NextResponse.json({ error: 'year, month 필수' }, { status: 400 });
  }

  // 디코딩된 키 (URL 조합 시 encodeURIComponent 적용)
  const SERVICE_KEY = '0a90ff614361cc7dc563db5135d06cef111bc3dd399a757e9bce16d52a434811';
  const mm = String(month).padStart(2, '0');

  const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo`
    + `?serviceKey=${encodeURIComponent(SERVICE_KEY)}`
    + `&solYear=${year}`
    + `&solMonth=${mm}`
    + `&numOfRows=50`;

  console.log('[holidays] 요청 URL:', url);

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const xml = await res.text();
    console.log('[holidays] 상태:', res.status);
    console.log('[holidays] 응답 본문:', xml);

    const holidays = parseHolidaysXml(xml);
    console.log('[holidays] 최종 공휴일:', holidays);

    return NextResponse.json({ holidays });
  } catch (err: any) {
    console.error('[holidays] fetch 실패:', err);
    return NextResponse.json({ error: err?.message ?? 'fetch failed', holidays: [] }, { status: 500 });
  }
}

// XML <item> 블록을 정규식으로 순회하며 공휴일만 추출
function parseHolidaysXml(xml: string): { date: string; name: string }[] {
  const result: { date: string; name: string }[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  const tagRe = (tag: string) => new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);

  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const isHoliday = block.match(tagRe('isHoliday'))?.[1]?.trim();
    if (isHoliday !== 'Y') continue;

    const locdate = block.match(tagRe('locdate'))?.[1]?.trim();
    const dateName = block.match(tagRe('dateName'))?.[1]?.trim();
    if (!locdate || locdate.length !== 8) continue;

    result.push({
      date: `${locdate.slice(0, 4)}-${locdate.slice(4, 6)}-${locdate.slice(6, 8)}`,
      name: dateName ?? '',
    });
  }
  return result;
}
