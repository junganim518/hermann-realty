import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { PUBLIC_PROPERTY_COLUMNS } from '@/lib/publicPropertyFields';
import PropertyDetailClient, { type Property } from './PropertyDetailClient';

// 매물 상태(거래중→거래완료/보류 등)가 바뀌면 방문자에게 즉시 반영되어야 하므로
// 이 라우트는 항상 요청마다 새로 렌더링한다 — 캐시된 옛 상세 정보가 남지 않게 함.
export const dynamic = 'force-dynamic';

// Next.js의 fetch Data Cache에 걸리지 않도록, 이 서버 조회에만 쓰는 전용 클라이언트를 만든다
// (global fetch를 cache: 'no-store'로 감싸서 넘김 — lib/supabase.ts의 공용 클라이언트는 건드리지 않음).
const supabaseNoStore = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: (url, options) => fetch(url, { ...(options ?? {}), cache: 'no-store' }) } }
);

async function fetchInitialProperty(propertyNumber: string): Promise<
  { notFound: true } | { notFound: false; initialProperty: Property | null }
> {
  // 0) 최소 컬럼(상태만)으로 먼저 확인 — 가격/주소/설명 등 민감 정보는 아직 조회하지 않음
  const { data: statusRow } = (await supabaseNoStore
    .from('public_properties')
    .select('id, property_number, status, is_sold')
    .eq('property_number', propertyNumber)
    .single()) as { data: any };

  if (!statusRow) return { notFound: true };

  const pendingStatus = statusRow.status === '보류' || statusRow.status === '공동중개매물';
  if (pendingStatus) {
    // 보류·공동중개매물은 서버가 상세 정보를 읽지 않는다 — 비관리자에게 가격/주소/설명이
    // 서버 HTML에 절대 포함되지 않도록, 클라이언트가 관리자 여부를 확인한 뒤 직접 조회하게 둔다
    // (app/item/view/[id]/PropertyDetailClient.tsx의 기존 흐름).
    return { notFound: false, initialProperty: null };
  }

  // 1) 매물 전체 조회 (거래중·거래완료) — 임대인/임차인 연락처·내부메모는 제외
  const { data } = (await supabaseNoStore
    .from('public_properties')
    .select(PUBLIC_PROPERTY_COLUMNS)
    .eq('property_number', propertyNumber)
    .single()) as { data: any };

  if (!data) return { notFound: true };

  const { data: imgs } = await supabaseNoStore
    .from('property_images')
    .select('*')
    .eq('property_id', data.id)
    .order('order_index', { ascending: true });

  data.property_images = imgs ?? [];

  return { notFound: false, initialProperty: data as Property };
}

export default async function PropertyDetailPage(
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(params);
  const result = await fetchInitialProperty(id);

  if (result.notFound) notFound();

  return <PropertyDetailClient initialProperty={result.initialProperty} />;
}
