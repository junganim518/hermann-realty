-- 1. 테이블 생성 (이미 있으면 skip)
CREATE TABLE IF NOT EXISTS precent_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  caption TEXT,
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS 비활성화 (공개 read 허용)
ALTER TABLE precent_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "공개 읽기" ON precent_gallery
  FOR SELECT USING (true);

-- 3. 이미지 INSERT (아래 precent_gallery_insert.sql 내용을 이어서 실행)
