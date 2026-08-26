import { createClient } from '@supabase/supabase-js';

// RLS 우회용 서버 전용 클라이언트 — 절대 브라우저에 노출 금지
// 서버 컴포넌트·API route에서만 import
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
