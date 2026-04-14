import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sigunguCd = searchParams.get('sigunguCd');
  const bjdongCd = searchParams.get('bjdongCd');
  const bun = searchParams.get('bun');
  const ji = searchParams.get('ji') || '0000';
  const dong = searchParams.get('dong') || '';
  const ho = searchParams.get('ho') || '';

  if (!sigunguCd || !bjdongCd || !bun) {
    return NextResponse.json({ error: 'sigunguCd, bjdongCd, bun 은 필수입니다.' }, { status: 400 });
  }

  const SERVICE_KEY = process.env.NEXT_PUBLIC_BUILDING_API_KEY;

  const titleBaseUrl = `https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo?serviceKey=${SERVICE_KEY}&sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&bun=${bun}&ji=${ji}&_type=json`;
  const exposBaseUrl = `https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposInfo?serviceKey=${SERVICE_KEY}&sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&bun=${bun}&ji=${ji}&dongNm=${encodeURIComponent(dong)}&hoNm=${encodeURIComponent(ho)}&_type=json`;

  const titleUrl = titleBaseUrl + '&numOfRows=1&pageNo=1';
  const firstExposUrl = exposBaseUrl + '&numOfRows=100&pageNo=1';

  try {
    const titleRes = await fetch(titleUrl);
    const titleData = await titleRes.json();

    // 전유부 1페이지
    const firstRes = await fetch(firstExposUrl);
    const firstData = await firstRes.json();

    const firstItemsRaw = firstData?.response?.body?.items?.item;
    let allItems: any[] = Array.isArray(firstItemsRaw)
      ? [...firstItemsRaw]
      : (firstItemsRaw ? [firstItemsRaw] : []);

    // totalCount 확인 후 남은 페이지 순차 호출 (타임아웃 방지)
    const totalCount = Number(firstData?.response?.body?.totalCount) || 0;
    if (totalCount > 100) {
      const pages = Math.ceil(totalCount / 100);
      for (let i = 2; i <= pages; i++) {
        const res = await fetch(exposBaseUrl + `&numOfRows=100&pageNo=${i}`);
        const data = await res.json();
        const items = data?.response?.body?.items?.item;
        if (Array.isArray(items)) allItems = [...allItems, ...items];
        else if (items) allItems.push(items);
      }
    }

    // 호수 기준 자연 정렬 (한글 포함 숫자 인식)
    allItems.sort((a: any, b: any) => {
      const hoA = a.hoNm || '';
      const hoB = b.hoNm || '';
      return hoA.localeCompare(hoB, 'ko', { numeric: true });
    });

    const titleItems = titleData?.response?.body?.items?.item;
    const title = Array.isArray(titleItems) ? titleItems[0] : titleItems;
    const expos = allItems[0];

    const buildingName = title?.bldNm || title?.platPlcNm || allItems[0]?.dongNm || '';

    const hoList = allItems.map((item: any) => {
      const dongNm = item.dongNm || '';
      const hoNm = item.hoNm || '';
      const display = hoNm || (item.flrNo ? `${item.flrNo}층` : '');
      return {
        dongNm,
        hoNm,
        display,
        area: item.area || '',
        etcPurps: item.etcPurps || '',
        flrNo: item.flrNo || '',
      };
    });

    // 전유공용면적 (호수 파라미터 있을 때만 조회)
    let areaItems: any[] = [];
    if (ho) {
      const areaUrl = `https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposPubuseAreaInfo?serviceKey=${SERVICE_KEY}&sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&bun=${bun}&ji=${ji}&dongNm=${encodeURIComponent(dong)}&hoNm=${encodeURIComponent(ho)}&numOfRows=10&pageNo=1&_type=json`;
      const areaRes = await fetch(areaUrl);
      const areaData = await areaRes.json();
      const areaRaw = areaData?.response?.body?.items?.item;
      areaItems = Array.isArray(areaRaw) ? areaRaw : (areaRaw ? [areaRaw] : []);
      console.log('[전유공용면적 샘플]', JSON.stringify(areaItems[0], null, 2));
    }

    return NextResponse.json({ title, expos, exposList: hoList, buildingName, areaItems });
  } catch (e: any) {
    console.error('[건축물대장] 에러:', e.message, e.name);
    return NextResponse.json({ error: e.message, name: e.name }, { status: 500 });
  }
}
