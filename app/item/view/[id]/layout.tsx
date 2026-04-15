import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> | { id: string } }
): Promise<Metadata> {
  const { id } = await params;

  const { data: property } = await supabase
    .from('properties')
    .select('title, transaction_type, property_type, exclusive_area, property_images(image_url, order_index)')
    .eq('property_number', id)
    .single();

  if (!property) {
    return { title: { absolute: '매물 정보 없음 | 헤르만부동산' } };
  }

  const customTitle = (property.title || '').trim();
  const transactionType = property.transaction_type || '';
  const propertyType = property.property_type || '';
  const exclusiveArea = property.exclusive_area || '';

  const images = (property.property_images ?? [])
    .slice()
    .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const firstImage = images[0]?.image_url;

  const headline = customTitle
    ? [customTitle, transactionType].filter(Boolean).join(' ')
    : [propertyType, transactionType].filter(Boolean).join(' ') + ' - 부천시';
  const title = `${headline} - 헤르만부동산`;
  const description = ['부천시', propertyType, transactionType, exclusiveArea ? `${exclusiveArea}㎡` : '']
    .filter(Boolean)
    .join(' ');

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      images: firstImage ? [{ url: firstImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: firstImage ? [firstImage] : undefined,
    },
  };
}

export default function ItemViewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
