-- 1F KT(102)·스타벅스(111~114) 계약 해지 반영
-- Supabase SQL Editor에서 실행

-- 1. 102호 KT 공실 처리
UPDATE precent_units
  SET status = 'vacant', memo = NULL
  WHERE unit_no = '102' AND floor = '1F';

-- 2. 스타벅스 기존 레코드 삭제 (합쳐진 레코드 포함)
DELETE FROM precent_units
  WHERE floor = '1F' AND unit_no IN ('111', '112', '113', '114', '111-114', '111~114');

-- 3. 111~114 개별 호실 삽입
INSERT INTO precent_units (unit_no, floor, zone, exclusive_area_py, contract_area_py, status, memo)
VALUES
  ('111', '1F', 'street-fb', 11.4345, 11.4345, 'vacant', NULL),
  ('112', '1F', 'street-fb', 11.4345, 11.4345, 'vacant', NULL),
  ('113', '1F', 'street-fb', 11.4345, 11.4345, 'vacant', NULL),
  ('114', '1F', 'street-fb', 11.5737, 11.5737, 'vacant', NULL);
