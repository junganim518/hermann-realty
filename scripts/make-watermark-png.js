/**
 * 텍스트 워터마크 PNG(assets/watermark.png)를 로컬에서 한 번 생성하는 스크립트.
 *
 * 서버(sharp)는 한글 글꼴이 없어 SVG 텍스트를 직접 그리면 한글이 깨지므로,
 * @napi-rs/canvas(폰트 파일을 직접 읽어 렌더링 — 시스템 폰트 설치 여부와 무관)로
 * 로컬에서 미리 투명 PNG를 만들어 커밋해두고, 서버/스크립트는 이 PNG를 합성만 한다.
 *
 * 글꼴: assets/fonts/PlayfairDisplay-Regular.ttf (영문, OFL),
 *       assets/fonts/Pretendard-Medium.otf (한글, OFL)
 * 두 폰트 모두 로컬 생성 전용 — 런타임(서버)에는 필요 없음(devDependency).
 *
 * 사용법: node scripts/make-watermark-png.js
 */

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { GlobalFonts, createCanvas } = require('@napi-rs/canvas');

const FONTS_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const OUT_PATH = path.join(__dirname, '..', 'assets', 'watermark.png');

const GOLD = '#e2a06e';

// 기존 화면용 CSS 오버레이(app/item/view/[id]/page.tsx .detail-watermark)의 비율을 그대로 반영:
//   영문 40px / letter-spacing 8px (0.2배) · 한글 20px / letter-spacing 4px (0.2배) · 줄 간격 8px(영문 폰트크기의 0.2배)
//   → 영문:한글 폰트크기 2:1, 자간도 2:1 비율 유지. 디자인 캔버스에서는 큰 배율로 그려 고해상도 확보.
const MAIN_FONT_SIZE = 220;
const MAIN_LETTER_SPACING = Math.round(MAIN_FONT_SIZE * 0.2);
const SUB_FONT_SIZE = Math.round(MAIN_FONT_SIZE * 0.5);
const SUB_LETTER_SPACING = Math.round(SUB_FONT_SIZE * 0.2);
const LINE_GAP = Math.round(MAIN_FONT_SIZE * 0.2);

const PADDING_X = 100;
const PADDING_Y = 80;

// 밝은/흰 벽 사진에서도 글자가 읽히도록 글자 뒤에 아주 약하게 넣는 그림자(윤곽 블러).
// 방향성 있는 그림자가 아니라 글자 모양 그대로 블러만 준 halo라 티 나지 않고 은은하게만 보임.
const SHADOW_BLUR_SIGMA = 2.5;
const SHADOW_OPACITY = 0.25;

function registerFonts() {
  const playfair = GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'PlayfairDisplay-Regular.ttf'), 'Playfair Display');
  const pretendard = GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Pretendard-Medium.otf'), 'Pretendard Medium');
  if (!playfair || !pretendard) {
    throw new Error('폰트 등록 실패 — assets/fonts/ 안에 TTF/OTF 파일이 있는지 확인하세요.');
  }
}

async function main() {
  registerFonts();

  // 1차: 측정 전용 캔버스로 실제 텍스트 폭(자간 포함)을 재서 본 캔버스 크기를 정확히 정한다
  // (고정 크기로 먼저 그렸다가 캔버스보다 텍스트가 넓어 양 끝이 잘리는 문제가 있었음).
  const measureCanvas = createCanvas(10, 10);
  const mctx = measureCanvas.getContext('2d');
  mctx.font = `300 ${MAIN_FONT_SIZE}px "Playfair Display"`;
  mctx.letterSpacing = `${MAIN_LETTER_SPACING}px`;
  const mainWidth = mctx.measureText('HERMANN REALTY').width;
  mctx.font = `400 ${SUB_FONT_SIZE}px "Pretendard Medium"`;
  mctx.letterSpacing = `${SUB_LETTER_SPACING}px`;
  const subWidth = mctx.measureText('헤르만부동산').width;

  const CANVAS_W = Math.ceil(Math.max(mainWidth, subWidth) + PADDING_X * 2);
  const CANVAS_H = Math.ceil(MAIN_FONT_SIZE + SUB_FONT_SIZE + LINE_GAP + PADDING_Y * 2);

  const canvas = createCanvas(CANVAS_W, CANVAS_H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;

  const centerX = CANVAS_W / 2;
  const mainY = PADDING_Y + MAIN_FONT_SIZE * 0.5;
  const subY = mainY + MAIN_FONT_SIZE * 0.5 + LINE_GAP + SUB_FONT_SIZE * 0.5;

  ctx.font = `300 ${MAIN_FONT_SIZE}px "Playfair Display"`;
  ctx.letterSpacing = `${MAIN_LETTER_SPACING}px`;
  ctx.fillText('HERMANN REALTY', centerX, mainY);

  ctx.font = `400 ${SUB_FONT_SIZE}px "Pretendard Medium"`;
  ctx.letterSpacing = `${SUB_LETTER_SPACING}px`;
  ctx.fillText('헤르만부동산', centerX, subY);

  const rawPng = canvas.toBuffer('image/png');

  // 글자 알파 채널 그대로 검은색 실루엣을 만들고, 불투명도를 낮춘 뒤 블러 → 글자 뒤에 깐다.
  const alphaRaw = await sharp(rawPng).extractChannel('alpha').raw().toBuffer();
  const blackSilhouette = await sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .joinChannel(alphaRaw, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 1 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const shadowData = Buffer.from(blackSilhouette.data);
  for (let i = 3; i < shadowData.length; i += 4) {
    shadowData[i] = Math.round(shadowData[i] * SHADOW_OPACITY);
  }
  const blurredShadow = await sharp(shadowData, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } })
    .blur(SHADOW_BLUR_SIGMA)
    .png()
    .toBuffer();

  const withShadow = await sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: blurredShadow, left: 0, top: 0 },
      { input: rawPng, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();

  // 텍스트 주변 투명 여백을 잘라내 실제 비율(폭 기준 스케일)이 정확하게 나오도록 함
  const trimmed = await sharp(withShadow).trim({ threshold: 10 }).extend({
    top: 50, bottom: 50, left: 50, right: 50,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toBuffer();

  fs.writeFileSync(OUT_PATH, trimmed);
  const meta = await sharp(trimmed).metadata();
  console.log(`생성 완료: ${OUT_PATH} (${meta.width}x${meta.height})`);
}

main().catch(err => {
  console.error('워터마크 PNG 생성 실패:', err);
  process.exit(1);
});
