import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

// ── 작성자 페르소나 (안정 — 요청마다 동일) ─────────────────────
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

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY 환경변수 미설정' },
        { status: 500 },
      );
    }

    const client = new Anthropic();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        { role: 'user', content: buildPropertyInfo(property) },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    return NextResponse.json({
      text,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cache_read: response.usage.cache_read_input_tokens ?? 0,
        cache_write: response.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (err: any) {
    console.error('[blog-generate]', err);
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: err.message, status: err.status },
        { status: err.status ?? 500 },
      );
    }
    return NextResponse.json(
      { error: err?.message ?? '알 수 없는 오류' },
      { status: 500 },
    );
  }
}
