import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import OfficetelLanding, { parseFaq, type OfficetelPageData, type OfficetelPhoto } from './OfficetelLanding';

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
  // select('*') — complex_text/items_text/faq_text 컬럼이 아직 없는(SQL 미실행) 상태에서도
  // 에러 없이 동작해야 하므로 명시적 컬럼 목록 대신 와일드카드로 읽는다. 뷰 자체가 이미
  // published=true인 안전한 컬럼만 노출하도록 구성되어 있어 와일드카드라도 노출 범위는 그대로다.
  const { data } = await supabaseNoStore
    .from('precent_officetel_page_public')
    .select('*')
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
  const faqItems = parseFaq(pageRow.faq_text); // 화면과 같은 파서를 써서 JSON-LD 텍스트가 항상 일치하게 함

  return (
    <>
      {faqItems.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqItems.map(f => ({
                '@type': 'Question',
                name: f.question,
                acceptedAnswer: { '@type': 'Answer', text: f.answer },
              })),
            }),
          }}
        />
      )}
      <OfficetelLanding data={pageRow} photos={photos} />
    </>
  );
}
