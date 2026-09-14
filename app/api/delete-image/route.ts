import { NextRequest, NextResponse } from 'next/server';
import { deleteFromR2 } from '@/lib/r2';
import { getAuthUser } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const { path } = await req.json();
    await deleteFromR2(path);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
