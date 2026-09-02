-- 1. status 컬럼 CHECK 제약 확인
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'properties'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%status%';

-- ─────────────────────────────────────────────────────
-- 위 쿼리 결과에 제약 이름이 나오면 아래를 실행:
-- (conname 값으로 제약명 교체 — 예: properties_status_check)
-- ─────────────────────────────────────────────────────

-- 2. 기존 CHECK 제약 삭제 (제약명은 위 결과의 conname으로 교체)
-- ALTER TABLE properties DROP CONSTRAINT properties_status_check;

-- 3. 새 CHECK 제약 추가 (공동중개매물 포함)
-- ALTER TABLE properties ADD CONSTRAINT properties_status_check
--   CHECK (status IN ('거래중', '보류', '거래완료', '공동중개매물'));
