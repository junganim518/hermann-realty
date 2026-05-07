import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

const BASE_URL = 'https://hermann-realty.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/properties`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/map`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/news`, lastModified: now, changeFrequency: 'daily', priority: 0.5 },
  ];

  const { data: properties } = await supabase
    .from('properties')
    .select('property_number, updated_at')
    .eq('status', '거래중'); // sitemap엔 거래중 매물만 노출

  const dynamicEntries: MetadataRoute.Sitemap = (properties ?? []).map((p: any) => ({
    url: `${BASE_URL}/item/view/${p.property_number}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...dynamicEntries];
}
