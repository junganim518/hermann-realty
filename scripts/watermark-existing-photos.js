/**
 * 이미 R2/DB에 올라가 있는 사진에 헤르만부동산 로고 워터마크를 일괄 합성한다.
 *
 * 대상 테이블(컬럼):
 *   - property_images (image_url)   — 매물 사진
 *   - precent_gallery (url)         — 프리센트 건물 갤러리
 *   - precent_unit_photos (url)     — 프리센트 호실 사진
 *
 * 동작:
 *   1) 원본 사진을 R2에서 내려받아 워터마크(lib/watermark.js, /api/upload와 공용) 합성
 *   2) 원본 키에 "-wm.webp"를 붙인 새 키로 R2에 "추가" 업로드 (원본은 절대 삭제/덮어쓰기 안 함)
 *   3) DB의 url 컬럼을 새 주소로 UPDATE
 *   4) scripts/watermark-log.csv에 "옛 주소 → 새 주소" 기록
 *   5) scripts/watermark-rollback.sql에 되돌리기용 UPDATE문 기록
 *
 * 이미 "-wm."이 붙은 주소는 대상에서 제외 → 두 번 실행해도 중복 적용 안 됨.
 *
 * 사용법:
 *   node scripts/watermark-existing-photos.js --dry-run              전체 대상 개수만 표로 출력 (변경 없음)
 *   node scripts/watermark-existing-photos.js --limit 1 --only precent_unit_photos   1건만 실제 적용
 *   node scripts/watermark-existing-photos.js                        전체 실제 적용
 *
 * 옵션:
 *   --dry-run         실제로 바꾸지 않고 테이블별 대상 개수만 출력
 *   --limit N         최대 N장만 처리 (테이블 구분 없이 전체 합산 기준)
 *   --only 테이블명    지정한 테이블만 처리 (property_images / precent_gallery / precent_unit_photos)
 */

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const { applyWatermark } = require('../lib/watermark');

// .env.local 로드 (dotenv 의존성 없이 직접 파싱 — 기존 scripts/upload-floor-plans.js와 동일 방식)
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

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  CLOUDFLARE_R2_ACCOUNT_ID,
  CLOUDFLARE_R2_ACCESS_KEY_ID,
  CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  CLOUDFLARE_R2_BUCKET_NAME,
  CLOUDFLARE_R2_PUBLIC_URL,
} = process.env;

const missingEnv = [
  'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'CLOUDFLARE_R2_BUCKET_NAME', 'CLOUDFLARE_R2_PUBLIC_URL',
].filter(k => !process.env[k]);

