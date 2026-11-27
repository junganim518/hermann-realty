import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAuthUser } from '@/lib/apiAuth';

// 보라매 프리센트 방문자 페이지들만 갱신한다 — 임의 경로 재검증을 막기 위해 허용 목록으로 고정.
const ALLOWED_PATHS = ['/properties/boramae-precent', '/properties/boramae-precent-officetel'];
const DEFAULT_PATH = '/properties/boramae-precent';

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  let path: string | undefined;
  try {
    const body = await req.json();
    path = typeof body?.path === 'string' ? body.path : undefined;
  } catch {
    path = undefined; // 본문 없이 호출하는 기존 호출과 호환
  }

  if (!path) {
    revalidatePath(DEFAULT_PATH);
    return NextResponse.json({ revalidated: true, path: DEFAULT_PATH });
  }

  if (!ALLOWED_PATHS.includes(path)) {
    return NextResponse.json({ error: '허용되지 않은 경로입니다.' }, { status: 400 });
  }

  revalidatePath(path);
  return NextResponse.json({ revalidated: true, path });
}
