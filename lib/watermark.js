// 사진에 HERMANN REALTY / 헤르만부동산 텍스트 워터마크(assets/watermark.png)를 합성하는 공용 함수.
// app/api/upload/route.ts(업로드 시 자동 적용)와 scripts/watermark-existing-photos.js(기존 사진 일괄 적용)가
// 이 파일 하나를 함께 사용한다 — 로직이 두 곳에 따로 있지 않도록 하기 위함.
//
// assets/watermark.png은 scripts/make-watermark-png.js로 로컬에서 한 번 생성해 커밋해둔 투명 PNG다.
// (서버에는 한글 글꼴이 없어 sharp가 SVG 텍스트를 직접 그리면 한글이 깨지기 때문에, 텍스트 자체는
//  미리 이미지로 만들어두고 서버/스크립트는 이 PNG를 사진 위에 합성만 한다.)
//
// CommonJS로 작성 — scripts/watermark-existing-photos.js(node로 직접 실행)에서 require()로 그대로
// 불러 쓰기 위함. Next.js(app/api/upload/route.ts)에서는 `import { applyWatermark } from '@/lib/watermark'`로
// 동일하게 불러진다(webpack/SWC가 CommonJS 모듈을 import 구문으로 쓰는 것을 지원).

const sharp = require('sharp');
const path = require('path');

const WATERMARK_PNG_PATH = path.join(process.cwd(), 'assets', 'watermark.png');

// 사진 가로폭 대비 워터마크 폭 비율, 최종 합성 시 적용할 불투명도.
// 필요하면 이 두 상수만 조정하면 된다.
const WATERMARK_WIDTH_RATIO = 0.48;
const WATERMARK_OPACITY = 0.55;

let cachedPngPromise = null;
function loadWatermarkPngRaw() {
  if (!cachedPngPromise) {
    cachedPngPromise = sharp(WATERMARK_PNG_PATH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  }
  return cachedPngPromise;
}

async function applyLayerOpacity(buffer, width, height, opacity) {
  const { data, info } = await sharp(buffer, { raw: { width, height, channels: 4 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * opacity);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// 업로드 원본 버퍼를 받아 워터마크를 합성한 WebP 버퍼를 반환한다.
async function applyWatermark(input) {
  const base = sharp(input).rotate();
  const meta = await base.metadata();
  const width = meta.width;
  const height = meta.height;

  const { data: pngRaw, info: pngInfo } = await loadWatermarkPngRaw();

  const targetWidth = Math.min(width, Math.round(width * WATERMARK_WIDTH_RATIO));
  const resizedLayerBuf = await sharp(pngRaw, { raw: { width: pngInfo.width, height: pngInfo.height, channels: 4 } })
    .resize({ width: targetWidth })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const finalLayer = await applyLayerOpacity(
    resizedLayerBuf.data,
    resizedLayerBuf.info.width,
    resizedLayerBuf.info.height,
    WATERMARK_OPACITY
  );

  const lw = resizedLayerBuf.info.width;
  const lh = resizedLayerBuf.info.height;
  const left = Math.max(0, Math.round((width - lw) / 2));
  const top = Math.max(0, Math.round((height - lh) / 2));

  return sharp(input)
    .rotate()
    .composite([{ input: finalLayer, left, top }])
    .webp({ quality: 85 })
    .toBuffer();
}

module.exports = { applyWatermark, WATERMARK_WIDTH_RATIO, WATERMARK_OPACITY, WATERMARK_PNG_PATH };
