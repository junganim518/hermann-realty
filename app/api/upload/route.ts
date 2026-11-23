import { NextRequest, NextResponse } from 'next/server';
import { uploadToR2 } from '@/lib/r2';
import { applyWatermark } from '@/lib/watermark';
import { v4 as uuidv4 } from 'uuid';
import { getAuthUser } from '@/lib/apiAuth';

// 워터마크를 자동 적용할 용도(folder) 목록 — 매물 사진 / 프리센트 호실 사진.
// 담당자 프로필, 배너, 로고, 뉴스 등 다른 용도는 이 목록에 없으면 그대로 원본 업로드된다.
const WATERMARK_FOLDER_PREFIXES = ['properties', 'precent/units/'];

function shouldWatermark(folder: string): boolean {
  return WATERMARK_FOLDER_PREFIXES.some(prefix => folder === prefix || folder.startsWith(prefix));
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = (formData.get('folder') as string) || 'properties';

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    let url: string;
    let path: string;

    if (shouldWatermark(folder)) {
      const original = Buffer.from(await file.arrayBuffer());
      const watermarked = await applyWatermark(original);
      path = `${folder}/${uuidv4()}.webp`;
      url = await uploadToR2(watermarked, path, 'image/webp');
    } else {
      const ext = file.name.split('.').pop() || 'jpg';
      path = `${folder}/${uuidv4()}.${ext}`;
      url = await uploadToR2(file, path);
    }

    return NextResponse.json({ url, path });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
