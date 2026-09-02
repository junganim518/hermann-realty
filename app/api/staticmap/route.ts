import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

const TILE_SIZE = 256;
const ZOOM = 16;
const GRID = 3; // 3×3 타일 fetch

function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

// lat/lng의 중심 타일 내 픽셀 오프셋
function latLngToPixelOffset(lat: number, lng: number, tx: number, ty: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const px = ((lng + 180) / 360) * n * TILE_SIZE - tx * TILE_SIZE;
  const latRad = (lat * Math.PI) / 180;
  const py =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n *
      TILE_SIZE -
    ty * TILE_SIZE;
  return { px: Math.round(px), py: Math.round(py) };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');

  if (isNaN(lat) || isNaN(lng)) {
    return new NextResponse('Missing lat/lng', { status: 400 });
  }

  try {
    const { x: tx, y: ty } = latLngToTile(lat, lng, ZOOM);
    const half = Math.floor(GRID / 2); // 1

    // 3×3 타일 병렬 fetch
    const fetchTile = async (dx: number, dy: number): Promise<Buffer> => {
      const url = `https://tile.openstreetmap.org/${ZOOM}/${tx + dx - half}/${ty + dy - half}.png`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Hermann-Realty/1.0 (https://www.hermann-realty.com)',
        },
      });
      if (!res.ok) throw new Error(`Tile fetch failed: ${res.status} ${url}`);
      return Buffer.from(await res.arrayBuffer());
    };

    const tilePromises: Promise<Buffer>[] = [];
    for (let dy = 0; dy < GRID; dy++) {
      for (let dx = 0; dx < GRID; dx++) {
        tilePromises.push(fetchTile(dx, dy));
      }
    }
    const tiles = await Promise.all(tilePromises);

    const canvasW = TILE_SIZE * GRID; // 768
    const canvasH = TILE_SIZE * GRID; // 768

    // 타일 합성 입력
    const compositeInputs: sharp.OverlayOptions[] = tiles.map((buf, i) => ({
      input: buf,
      left: (i % GRID) * TILE_SIZE,
      top: Math.floor(i / GRID) * TILE_SIZE,
    }));

    // 마커 위치 계산 (중심 타일 기준)
    const { px, py } = latLngToPixelOffset(lat, lng, tx, ty, ZOOM);
    const markerX = half * TILE_SIZE + px;
    const markerY = half * TILE_SIZE + py;

    // 빨간 원형 마커 SVG
    const R = 10;
    const svgSize = R * 2 + 6;
    const markerSvg = Buffer.from(
      `<svg width="${svgSize}" height="${svgSize}" xmlns="http://www.w3.org/2000/svg">` +
        `<circle cx="${svgSize / 2}" cy="${svgSize / 2}" r="${R}" fill="#e53e3e" stroke="white" stroke-width="2.5"/>` +
        `</svg>`
    );
    compositeInputs.push({
      input: markerSvg,
      left: Math.round(markerX - svgSize / 2),
      top: Math.round(markerY - svgSize / 2),
    });

    // 타일 그리드 합성
    const gridBuf = await sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 242, g: 239, b: 233, alpha: 255 } },
    })
      .composite(compositeInputs)
      .png()
      .toBuffer();

    // 640×480으로 마커 중심 크롭
    const outW = 640;
    const outH = 480;
    const cropLeft = Math.max(0, Math.min(markerX - outW / 2, canvasW - outW));
    const cropTop = Math.max(0, Math.min(markerY - outH / 2, canvasH - outH));

    const png = await sharp(gridBuf)
      .extract({ left: Math.round(cropLeft), top: Math.round(cropTop), width: outW, height: outH })
      .png()
      .toBuffer();

    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    console.error('[staticmap] 오류:', e);
    return new NextResponse('Map generation failed', { status: 500 });
  }
}
