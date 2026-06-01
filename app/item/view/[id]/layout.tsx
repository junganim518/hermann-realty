import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';

const PROPERTY_SELECT =
  'id, property_number, title, address, building_name, unit_number, transaction_type, ' +
  'deposit, monthly_rent, maintenance_fee, premium, supply_area, exclusive_area, ' +
  'current_floor, total_floor, description, property_type, latitude, longitude, created_at, ' +
  'status, is_sold';

const isIndexable = (p: Record<string, any>) =>
  p.status === '거래중' && !p.is_sold;

// XSS 방지: JSON-LD 내 < 를 유니코드 이스케이프
function safeJsonLd(obj: object): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

async function fetchProperty(propertyNumber: string) {
  const { data: raw, error } = await supabase
    .from('properties')
    .select(PROPERTY_SELECT)
    .eq('property_number', propertyNumber)
    .is('deleted_at', null)
    .single();
  if (error) console.error('[JSON-LD] property fetch error:', error.message);
  return (raw as Record<string, any>) ?? null;
}

async function fetchImages(propertyId: string, limit = 5) {
  const { data } = await supabase
    .from('property_images')
    .select('image_url, order_index')
    .eq('property_id', propertyId)
    .order('order_index', { ascending: true })
    .limit(limit);
  return (data ?? []) as { image_url: string }[];
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> | { id: string } }
): Promise<Metadata> {
  const { id } = await Promise.resolve(params);
  const property = await fetchProperty(id);

  if (!property) {
    return { title: { absolute: '매물 정보 없음 | 헤르만부동산' } };
  }

  const noIndex = !isIndexable(property);

  const imgs = await fetchImages(property.id, 1);

  const propertyNumber = property.property_number || '';
  const customTitle = (property.title || '').trim();
  const transactionType = property.transaction_type || '';
  const propertyType = property.property_type || '';
  const exclusiveArea = property.exclusive_area || '';

  const firstImage = (imgs[0]?.image_url || '').trim() || 'https://hermann-realty.com/og-image.png';
  const headline = customTitle || [propertyType, transactionType].filter(Boolean).join(' ');
  const title = `${[propertyNumber, headline].filter(Boolean).join(' ')} - 헤르만부동산`;
  const description = ['부천시', propertyType, transactionType, exclusiveArea ? `${exclusiveArea}㎡` : '']
    .filter(Boolean).join(' ');

  return {
    title: { absolute: title },
    description,
    ...(noIndex && { robots: { index: false, follow: false } }),
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
  const { id } = await Promise.resolve(params);

  const property = await fetchProperty(id);
  console.log('[JSON-LD] layout id:', id, '/ property:', property?.property_number ?? 'null');

  let jsonLdStr: string | null = null;

  if (property && isIndexable(property)) {
    const imgs = await fetchImages(property.id, 5);

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

    const streetParts = [property.address, property.building_name, property.unit_number].filter(Boolean);
    if (streetParts.length > 0) {
      ld.address = {
        '@type': 'PostalAddress',
        streetAddress: streetParts.join(' '),
        addressLocality: '부천시',
        addressRegion: '경기도',
        addressCountry: 'KR',
      };
    }

    const lat = parseFloat(String(property.latitude ?? ''));
    const lng = parseFloat(String(property.longitude ?? ''));
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      ld.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
    }

    const area = parseFloat(String(property.exclusive_area ?? ''));
    if (!isNaN(area) && area > 0) {
      ld.floorSize = { '@type': 'QuantitativeValue', value: area, unitCode: 'MTK' };
    }

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

    jsonLdStr = safeJsonLd(ld);
    console.log('[JSON-LD] built, length:', jsonLdStr.length);
  }

  return (
    <>
      {jsonLdStr && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdStr }}
        />
      )}
      {children}
    </>
  );
}
