-- watermark-existing-photos.js 실행 결과를 되돌리는 SQL. Supabase SQL Editor에서 실행.
-- (R2에 올라간 "-wm" 파일 자체는 지우지 않음 — 필요하면 R2 콘솔에서 별도 삭제)

update public.precent_unit_photos set url = 'https://pub-f74a12fe75844385b015b3336498abe7.r2.dev/precent/units/303/115a8529-8435-4274-bf7f-aa642e0f23c4.webp' where id = '88d113c5-f0e2-4eca-81d1-ca67559625d2';
