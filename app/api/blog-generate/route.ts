import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// ── 작성자 페르소나 + 작성 규칙 ────────────────────────────────
const SYSTEM_PROMPT = `당신은 부동산 전문 블로그 작가입니다.
아래 매물 정보를 바탕으로 네이버 블로그에 올릴 정성스러운 블로그 글을 작성해주세요.

작성 규칙:
- 제목: SEO 키워드 포함 (신중동역, 부천, 랜드마크 등)
- 도입부: 감성적이고 흥미로운 스토리텔링
- 위치/교통 장점 강조
- 매물 상세 정보 자연스럽게 녹여내기
- 이런 분께 추천 섹션
- 마무리: 헤르만부동산 연락처(010-8680-8151) 포함
- 이모지 적절히 사용
- 전체 길이 1000자 이상
- 구어체로 친근하게`;

function toPyeong(sqm: unknown): string {
  const n = typeof sqm === 'string' ? parseFloat(sqm) : (sqm as number);
  if (!n || isNaN(n)) return '-';
  return (n / 3.3058).toFixed(1);
}

function buildPropertyInfo(p: any): string {
  return `매물 정보:
- 매물번호: ${p.property_number ?? ''}
- 매물종류: ${p.property_type ?? ''}
- 거래유형: ${p.transaction_type ?? ''}
- 주소: ${p.address ?? ''}
- 보증금: ${p.deposit ?? 0}만원
- 월세: ${p.monthly_rent ?? 0}만원
- 전용면적: ${p.exclusive_area ?? '-'}㎡ (${toPyeong(p.exclusive_area)}평)
- 공급면적: ${p.supply_area ?? '-'}㎡ (${toPyeong(p.supply_area)}평)
- 층수: ${p.current_floor ?? '-'}${p.total_floor ? ` / ${p.total_floor}` : ''}
- 권리금: ${p.premium ? `${p.premium}만원` : '무권리'}
- 관리비: ${p.maintenance_fee ?? 0}만원
- 방향: ${p.direction ?? '-'}
- 매물 제목: ${p.title ?? ''}
- 매물 설명: ${p.description ?? ''}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const property = body?.property;
    if (!property) {
      return NextResponse.json({ error: 'property 필드 필요' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY 환경변수 미설정' },
        { status: 500 },
      );
    }

    // 시스템 프롬프트 + 매물정보를 하나의 텍스트로 결합
    const fullPrompt = `${SYSTEM_PROMPT}\n\n${buildPropertyInfo(property)}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: fullPrompt }] },
        ],
      }),
    });

    const data = await res.json();
    console.log('[blog-generate] Gemini 응답 상태:', res.status);

    if (!res.ok) {
      console.error('[blog-generate] Gemini 오류:', data);
      return NextResponse.json(
        { error: data?.error?.message ?? `HTTP ${res.status}` },
        { status: res.status },
      );
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!text) {
      console.warn('[blog-generate] 텍스트 없음. 전체 응답:', JSON.stringify(data));
      return NextResponse.json(
        { error: '응답에 텍스트가 없습니다', raw: data },
        { status: 500 },
      );
    }

    return NextResponse.json({
      text,
      usage: data?.usageMetadata ?? null,
    });
  } catch (err: any) {
    console.error('[blog-generate] 예외:', err);
    return NextResponse.json(
      { error: err?.message ?? '알 수 없는 오류' },
      { status: 500 },
    );
  }
}
