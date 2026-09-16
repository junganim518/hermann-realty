-- 목적: page_views 버스트성 트래픽(짧은 시간에 몰리는 자동화 요청)의 정체를
--       user_agent로 특정할 수 있도록 컬럼 추가.
-- 배경: page_views에는 현재 id/page/device/created_at/referrer만 있고
--       IP/세션/user_agent가 전혀 없어 09-15, 09-16에 반복된 버스트 트래픽의
--       실체를 추적할 수 없었음.

alter table public.page_views
  add column if not exists user_agent text;

-- anon이 INSERT 시 user_agent 컬럼도 함께 보낼 수 있어야 하므로 별도 권한 조치는 불필요
-- (컬럼 추가는 기존 INSERT 권한 범위에 자동 포함됨).
