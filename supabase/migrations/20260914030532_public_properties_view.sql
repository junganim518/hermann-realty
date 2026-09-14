-- 목적: properties 테이블의 민감 컬럼(landlord_name, landlord_phone, tenant_name, tenant_phone,
--       extra_contacts, admin_memo)이 anon key로 직접 조회 시 노출되는 문제를 DB 레벨에서 차단.
--
-- 배경 (사전 조사 결과):
--   anon key와 service_role key로 properties를 동일 조건(status별, 전체)으로 조회해 행 개수를
--   비교한 결과, 모든 케이스에서 두 키의 결과가 정확히 일치했다 (예: 거래중 286, 보류 10,
--   거래완료 32, 공동중개매물 2, 전체 330 — anon/service 동일).
--   즉 현재 anon 대상 RLS SELECT 정책은 status 기준 필터링을 전혀 하지 않고 있고(보류·공동중개매물
--   제외는 각 페이지의 .neq() 같은 애플리케이션 레벨 필터일 뿐, DB 레벨 보장이 아니었음),
--   deleted_at IS NULL 조건도 현재 트래시(소프트 삭제)된 매물이 0건이라 anon 요청만으로는
--   RLS가 실제로 걸러주는지 행동적으로 재현/확인할 수 없었다 (pg_catalog가 PostgREST에 노출되지
--   않아 정책 정의 자체를 REST로 직접 조회할 수도 없었음).
--   → 이 마이그레이션은 기존 RLS 정책의 정확한 조건에 의존하지 않고, 아래 구조로 완전히
--     대체한다: anon은 테이블 SELECT 권한 자체를 잃고, public_properties 뷰(소유자 권한으로
--     동작, deleted_at IS NULL만 필터링)를 통해서만 읽을 수 있다.
--   → status(보류/공동중개매물 제외) 필터는 뷰에 넣지 않았다. app/map/page.tsx는 현재 status
--     필터 없이 전체를 보여주고 있어(다른 페이지와 다름), 뷰 단에서 status를 강제로 걸러내면
--     그 페이지의 기존 동작이 바뀌어버린다. 대신 각 페이지가 지금처럼 자기 쿼리에서
--     .neq('status', ...)를 계속 적용하면 된다 — 뷰는 테이블 대신 조회하는 대상만 바뀔 뿐,
--     PostgREST 필터 체이닝(.eq/.neq/.is 등)은 뷰에서도 테이블과 동일하게 동작한다.

-- 1) 공개 뷰 생성 — PUBLIC_PROPERTY_COLUMNS(lib/publicPropertyFields.ts)와 동일한 컬럼만 노출
--    security_invoker = false (Postgres 기본값과 동일, 명시적으로 지정) → 뷰는 소유자 권한으로
--    실행되어 properties의 RLS 대신 아래 WHERE 절이 유일한 필터가 된다.
create or replace view public.public_properties
with (security_invoker = false)
as
select
  id, property_number, title, description, address, building_name, unit_number,
  transaction_type, property_type, theme_type, deposit, monthly_rent, sale_price,
  maintenance_fee, premium, current_deposit, current_rent, supply_area, exclusive_area,
  land_area, total_floor_area, building_area, floor_area_ratio, building_coverage_ratio,
  current_floor, total_floor, direction, parking, elevator, total_parking, room_count,
  bathroom_count, land_number, available_date, approval_date, usage_type, is_recommended,
  is_new, is_sold, status, business_name, business_name_public, agent_id, view_count,
  latitude, longitude, created_at, updated_at
from public.properties
where deleted_at is null;

-- 2) anon의 properties 테이블 직접 접근 차단
--    REVOKE는 정책 이름을 몰라도 무조건 동작한다 — 테이블 권한 자체가 없으면 RLS 정책과 무관하게
--    막힌다. authenticated 권한은 건드리지 않으므로 관리자 화면은 영향 없음.
revoke select on public.properties from anon;

-- 2-1) anon 전용으로만 걸려있던 SELECT 정책이 있다면 함께 정리 (authenticated/public과 공유되는
--      정책은 절대 건드리지 않도록 roles가 정확히 {anon}인 것만 대상으로 함 — 관리자 접근 보호).
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'properties'
      and roles::text[] = array['anon']
  loop
    execute format('drop policy %I on public.properties', pol.policyname);
    raise notice 'dropped anon-only policy on public.properties: %', pol.policyname;
  end loop;
end $$;

-- 3) anon에게 뷰에 대한 SELECT 권한 부여
grant select on public.public_properties to anon;

-- 4) authenticated(관리자 로그인) 권한은 기존 그대로 유지 — 이 마이그레이션에서 아무것도 바꾸지 않음.
