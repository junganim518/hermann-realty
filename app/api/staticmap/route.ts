import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

// OSM 타일 좌표 계산
function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

// 타일 (x,y)의 좌상단 lat/lng 반환
function tileTopLeft(tileX: number, tileY: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const lng = tileX / n * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / n)));
  return { lat: latRad * 180 / Math.PI, lng };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');

  if (isNaN(lat) || isNaN(lng)) {
    return new NextResponse('Missing lat/lng', { status: 400 });
  }

  const zoom = 16;
  const outputW = 640;
  const outputH = 480;
  const tileSize = 256;

  // 중심 타일
  const center = latLngToTile(lat, lng, zoom);

  // 4열 × 3행 그리드 — 중심 타일은 col=1, row=1 위치
  const colsLeft = 1;
  const rowsAbove = 1;
  const totalCols = 4;
  const totalRows = 3;
  const startX = center.x - colsLeft;
  const startY = center.y - rowsAbove;

  const tilePromises: Promise<{ buf: Buffer; col: number; row: number } | null>[] = [];

  for (let row = 0; row < totalRows; row++) {
    for (let col = 0; col < totalCols; col++) {
      const tx = startX + col;
      const ty = startY + row;
      const url = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
      tilePromises.push(
        fetch(url, {
          headers: {
            'User-Agent': 'Hermann-Realty/1.0 (+https://www.hermann-realty.com; property map)',
          },
        })
          .then(r => (r.ok ? r.arrayBuffer() : null))
          .then(ab => (ab ? { buf: Buffer.from(ab), col, row } : null))
          .catch(() => null)
      );
    }
  }

  const tiles = await Promise.all(tilePromises);

  const canvasW = tileSize * totalCols;
  const canvasH = tileSize * totalRows;

  // 타일 합성 목록
  const composites: sharp.OverlayOptions[] = [];
  for (const tile of tiles) {
    if (!tile) continue;
    composites.push({ input: tile.buf, left: tile.col * tileSize, top: tile.row * tileSize });
  }

  // 중심 타일 안에서 (lat, lng)의 픽셀 위치 계산
  const tl = tileTopLeft(center.x, center.y, zoom);
  const br = tileTopLeft(center.x + 1, center.y + 1, zoom);
  const offsetX = Math.round((lng - tl.lng) / (br.lng - tl.lng) * tileSize);
  const offsetY = Math.round((tl.lat - lat) / (tl.lat - br.lat) * tileSize);

  // 스티치 이미지 기준 마커 위치
  const markerX = colsLeft * tileSize + offsetX;
  const markerY = rowsAbove * tileSize + offsetY;

  // 마커 중심으로 크롭
  const cropLeft = Math.max(0, Math.min(markerX - Math.round(outputW / 2), canvasW - outputW));
  const cropTop  = Math.max(0, Math.min(markerY - Math.round(outputH / 2), canvasH - outputH));

  // 크롭 이미지 생성
  const cropped = await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 220, g: 230, b: 220, alpha: 1 } },
  })
    .composite(composites)
    .extract({ left: cropLeft, top: cropTop, width: outputW, height: outputH })
    .png()
    .toBuffer();

  // 마커 SVG (핀 모양, 빨간색)
  const markerSvg = Buffer.from(
    `<svg width="28" height="36" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M14 2C9.58 2 6 5.58 6 10c0 6.08 8 14 8 14s8-7.92 8-14c0-4.42-3.58-8-8-8z" ` +
    `fill="#e74c3c" stroke="white" stroke-width="2"/>` +
    `<circle cx="14" cy="10" r="3.5" fill="white"/>` +
    `</svg>`
  );

  // 크롭 이미지 기준 마커 위치 (핀 끝이 markerY를 가리킴)
  const pinLeft = markerX - cropLeft - 14;
  const pinTop  = markerY - cropTop - 36;

  const finalOverlays: sharp.OverlayOptions[] = [];
  if (pinLeft < outputW && pinTop < outputH && pinLeft + 28 > 0 && pinTop + 36 > 0) {
    finalOverlays.push({
      input: markerSvg,
      left: Math.max(0, pinLeft),
      top: Math.max(0, pinTop),
    });
  }

  const finalBuf = finalOverlays.length > 0
    ? await sharp(cropped).composite(finalOverlays).png().toBuffer()
    : cropped;

  return new NextResponse(new Uint8Array(finalBuf), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
