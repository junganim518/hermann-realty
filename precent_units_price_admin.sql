-- precent_units_price_admin.sql
--
-- 목적: precent_units의 가격 컬럼(deposit_krw, monthly_rent_krw)을 관리자(authenticated)만
--       조회/수정 가능하게 하고, 방문자(anon)에게는 가격 컬럼을 뺀 공개 뷰로만 노출한다.
--       properties → public_properties 뷰로 분리했던 것과 동일한 구조.
--
-- 배경: 현재 방문자용 /properties/boramae-precent 페이지는 service_role 키로 precent_units를
--       통째로 조회한 뒤, 코드에서 select 컬럼을 수동으로 지정해 가격을 제외하고 있다.
--       이건 코드 실수(예: select('*')로 바뀌는 경우) 한 번이면 가격이 그대로 브라우저로
--       내려갈 수 있는 구조라, DB 레벨에서 원천적으로 막는다.
--
-- 적용 후에도 관리자 화면(/admin/precent-units)은 그대로 precent_units 테이블을
-- authenticated 세션으로 조회/수정하므로 영향 없음.

-- 1) 공개용 뷰 생성 — 가격 컬럼(deposit_krw, monthly_rent_krw) 제외
create or replace view public.precent_units_public
with (security_invoker = false)
as
select
  id, unit_no, floor, zone, exclusive_area_py, contract_area_py, status, memo, created_at, updated_at
from public.precent_units;

-- 2) anon의 precent_units 테이블 직접 접근 차단
--    (이미 막혀 있는 상태라면 아무 영향 없이 안전하게 재실행 가능)
revoke select on public.precent_units from anon;

-- 3) anon에게는 공개 뷰에 대한 SELECT 권한만 부여 (가격 컬럼 자체가 뷰에 없음)
grant select on public.precent_units_public to anon;

-- 4) authenticated(관리자)는 기존처럼 precent_units 전체 컬럼(가격 포함) 조회/수정 가능
--    — 기존에 이미 되고 있던 것을 명시적으로 재확인
grant select, update on public.precent_units to authenticated;
