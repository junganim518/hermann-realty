import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return new NextResponse('Missing lat/lng', { status: 400 });
  }

  const apiKey = process.env.KAKAO_MAP_JS_KEY;
  if (!apiKey) {
    return new NextResponse('No API key configured', { status: 500 });
  }

  // 카카오 정적지도 API — center/markers는 lng,lat 순서 (x,y)
  const w = 640;
  const h = 480;
  const level = 4;
  const url =
    `https://map.kakao.com/staticmap` +
    `?apikey=${apiKey}` +
    `&center=${lng},${lat}` +
    `&level=${level}` +
    `&w=${w}&h=${h}` +
    `&markers=type:point_red_A,${lng},${lat}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return new NextResponse(`Kakao API error: ${resp.status}`, { status: resp.status });
    }
    const buffer = await resp.arrayBuffer();
    const contentType = resp.headers.get('content-type') ?? 'image/png';
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('Fetch failed', { status: 500 });
  }
}
