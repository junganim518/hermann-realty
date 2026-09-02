import { NextRequest, NextResponse } from 'next/server';

// Kakao 앱 키 (서버사이드)
const APPKEY = process.env.KAKAO_MAP_JS_KEY ?? '8a478b4b6ea5e02722a33f6ac2fa34b6';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');

  if (isNaN(lat) || isNaN(lng)) {
    return new NextResponse('Missing lat/lng', { status: 400 });
  }

  // Kakao Static Map API
  // center: 경도,위도 순서 / markers pos: "경도 위도" (공백 구분)
  const kakaoUrl =
    `https://spi.maps.daum.net/map/staticmap.png` +
    `?appkey=${APPKEY}` +
    `&center=${lng},${lat}` +
    `&level=4` +
    `&w=640&h=480` +
    `&markers=color:red|pos:${lng} ${lat}`;

  try {
    const res = await fetch(kakaoUrl, {
      headers: {
        Referer: 'https://www.hermann-realty.com',
        'User-Agent': 'Hermann-Realty/1.0',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[staticmap] Kakao API 오류:', res.status, body.slice(0, 200));
      return new NextResponse(`Kakao map error ${res.status}`, { status: 502 });
    }

    const buf = await res.arrayBuffer();
    const ct = res.headers.get('content-type') ?? 'image/png';

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    console.error('[staticmap] fetch 실패:', e);
    return new NextResponse('Internal error', { status: 500 });
  }
}
