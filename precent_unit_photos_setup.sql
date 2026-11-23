-- precent_unit_photos_setup.sql
--
-- 목적: 보라매 프리센트 호실별 사진을 저장하는 테이블과, 방문자에게는 "공실" 호실의
--       사진만 노출하는 공개 뷰를 만든다. properties → public_properties,
--       precent_units → precent_units_public 때와 동일한 구조(테이블 직접 접근은 anon 차단,
--       공개 뷰만 anon에게 SELECT 허용, authenticated는 테이블 전체 CRUD 가능).

create extension if not exists pgcrypto;

-- 1) 호실 사진 테이블
create table if not exists public.precent_unit_photos (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.precent_units(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists precent_unit_photos_unit_id_idx
  on public.precent_unit_photos (unit_id);

-- 2) 공개 뷰 — precent_units.status = 'vacant'인 호실의 사진만 노출
--    (임대완료/문의중 호실 사진은 방문자에게 DB 레벨에서부터 보이지 않음)
--    unit_id(내부 FK) 대신 unit_no를 노출 — 방문자 페이지는 이미 어디서나 unit_no로
--    호실을 식별하고 있어서(precent_units_public도 동일) 그대로 join key로 쓸 수 있고,
--    내부 PK인 unit_id를 anon에게 알릴 필요가 없음.
create or replace view public.precent_unit_photos_public
with (security_invoker = false)
as
select p.id, u.unit_no, p.url, p.sort_order, p.created_at
from public.precent_unit_photos p
join public.precent_units u on u.id = p.unit_id
where u.status = 'vacant';

-- 3) anon의 테이블 직접 접근 차단, 공개 뷰만 SELECT 허용
revoke select on public.precent_unit_photos from anon;
grant select on public.precent_unit_photos_public to anon;

-- 4) authenticated(관리자)는 테이블 전체 조회/추가/수정/삭제 가능
grant select, insert, update, delete on public.precent_unit_photos to authenticated;