if (missingEnv.length) {
  console.error('.env.local에 다음 환경변수가 누락되었습니다:', missingEnv.join(', '));
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

// 대상 테이블 정의: table명 / url 컬럼명 / pk 컬럼명
const TARGETS = [
  { table: 'property_images', col: 'image_url', pk: 'id' },
  { table: 'precent_gallery', col: 'url', pk: 'id' },
  { table: 'precent_unit_photos', col: 'url', pk: 'id' },
];

const ALREADY_WATERMARKED_RE = /-wm\.\w+(\?.*)?$/i;

function parseArgs(argv) {
  const opts = { dryRun: false, limit: Infinity, only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') opts.dryRun = true;
    else if (argv[i] === '--limit') opts.limit = parseInt(argv[++i], 10) || 0;
    else if (argv[i] === '--only') opts.only = argv[++i];
  }
  return opts;
}

function deriveR2Key(url) {
  if (!url.startsWith(CLOUDFLARE_R2_PUBLIC_URL)) return null;
  return url.slice(CLOUDFLARE_R2_PUBLIC_URL.length).replace(/^\//, '');
}

function buildWatermarkedKey(originalKey) {
  const withoutExt = originalKey.replace(/\.[^./]+$/, '');
  return `${withoutExt}-wm.webp`;
}

const LOG_CSV_PATH = path.join(__dirname, 'watermark-log.csv');
const ROLLBACK_SQL_PATH = path.join(__dirname, 'watermark-rollback.sql');

function appendLogRow(table, id, oldUrl, newUrl) {
  if (!fs.existsSync(LOG_CSV_PATH)) {
    fs.writeFileSync(LOG_CSV_PATH, 'timestamp,table,id,old_url,new_url\n', 'utf8');
  }
  const row = [new Date().toISOString(), table, id, oldUrl, newUrl].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  fs.appendFileSync(LOG_CSV_PATH, row + '\n', 'utf8');
}

function appendRollbackSql(table, col, pk, id, oldUrl) {
  if (!fs.existsSync(ROLLBACK_SQL_PATH)) {
    fs.writeFileSync(
      ROLLBACK_SQL_PATH,
      '-- watermark-existing-photos.js 실행 결과를 되돌리는 SQL. Supabase SQL Editor에서 실행.\n' +
      '-- (R2에 올라간 "-wm" 파일 자체는 지우지 않음 — 필요하면 R2 콘솔에서 별도 삭제)\n\n',
      'utf8'
    );
  }
  const escaped = String(oldUrl).replace(/'/g, "''");
  fs.appendFileSync(
    ROLLBACK_SQL_PATH,
    `update public.${table} set ${col} = '${escaped}' where ${pk} = '${id}';\n`,
    'utf8'
  );
}

async function fetchOriginal(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`원본 다운로드 실패 (${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadWatermarked(key, buffer) {
  await r2Client.send(new PutObjectCommand({
    Bucket: CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'image/webp',
  }));
  return `${CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
}

async function loadTargetRows(table, col, pk) {
  const { data, error } = await supabase.from(table).select(`${pk}, ${col}`);
  if (error) throw error;
  return (data || []).filter(row => {
    const url = row[col];
    return url && !ALREADY_WATERMARKED_RE.test(url);
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const targets = opts.only ? TARGETS.filter(t => t.table === opts.only) : TARGETS;

  if (opts.only && targets.length === 0) {
    console.error(`알 수 없는 --only 값: ${opts.only} (사용 가능: ${TARGETS.map(t => t.table).join(', ')})`);
    process.exit(1);
  }

  console.log(`대상 테이블: ${targets.map(t => t.table).join(', ')}${opts.dryRun ? ' (dry-run)' : ''}${opts.limit !== Infinity ? ` / limit=${opts.limit}` : ''}\n`);

  const rowsByTable = {};
  for (const t of targets) {
    rowsByTable[t.table] = await loadTargetRows(t.table, t.col, t.pk);
  }

  if (opts.dryRun) {
    console.log('테이블별 워터마크 대상 (아직 "-wm" 미적용) 개수:');
    console.log('------------------------------------------');
    let total = 0;
    for (const t of targets) {
      const count = rowsByTable[t.table].length;
      total += count;
      console.log(`${t.table.padEnd(22)} ${count}건`);
    }
    console.log('------------------------------------------');
    console.log(`합계 ${total}건`);
    return;
  }

  let remaining = opts.limit;
  const summary = {};
  for (const t of targets) {
    summary[t.table] = { done: 0, skipped: 0, failed: 0 };
  }

  for (const t of targets) {
    if (remaining <= 0) break;
    const rows = rowsByTable[t.table];
    for (const row of rows) {
      if (remaining <= 0) break;
      const id = row[t.pk];
      const oldUrl = row[t.col];
      const key = deriveR2Key(oldUrl);

      if (!key) {
        console.warn(`[건너뜀] ${t.table}#${id}: R2_PUBLIC_URL과 다른 도메인이라 키를 알 수 없음 (${oldUrl})`);
        summary[t.table].skipped++;
        continue;
      }

      try {
        console.log(`[처리중] ${t.table}#${id} ← ${oldUrl}`);
        const original = await fetchOriginal(oldUrl);
        const watermarked = await applyWatermark(original);
        const newKey = buildWatermarkedKey(key);
        const newUrl = await uploadWatermarked(newKey, watermarked);

        const { error: updateError } = await supabase.from(t.table).update({ [t.col]: newUrl }).eq(t.pk, id);
        if (updateError) throw updateError;

        appendLogRow(t.table, id, oldUrl, newUrl);
        appendRollbackSql(t.table, t.col, t.pk, id, oldUrl);

        console.log(`  → 완료: ${newUrl}`);
        summary[t.table].done++;
        remaining--;
      } catch (err) {
        console.error(`  → 실패: ${err.message || err}`);
        summary[t.table].failed++;
      }
    }
  }

  console.log('\n처리 결과:');
  console.log('------------------------------------------');
  for (const t of targets) {
    const s = summary[t.table];
    console.log(`${t.table.padEnd(22)} 완료 ${s.done} / 건너뜀 ${s.skipped} / 실패 ${s.failed}`);
  }
}

main().catch(err => {
  console.error('스크립트 실행 중 오류:', err);
  process.exit(1);
});
