import { supabase } from '@/lib/supabase';

// 보라매 프리센트 관리자 화면에서 저장이 끝난 직후 1회 호출 — 방문자 페이지(ISR, revalidate 1800)를
// 즉시 갱신한다. path를 생략하면 기존처럼 '/properties/boramae-precent'만 갱신된다(기존 호출 호환).
// 실패해도 저장 자체와는 무관하므로 화면에는 아무것도 띄우지 않고 콘솔에만 남긴다.
export async function triggerPrecentRevalidate(path?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const res = await fetch('/api/revalidate-precent', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(path ? { 'Content-Type': 'application/json' } : {}),
      },
      body: path ? JSON.stringify({ path }) : undefined,
    });
    if (!res.ok) {
      console.error('[프리센트 갱신 실패]', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('[프리센트 갱신 실패]', err);
  }
}
