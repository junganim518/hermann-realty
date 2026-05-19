import type { Metadata } from 'next';
import { cache } from 'react';
import { supabase } from '@/lib/supabase';

// XSS 방지: JSON-LD 내 < 를 유니코드 이스케이프
function safeJsonLd(obj: object): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

// generateMetadata와 레이아웃 컴포넌트 간 Supabase 요청 중복 제거
const fetchPageData = cache(async (id: string) => {
  const { data: raw } = await supabase
    .from('properties')
    // eslint-disable-next-line max-len
    .select('id, property_number, title, address, building_name, dong_ho, transaction_type, deposit, monthly_rent, maintenance_fee, premium, supply_area, exclusive_area, current_floor, total_floor, description, property_type, latitude, longitude, created_at')
    .eq('property_number', id)
    .single();
  const property = raw as Record<string, any> | null;

  if (!property) return { property: null, imgs: [] as { image_url: string }[] };

  const { data: imgs } = await supabase
    .from('property_images')
    .select('image_url, order_index')
    .eq('property_id', property.id)
    .order('order_index', { ascending: true })
    .limit(5);

  return { property, imgs: (imgs ?? []) as { image_url: string }[] };
});

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> | { id: string } }
): Promise<Metadata> {
  const { id } = await params;
  const { property, imgs } = await fetchPageData(id);

  if (!property) {
    return { title: { absolute: '매물 정보 없음 | 헤르만부동산' } };
  }

  const propertyNumber = property.property_number || '';
  const customTitle = (property.title || '').trim();
  const transactionType = property.transaction_type || '';
  const propertyType = property.property_type || '';
  const exclusiveArea = property.exclusive_area || '';

  const firstImage = (imgs[0]?.image_url || '').trim() || 'https://hermann-realty.com/og-image.png';

  const headline = customTitle || [propertyType, transactionType].filter(Boolean).join(' ');
  const title = `${[propertyNumber, headline].filter(Boolean).join(' ')} - 헤르만부동산`;
  const description = ['부천시', propertyType, transactionType, exclusiveArea ? `${exclusiveArea}㎡` : '']
    .filter(Boolean)
    .join(' ');

  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, images: [{ url: firstImage }] },
    twitter: { card: 'summary_large_image', title, description, images: [firstImage] },
  };
}

export default async function ItemViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = await params;
  const { property, imgs } = await fetchPageData(id);

  let jsonLd: object | null = null;

  if (property) {
    const customTitle = (property.title || '').trim();
    const headline = customTitle || [property.property_type, property.transaction_type].filter(Boolean).join(' ');
    const name = [property.property_number, headline].filter(Boolean).join(' ');
    const autoDesc = ['부천시', property.property_type, property.transaction_type,
      property.exclusive_area ? `${property.exclusive_area}㎡` : ''].filter(Boolean).join(' ');
    const description = (property.description || '').trim() || autoDesc;
    const images = imgs.map(i => i.image_url).filter(Boolean);

    const ld: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      name,
      description,
      url: `https://hermann-realty.com/item/view/${property.property_number}`,
    };

    if (images.length > 0) ld.image = images;
    if (property.created_at) ld.datePosted = property.created_at;

    // PostalAddress
    const streetParts = [property.address, property.building_name, property.dong_ho].filter(Boolean);
    if (streetParts.length > 0) {
      ld.address = {
        '@type': 'PostalAddress',
        streetAddress: streetParts.join(' '),
        addressLocality: '부천시',
        addressRegion: '경기도',
        addressCountry: 'KR',
      };
    }

    // GeoCoordinates (좌표 있을 때만)
    const lat = parseFloat(String(property.latitude ?? ''));
    const lng = parseFloat(String(property.longitude ?? ''));
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      ld.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
    }

    // floorSize — 전용면적 (㎡)
    const area = parseFloat(String(property.exclusive_area ?? ''));
    if (!isNaN(area) && area > 0) {
      ld.floorSize = { '@type': 'QuantitativeValue', value: area, unitCode: 'MTK' };
    }

    // Offer — 거래유형별 가격
    const tx = property.transaction_type;
    if (tx === '월세' && property.monthly_rent) {
      const priceDesc = [
        property.deposit ? `보증금 ${property.deposit}만원` : '',
        `월세 ${property.monthly_rent}만원`,
      ].filter(Boolean).join(' / ');
      ld.offers = { '@type': 'Offer', price: property.monthly_rent, priceCurrency: 'KRW', description: priceDesc };
    } else if (tx === '전세' && property.deposit) {
      ld.offers = { '@type': 'Offer', price: property.deposit, priceCurrency: 'KRW', description: `보증금 ${property.deposit}만원` };
    } else if (tx === '매매' && property.deposit) {
      ld.offers = { '@type': 'Offer', price: property.deposit, priceCurrency: 'KRW' };
    }

    jsonLd = ld;
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
