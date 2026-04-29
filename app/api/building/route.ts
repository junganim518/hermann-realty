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
  const flrUrl = `https://apis.data.go.kr/1613000/BldRgstHubService/getBrFlrOulnInfo?serviceKey=${SERVICE_KEY}&sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&bun=${bun}&ji=${ji}&_type=json&numOfRows=100&pageNo=1`;
  // 전유공용면적 일괄 조회 (호 없이) — 모든 호의 면적/용도 데이터 한번에
  const exposPubuseAllUrl = `https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposPubuseAreaInfo?serviceKey=${SERVICE_KEY}&sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&bun=${bun}&ji=${ji}&_type=json&numOfRows=1000&pageNo=1`;

  const titleUrl = titleBaseUrl + '&numOfRows=1&pageNo=1';
  const firstExposUrl = exposBaseUrl + '&numOfRows=100&pageNo=1';

  try {
    // 표제부 + 전유부 1페이지 + 층별개요 + 전유공용면적 일괄 병렬 호출
    const [titleRes, firstRes, flrRes, pubuseAllRes] = await Promise.all([
      fetch(titleUrl),
      fetch(firstExposUrl),
      fetch(flrUrl),
      fetch(exposPubuseAllUrl),
    ]);
    const [titleData, firstData, flrData, pubuseAllData] = await Promise.all([
      titleRes.json(), firstRes.json(), flrRes.json(), pubuseAllRes.json()
    ]);

    const firstItemsRaw = firstData?.response?.body?.items?.item;
    let allItems: any[] = Array.isArray(firstItemsRaw)
      ? [...firstItemsRaw]
      : (firstItemsRaw ? [firstItemsRaw] : []);

    // totalCount 확인 후 남은 페이지 병렬 호출
    const totalCount = Number(firstData?.response?.body?.totalCount) || 0;
    if (totalCount > 100) {
      const pages = Math.ceil(totalCount / 100);
      const pageNums = Array.from({ length: pages - 1 }, (_, i) => i + 2);
      const results = await Promise.all(
        pageNums.map(i => fetch(exposBaseUrl + `&numOfRows=100&pageNo=${i}`).then(r => r.json()))
      );
      for (const data of results) {
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

    // 전유공용면적 일괄 응답 → hoNm 기준 전유 항목 맵 (호별 면적/용도)
    const pubuseAllRaw = pubuseAllData?.response?.body?.items?.item;
    const pubuseAllItems: any[] = Array.isArray(pubuseAllRaw) ? pubuseAllRaw : (pubuseAllRaw ? [pubuseAllRaw] : []);
    if (pubuseAllItems[0]) {
      console.log('[전유공용면적 첫 항목 전체]', JSON.stringify(pubuseAllItems[0], null, 2));
    }
    // 전유 행만 추출하여 호 키별로 첫 항목을 사용 (대표 면적/용도)
    const exclusiveByHo: Record<string, { area: string; mainPurpsCdNm: string; etcPurps: string; flrNo: string; dongNm: string }> = {};
    pubuseAllItems
      .filter((it: any) => it.exposPubuseGbCdNm === '전유')
      .forEach((it: any) => {
        const dongNm = it.dongNm || '';
        const hoNm = it.hoNm || '';
        const key = [dongNm, hoNm].filter(Boolean).join('|');
        if (!exclusiveByHo[key]) {
          exclusiveByHo[key] = {
            area: it.area || '',
            mainPurpsCdNm: it.mainPurpsCdNm || '',
            etcPurps: it.etcPurps || '',
            flrNo: it.flrNo || '',
            dongNm,
          };
        }
      });
    console.log('[전유공용면적] 일괄 조회 결과 — 전유 호:', Object.keys(exclusiveByHo).length, '개');

    // 디버깅: 전유부 첫 항목 전체 (필드 파악)
    if (allItems[0]) {
      console.log('[전유부 첫 항목 전체]', JSON.stringify(allItems[0], null, 2));
    }

    // 전유부(케이스 1: 집합건축물 호실) — hoNm 있는 항목만
    // 면적/용도는 전유공용면적 일괄 데이터 우선 → 전유부 자체 데이터로 fallback
    const hoList = allItems
      .filter((item: any) => !!item.hoNm)
      .map((item: any) => {
        const dongNm = item.dongNm || '';
        const hoNm = item.hoNm || '';
        const display = [dongNm, hoNm].filter(Boolean).join(' ');
        const key = [dongNm, hoNm].filter(Boolean).join('|');
        const merged = exclusiveByHo[key];
        // 용도: 일괄 → 전유부 항목 → 빈값
        const usage = merged?.etcPurps || merged?.mainPurpsCdNm || item.etcPurps || item.mainPurpsCdNm || '';
        // 면적: 일괄(전유) → 전유부 항목 → 빈값
        const area = merged?.area || item.area || '';
        const flrNo = merged?.flrNo || item.flrNo || '';
        return {
          dongNm,
          hoNm,
          display,
          area,
          etcPurps: usage,
          flrNo,
        };
      });

    // 층별개요(케이스 2: 일반건축물 다층) — flrList. 항목 자체 용도만 사용
    const flrItemsRaw = flrData?.response?.body?.items?.item;
    const flrItems: any[] = Array.isArray(flrItemsRaw) ? flrItemsRaw : (flrItemsRaw ? [flrItemsRaw] : []);
    if (flrItems[0]) {
      const sample = flrItems[0];
      console.log('[층별개요 샘플 필드]', {
        flrNo: sample.flrNo, flrGbCdNm: sample.flrGbCdNm,
        mainPurpsCdNm: sample.mainPurpsCdNm, etcPurps: sample.etcPurps,
        area: sample.area,
      });
    }
    const flrList: any[] = flrItems.map((item: any) => {
      const flrNoNum = Number(item.flrNo) || 0;
      const isUnder = item.flrGbCdNm === '지하';
      const baseDisplay = isUnder ? `지하${Math.abs(flrNoNum)}층` : `${flrNoNum}층`;
      const usage = item.etcPurps || item.mainPurpsCdNm || '';
      return {
        dongNm: item.dongNm || '',
        hoNm: '',
        display: baseDisplay,
        area: item.area || '',
        etcPurps: usage,
        flrNo: item.flrNo || '',
        flrGbCdNm: item.flrGbCdNm || '',
      };
    });

    // 같은 층 중복 disambiguation — display(value) unique 보장. 면적은 프론트가 별도로 표시하므로 단순히 #N만 부여
    const dispCounts: Record<string, number> = {};
    flrList.forEach(f => { dispCounts[f.display] = (dispCounts[f.display] ?? 0) + 1; });
    const dispIdx: Record<string, number> = {};
    flrList.forEach(f => {
      if (dispCounts[f.display] > 1) {
        dispIdx[f.display] = (dispIdx[f.display] ?? 0) + 1;
        f.display = `${f.display} #${dispIdx[f.display]}`;
      }
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

    return NextResponse.json({ title, expos, exposList: hoList, flrList, buildingName, areaItems });
  } catch (e: any) {
    console.error('[건축물대장] 에러:', e.message, e.name);
    return NextResponse.json({ error: e.message, name: e.name }, { status: 500 });
  }
}
