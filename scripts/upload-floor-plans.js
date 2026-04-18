/**
 * /mnt/user-data/uploads/ 에 있는 배치도 이미지 6장을 Cloudflare R2의 floor-plans/ 폴더에 업로드
 *
 * 사용법: node scripts/upload-floor-plans.js
 */

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// .env.local 로드 (dotenv 의존성 없이 직접 파싱)
(function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
})();

const SOURCE_DIR = path.resolve(__dirname, '..', 'floor-plans');

const FILE_MAP = [
  { src: 'B1F.jpg', dst: 'floor-plans/B1F.jpg', label: '지하1층' },
  { src: '1F.jpg',  dst: 'floor-plans/1F.jpg',  label: '1층' },
  { src: '2F.jpg',  dst: 'floor-plans/2F.jpg',  label: '2층' },
  { src: '3F.jpg',  dst: 'floor-plans/3F.jpg',  label: '3층' },
  { src: '4F.jpg',  dst: 'floor-plans/4F.jpg',  label: '4층' },
  { src: '5F.jpg',  dst: 'floor-plans/5F.jpg',  label: '5층' },
];

const {
  CLOUDFLARE_R2_ACCOUNT_ID,
  CLOUDFLARE_R2_ACCESS_KEY_ID,
  CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  CLOUDFLARE_R2_BUCKET_NAME,
  CLOUDFLARE_R2_PUBLIC_URL,
} = process.env;

const missingEnv = [
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
  'CLOUDFLARE_R2_PUBLIC_URL',
].filter((k) => !process.env[k]);

if (missingEnv.length) {
  console.error('❌ .env.local에 다음 환경변수가 누락되었습니다:', missingEnv.join(', '));
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

async function uploadOne({ src, dst, label }) {
  const srcPath = path.join(SOURCE_DIR, src);

  if (!fs.existsSync(srcPath)) {
    console.error(`❌ ${label} — 파일 없음: ${srcPath}`);
    return false;
  }

  const body = fs.readFileSync(srcPath);
  const size = (body.length / 1024).toFixed(1);

  await client.send(
    new PutObjectCommand({
      Bucket: CLOUDFLARE_R2_BUCKET_NAME,
      Key: dst,
      Body: body,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const url = `${CLOUDFLARE_R2_PUBLIC_URL}/${dst}`;
  console.log(`✅ ${label.padEnd(6)} ${size.padStart(7)} KB  →  ${url}`);
  return true;
}

(async () => {
  console.log(`📂 소스: ${SOURCE_DIR}`);
  console.log(`🪣 버킷: ${CLOUDFLARE_R2_BUCKET_NAME}\n`);

  let ok = 0;
  let fail = 0;
  for (const item of FILE_MAP) {
    try {
      (await uploadOne(item)) ? ok++ : fail++;
    } catch (e) {
      fail++;
      console.error(`❌ ${item.label} 업로드 실패:`, e.message);
    }
  }

  console.log(`\n완료: 성공 ${ok} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
