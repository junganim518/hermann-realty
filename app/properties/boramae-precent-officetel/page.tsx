import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import OfficetelLanding, { type OfficetelPageData, type OfficetelPhoto } from './OfficetelLanding';

// 매물 상세페이지(app/item/view/[id])와 같은 이유 — 게시 스위치를 끄면 즉시 내려가야 하고,
// CSR로만 그려서 서버 HTML이 비어 Soft 404로 판정되는 문제를 피하기 위해 서버에서 먼저 데이터를 읽는다.
export const dynamic = 'force-dynamic';

const supabaseNoStore = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: (url, options) => fetch(url, { ...(options ?? {}), cache: 'no-store' }) } }
);

const PAGE_URL = 'https://hermann-realty.com/properties/boramae-precent-officetel';
const PAGE_TITLE = '동작 보라매역 프리센트 오피스텔 특별분양 | 헤르만부동산';

async function fetchPublicPage() {
  const { data } = await supabaseNoStore
    .from('precent_officetel_page_public')
    .select('title, summary_text, unit_type, price_text, area_text, rooms_text, move_in_text, options_text, parking_text, maintenance_fee_text, approval_date_text, guarantee_title, guarantee_detail, location_text, building_text, target_text, intro_text')
    .maybeSingle();
  return data as OfficetelPageData | null;
}

async function fetchPublicPhotos(): Promise<OfficetelPhoto[]> {
  const { data } = await supabaseNoStore
    .from('precent_officetel_photos_public')
    .select('id, url, sort_order')
    .order('sort_order');
  return (data ?? []) as OfficetelPhoto[];
}

export async function generateMetadata(): Promise<Metadata> {
  const pageRow = await fetchPublicPage();
  const description = pageRow?.summary_text || pageRow?.title || PAGE_TITLE;
  const photos = pageRow ? await fetchPublicPhotos() : [];
  const ogImage = photos[0]?.url;

  return {
    title: { absolute: PAGE_TITLE },
    description,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      siteName: '헤르만부동산',
      title: PAGE_TITLE,
      description,
      url: PAGE_URL,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: PAGE_TITLE,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function BoramaeOfficetelPage() {
  const pageRow = await fetchPublicPage();
  if (!pageRow) notFound(); // 게시 전(published=false)이면 뷰에 행이 없음 — 실제 404 반환

  const photos = await fetchPublicPhotos();

  return <OfficetelLanding data={pageRow} photos={photos} />;
}
