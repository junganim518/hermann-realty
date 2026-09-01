/**
 * 보라매 프리센트 갤러리 이미지 WebP 변환 + R2 업로드 스크립트
 * 실행: node scripts/upload-precent-gallery.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env.local 파싱
const envPath = path.join(__dirname, '..', '.env.local');
const envVars = {};
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const ACCOUNT_ID = envVars['CLOUDFLARE_R2_ACCOUNT_ID'];
const ACCESS_KEY = envVars['CLOUDFLARE_R2_ACCESS_KEY_ID'];
const SECRET_KEY = envVars['CLOUDFLARE_R2_SECRET_ACCESS_KEY'];
const BUCKET = envVars['CLOUDFLARE_R2_BUCKET_NAME'];
const PUBLIC_URL = envVars['CLOUDFLARE_R2_PUBLIC_URL'];

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

const SRC_DIR = 'C:/Users/Administrator/Desktop/보라매프리센트/내부사진';

// 선별된 이미지 목록 (category, filename, caption)
const SELECTED = [
  // parking (3장)
  { cat: 'parking', file: 'KakaoTalk_20260831_151509681.jpg',       caption: '지하 2층 주차장 전경' },
  { cat: 'parking', file: 'KakaoTalk_20260831_151509681_01.jpg',    caption: 'EV 전기차 충전구역' },
  { cat: 'parking', file: 'KakaoTalk_20260831_151509681_02.jpg',    caption: '주차 회전판 설치' },

  // corridor (7장)
  { cat: 'corridor', file: 'KakaoTalk_20260831_151509681_04.jpg',   caption: 'B1 엘리베이터 홀' },
  { cat: 'corridor', file: 'KakaoTalk_20260831_151509681_10.jpg',   caption: '1층 로비 복도' },
  { cat: 'corridor', file: 'KakaoTalk_20260831_151509681_15.jpg',   caption: 'PRICENT 엘리베이터 로비' },
  { cat: 'corridor', file: 'KakaoTalk_20260831_151509681_17.jpg',   caption: 'PRICENT 엘리베이터' },
  { cat: 'corridor', file: 'KakaoTalk_20260831_151509681_18.jpg',   caption: '유리 복도 (2층)' },
  { cat: 'corridor', file: 'KakaoTalk_20260831_151509681_16.jpg',   caption: '1층 무인택배시스템' },
  { cat: 'corridor', file: 'KakaoTalk_20260831_151652178_03.jpg',   caption: '복도 및 유리 호실' },

  // restroom (2장)
  { cat: 'restroom', file: 'KakaoTalk_20260831_151509681_11.jpg',   caption: '공용 화장실 입구' },
  { cat: 'restroom', file: 'KakaoTalk_20260831_151652178_17.jpg',   caption: '층별 공용 화장실' },

  // interior (10장)
  { cat: 'interior', file: 'KakaoTalk_20260831_151509681_21.jpg',   caption: '임대 전 기본 상태 (인테리어 전)' },
  { cat: 'interior', file: 'KakaoTalk_20260831_151509681_24.jpg',   caption: '임대 전 기본 상태 (인테리어 전)' },
  { cat: 'interior', file: 'KakaoTalk_20260831_151652178.jpg',      caption: '임대 전 기본 상태 (인테리어 전)' },
  { cat: 'interior', file: 'KakaoTalk_20260831_151652178_04.jpg',   caption: '임대 전 기본 상태 (인테리어 전)' },
  { cat: 'interior', file: 'KakaoTalk_20260831_151652178_05.jpg',   caption: '임대 전 기본 상태 (인테리어 전)' },
  { cat: 'interior', file: 'KakaoTalk_20260831_151652178_10.jpg',   caption: '임대 전 기본 상태 (인테리어 전)' },
  { cat: 'interior', file: 'KakaoTalk_20260831_151652178_18.jpg',   caption: '임대 전 기본 상태 (인테리어 전)' },
  { cat: 'interior', file: 'KakaoTalk_20260831_151652178_20.jpg',   caption: '임대 전 기본 상태 (인테리어 전)' },
  { cat: 'interior', file: 'KakaoTalk_20260831_151652178_26.jpg',   caption: '임대 전 기본 상태 (인테리어 전)' },
  { cat: 'interior', file: 'KakaoTalk_20260831_151652178_27.jpg',   caption: '임대 전 기본 상태 (인테리어 전)' },

  // lounge (2장)
  { cat: 'lounge', file: 'KakaoTalk_20260831_151654930.jpg',        caption: '옥상 테라스 라운지' },
  { cat: 'lounge', file: 'KakaoTalk_20260831_151654930_01.jpg',     caption: '옥상 테라스 라운지 (파노라마 뷰)' },
];

const CAT_ORDER = { parking: 1, corridor: 2, restroom: 3, interior: 4, lounge: 5 };

async function main() {
  const sqlRows = [];
  let sortOrder = 1;

  // 카테고리 순서로 정렬
  const sorted = [...SELECTED].sort((a, b) => (CAT_ORDER[a.cat] || 9) - (CAT_ORDER[b.cat] || 9));

  for (const item of sorted) {
    const srcPath = path.join(SRC_DIR, item.file);
    if (!fs.existsSync(srcPath)) {
      console.warn(`SKIP (not found): ${item.file}`);
      continue;
    }

    // WebP 변환 (1600px 리사이즈, quality 82)
    const webpBuffer = await sharp(srcPath)
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const outName = `precent/${item.cat}-${path.basename(item.file, path.extname(item.file))}.webp`;

    // R2 업로드
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: outName,
      Body: webpBuffer,
      ContentType: 'image/webp',
    }));

    const url = `${PUBLIC_URL}/${outName}`;
    console.log(`✓ ${outName}`);

    sqlRows.push(
      `('${crypto.randomUUID()}', '${url}', '${item.caption.replace(/'/g, "''")}', '${item.cat}', ${sortOrder++})`
    );
  }

  const sql = `-- precent_gallery INSERT (${sqlRows.length}장)
-- Supabase SQL Editor에서 실행

INSERT INTO precent_gallery (id, url, caption, category, sort_order) VALUES
${sqlRows.join(',\n')};
`;

  const sqlOut = path.join(__dirname, '..', 'precent_gallery_insert.sql');
  fs.writeFileSync(sqlOut, sql, 'utf-8');
  console.log(`\nSQL 저장 완료: precent_gallery_insert.sql (${sqlRows.length}행)`);
}

main().catch(console.error);
