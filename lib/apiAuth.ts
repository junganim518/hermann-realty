import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

/**
 * API 라우트(서버)에서 로그인한 관리자인지 확인하는 헬퍼.
 * 프로젝트의 supabase 클라이언트는 세션을 브라우저(localStorage)에만 저장하고
 * 쿠키를 쓰지 않으므로, 클라이언트가 Authorization: Bearer <access_token> 헤더로
 * 직접 토큰을 실어 보내고 여기서 supabase.auth.getUser(token)으로 검증한다.
 */
export async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
