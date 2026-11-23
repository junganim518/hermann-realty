import sharp from 'sharp';
import path from 'path';

// 사진 가운데에 헤르만부동산 로고(public/logo.png)를 연하게 합성한다.
// 흰색 실루엣 + 약한 그림자 방식이라 어두운 사진/밝은 사진 모두에서 자연스럽게 보인다.
const LOGO_PATH = path.join(process.cwd(), 'public', 'logo.png');
const WATERMARK_WIDTH_RATIO = 0.4;
const WATERMARK_OPACITY = 0.22;
const SHADOW_BLUR = 6;
const SHADOW_OFFSET = 3;

async function buildLogoLayer(targetWidth: number): Promise<{ buffer: Buffer; width: number; height: number }> {
  const resizedBuf = await sharp(LOGO_PATH)
    .resize(targetWidth, targetWidth, { fit: 'inside' })
    .ensureAlpha()
    .png()
    .toBuffer();
  const meta = await sharp(resizedBuf).metadata();
  const w = meta.width!;
  const h = meta.height!;
  const alphaRaw = await sharp(resizedBuf).extractChannel('alpha').raw().toBuffer();

  const white = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(alphaRaw, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer();
  const black = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .joinChannel(alphaRaw, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer();
  const blurredShadow = await sharp(black).blur(SHADOW_BLUR).toBuffer();

  const pad = SHADOW_BLUR * 2 + SHADOW_OFFSET;
  const canvasW = w + pad * 2;
  const canvasH = h + pad * 2;

  const layer = await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: blurredShadow, top: pad + SHADOW_OFFSET, left: pad + SHADOW_OFFSET },
      { input: white, top: pad, left: pad },
    ])
    .png()
    .toBuffer();

  return { buffer: layer, width: canvasW, height: canvasH };
}

async function applyLayerOpacity(buffer: Buffer, opacity: number): Promise<Buffer> {
  const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * opacity);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// 업로드 원본 버퍼를 받아 워터마크를 합성한 WebP 버퍼를 반환한다.
export async function applyWatermark(input: Buffer): Promise<Buffer> {
  const base = sharp(input).rotate();
  const meta = await base.metadata();
  const width = meta.width!;
  const height = meta.height!;

  const wmTargetWidth = Math.round(width * WATERMARK_WIDTH_RATIO);
  const { buffer: rawLayer, width: lw, height: lh } = await buildLogoLayer(wmTargetWidth);
  const finalLayer = await applyLayerOpacity(rawLayer, WATERMARK_OPACITY);

  const left = Math.max(0, Math.min(Math.round((width - lw) / 2), Math.max(0, width - lw)));
  const top = Math.max(0, Math.min(Math.round((height - lh) / 2), Math.max(0, height - lh)));

  return sharp(input)
    .rotate()
    .composite([{ input: finalLayer, left, top }])
    .webp({ quality: 85 })
    .toBuffer();
}
