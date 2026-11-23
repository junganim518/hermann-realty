/**
 * 보라매 프리센트 호실 사진 일괄 업로드 (최초 1회용)
 *
 * 지정한 폴더의 하위 폴더 이름(= 호실번호)을 기준으로 사진을 WebP(가로 1600px, 품질 82)로
 * 변환해서 Cloudflare R2의 precent/units/{호실번호}/ 에 올린다.
 * DB(precent_unit_photos)에는 직접 쓰지 않고, INSERT문을 precent_unit_photos_insert.sql로
 * 생성만 한다 — 실제 실행은 Supabase SQL Editor에서 직접 한다.
 *
 * 사용법:
 *   node scripts/upload-precent-unit-photos.js "C:\path\to\호실사진"
 *
 * 폴더 구조 예시:
 *   호실사진/
 *     301/  1.jpg  2.jpg ...
 *     302/  1.jpg ...
 *
 * 규칙:
 *   - 폴더 이름이 precent_units.unit_no와 정확히 일치해야 매칭됨 (대소문자/공백 그대로 비교)
 *   - 매칭 안 되는 폴더, 같은 unit_no가 여러 층에 있어 특정할 수 없는 폴더,
 *     공실(vacant)이 아닌 호실의 폴더는 업로드하지 않고 목록으로만 보고
 */

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

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

const SOURCE_DIR = process.argv[2];
if (!SOURCE_DIR) {
  console.error('사용법: node scripts/upload-precent-unit-photos.js "<호실사진 폴더 경로>"');
  process.exit(1);
}
if (!fs.existsSync(SOURCE_DIR) || !fs.statSync(SOURCE_DIR).isDirectory()) {
  console.error(`❌ 폴더를 찾을 수 없습니다: ${SOURCE_DIR}`);
  process.exit(1);
}

const {
  CLOUDFLARE_R2_ACCOUNT_ID,
  CLOUDFLARE_R2_ACCESS_KEY_ID,
  CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  CLOUDFLARE_R2_BUCKET_NAME,
  CLOUDFLARE_R2_PUBLIC_URL,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const missingEnv = [
  'CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME', 'CLOUDFLARE_R2_PUBLIC_URL',
  'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
].filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error('❌ .env.local에 다음 환경변수가 누락되었습니다:', missingEnv.join(', '));
  process.exit(1);
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY },
});
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

// 자연 정렬 (1.jpg, 2.jpg, ... 10.jpg 순서가 되도록 — 단순 문자열 정렬 시 10이 2보다 앞에 옴)
function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

async function convertToWebp(filePath) {
  const buf = fs.readFileSync(filePath);
  return sharp(buf)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

async function uploadBuffer(buf, unitNo) {
  const key = `precent/units/${unitNo}/${uuidv4()}.webp`;
  await r2.send(new PutObjectCommand({
    Bucket: CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    Body: buf,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
}

(async () => {
  console.log(`📂 소스: ${SOURCE_DIR}`);

  const { data: units, error } = await supabase
    .from('precent_units')
    .select('id, unit_no, floor, status');
  if (error) {
    console.error('❌ precent_units 조회 실패:', error.message);
    process.exit(1);
  }

  const byNo = {};
  for (const u of units) {
    (byNo[u.unit_no] = byNo[u.unit_no] || []).push(u);
  }

  const subdirs = fs.readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const unmatched = [];
  const duplicates = [];
  const skippedNotVacant = [];
  const inserted = []; // { unit_no, url, sort_order }

  for (const folderName of subdirs) {
    const matches = byNo[folderName] ?? [];
    if (matches.length === 0) {
      unmatched.push(folderName);
      continue;
    }
    if (matches.length > 1) {
      duplicates.push({ folderName, floors: matches.map((u) => u.floor) });
      continue;
    }

    const unit = matches[0];
    if (unit.status !== 'vacant') {
      skippedNotVacant.push({ folderName, floor: unit.floor, status: unit.status });
      continue;
    }

    const folderPath = path.join(SOURCE_DIR, folderName);
    const files = fs.readdirSync(folderPath)
      .filter((f) => IMAGE_EXT.test(f))
      .sort(naturalCompare);

    if (files.length === 0) {
      console.log(`⚠️  ${folderName} — 이미지 파일 없음`);
      continue;
    }

    console.log(`\n▶ ${folderName}호 (${unit.floor}) — ${files.length}장`);
    let order = 0;
    for (const fileName of files) {
      try {
        const webpBuf = await convertToWebp(path.join(folderPath, fileName));
        const url = await uploadBuffer(webpBuf, unit.unit_no);
        inserted.push({ unit_no: unit.unit_no, url, sort_order: order });
        console.log(`  ✅ ${fileName} → ${url}`);
        order++;
      } catch (e) {
        console.error(`  ❌ ${fileName} 업로드 실패:`, e.message);
      }
    }
  }

  // ── precent_unit_photos_insert.sql 생성 ──
  const lines = [];
  lines.push('-- precent_unit_photos_insert.sql');
  lines.push('-- scripts/upload-precent-unit-photos.js 실행 결과로 자동 생성됨.');
  lines.push('-- Supabase SQL Editor에서 직접 실행하세요.');
  lines.push('');
  for (const row of inserted) {
    lines.push(
      `insert into public.precent_unit_photos (unit_id, url, sort_order) values ` +
      `((select id from public.precent_units where unit_no = '${sqlEscape(row.unit_no)}'), ` +
      `'${sqlEscape(row.url)}', ${row.sort_order});`
    );
  }
  const outPath = path.resolve(__dirname, '..', 'precent_unit_photos_insert.sql');
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');

  // ── 요약 리포트 ──
  console.log('\n\n========== 요약 ==========');
  console.log(`업로드된 사진: ${inserted.length}장 (SQL: ${outPath})`);

  console.log(`\n매칭 안 된 폴더 (${unmatched.length}개):`);
  unmatched.forEach((f) => console.log(`  - ${f}`));

  console.log(`\n같은 호실번호가 여러 층에 있어 건너뛴 폴더 (${duplicates.length}개):`);
  duplicates.forEach((d) => console.log(`  - ${d.folderName} → 층: ${d.floors.join(', ')}`));

  console.log(`\n공실이 아니라 건너뛴 폴더 (${skippedNotVacant.length}개):`);
  skippedNotVacant.forEach((s) => console.log(`  - ${s.folderName} (${s.floor}, 상태: ${s.status})`));

  process.exit(0);
})();
