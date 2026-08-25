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
    console.error('[staticmap] KAKAO_MAP_JS_KEY 환경변수 없음');
    return new NextResponse('No API key configured', { status: 500 });
  }

  const w = 640;
  const h = 480;
  const level = 4;

  // 카카오 정적지도 — appkey 파라미터, center/markers는 lng,lat (x,y) 순서
  const kakaoUrl =
    `https://map.kakao.com/staticmap` +
    `?appkey=${apiKey}` +
    `&center=${lng},${lat}` +
    `&level=${level}` +
    `&w=${w}&h=${h}` +
    `&markers=type:point_red_A,${lng},${lat}`;

  console.log('[staticmap] 요청 URL:', kakaoUrl);

  try {
    const resp = await fetch(kakaoUrl);
    const contentType = resp.headers.get('content-type') ?? '';
    console.log('[staticmap] 응답:', resp.status, contentType);

    if (!resp.ok) {
      const body = await resp.text();
      console.error('[staticmap] Kakao 오류 본문:', body.slice(0, 300));
      return new NextResponse(`Kakao API error: ${resp.status}`, { status: resp.status });
    }

    // HTML이 돌아오면 API 키 오류 등으로 지도가 아닌 것
    if (!contentType.includes('image')) {
      const text = await resp.text();
      console.error('[staticmap] 이미지 아닌 응답 — contentType:', contentType, '본문:', text.slice(0, 200));
      return new NextResponse('Not an image response', { status: 500 });
    }

    const buffer = await resp.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[staticmap] fetch 실패:', err);
    return new NextResponse('Fetch failed', { status: 500 });
  }
}
