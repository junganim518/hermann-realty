import { NextRequest, NextResponse } from 'next/server';

const SERVICE_KEY = '0a90ff614361cc7dc563db5135d06cef111bc3dd399a757e9bce16d52a434811';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius') || '500';
  const businessType = searchParams.get('businessType') || '';
  void businessType;

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat, lng 파라미터가 필요합니다.' }, { status: 400 });
  }

  const url =
    `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius` +
    `?serviceKey=${SERVICE_KEY}` +
    `&pageNo=1&numOfRows=1000` +
    `&radius=${radius}` +
    `&cx=${lng}&cy=${lat}` +
    `&type=json`;

  try {
    const r = await fetch(url, { next: { revalidate: 3600 } });
    const text = await r.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: '소상공인 API 응답 파싱 실패', raw: text.slice(0, 300) },
        { status: 500 }
      );
    }

    // 응답 구조 호환 처리
    const body = data?.body || data?.response?.body || data?.Response?.body;
    let items = body?.items || [];
    if (items?.item) items = items.item;
    if (!Array.isArray(items)) items = items ? [items] : [];

    // 집계
    const categoryMap: Record<string, number> = {};
    const subCategoryMap: Record<string, number> = {};
    const stores: any[] = [];

    items.forEach((it: any) => {
      const lcls = it.indsLclsNm || '기타';
      const mcls = it.indsMclsNm || '';
      const scls = it.indsSclsNm || '';
      categoryMap[lcls] = (categoryMap[lcls] || 0) + 1;
      if (mcls) subCategoryMap[mcls] = (subCategoryMap[mcls] || 0) + 1;
      stores.push({
        name: it.bizesNm,
        category: lcls,
        subCategory: mcls,
        detailCategory: scls,
        address: it.rdnmAdr || it.lnoAdr || '',
        lat: parseFloat(it.lat),
        lng: parseFloat(it.lon),
      });
    });

    const categories = Object.entries(categoryMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const topSubCategories = Object.entries(subCategoryMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json(
      {
        total: stores.length,
        categories,
        topSubCategories,
        stores: stores.slice(0, 300),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'API 호출 실패' }, { status: 500 });
  }
}
