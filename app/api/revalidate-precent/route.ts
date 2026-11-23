import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAuthUser } from '@/lib/apiAuth';

// 보라매 프리센트 방문자 페이지 한 곳만 갱신한다 — 요청 본문으로 경로를 받지 않음
// (임의 경로 재검증을 막기 위해 의도적으로 경로를 고정).
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  revalidatePath('/properties/boramae-precent');
  return NextResponse.json({ revalidated: true });
}
