import { NextResponse } from 'next/server';

export const revalidate = 3600; // 1시간마다 갱신

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  thumbnail: string | null;
  source: string;
}

const RSS_SOURCES = [
  { source: '매일경제', url: 'https://www.mk.co.kr/rss/30000001/' },
  { source: '한국경제', url: 'https://www.hankyung.com/feed/realestate' },
  { source: '뉴스1', url: 'https://www.news1.kr/rss/realestate' },
  { source: '아시아경제', url: 'https://www.asiae.co.kr/rss/realestate.htm' },
  { source: '이데일리', url: 'https://rss.edaily.co.kr/edaily/section/realestate.xml' },
];

const KEYWORDS = ['부동산', '아파트', '분양', '임대', '매매', '전세', '월세', '상가', '오피스', '빌딩', '토지', '재건축', '재개발', '청약'];

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();

const extractTag = (xml: string, tag: string): string => {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`).exec(xml);
  if (cdata) return cdata[1].trim();
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  return plain ? plain[1].trim() : '';
};

const extractEnclosureUrl = (block: string): string | null => {
  const match = /<enclosure[^>]+url="([^"]+)"/.exec(block);
  return match ? match[1] : null;
};

const extractMediaContent = (block: string): string | null => {
  const match = /<media:content[^>]+url="([^"]+)"/.exec(block) || /<media:thumbnail[^>]+url="([^"]+)"/.exec(block);
  return match ? match[1] : null;
};

const extractImgFromDescription = (description: string): string | null => {
  const match = /<img[^>]+src="([^">]+)"/.exec(description);
  return match ? match[1] : null;
};

async function fetchRss(source: string, url: string): Promise<NewsItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`${source} fetch failed: ${res.status}`);

  const xml = await res.text();
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return itemBlocks.map(block => {
    const title = stripHtml(extractTag(block, 'title'));
    const link = stripHtml(extractTag(block, 'link'));
    const rawDescription = extractTag(block, 'description');
    const description = stripHtml(rawDescription).slice(0, 150);
    const pubDate = extractTag(block, 'pubDate');
    const thumbnail = extractEnclosureUrl(block) ?? extractMediaContent(block) ?? extractImgFromDescription(rawDescription);
    return { title, link, description, pubDate, thumbnail, source };
  });
}

export async function GET() {
  try {
    const results = await Promise.allSettled(
      RSS_SOURCES.map(s => fetchRss(s.source, s.url))
    );

    // 성공한 것만 합치기
    const allItems: NewsItem[] = results
      .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // 키워드 필터 (부동산 관련 뉴스만)
    const filtered = allItems.filter(item => {
      const text = `${item.title} ${item.description}`;
      return KEYWORDS.some(kw => text.includes(kw));
    });

    // 제목 기준 중복 제거
    const seen = new Set<string>();
    const unique = filtered.filter(item => {
      const key = item.title.replace(/\s+/g, '').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // pubDate 기준 최신순 정렬
    unique.sort((a, b) => {
      const ta = new Date(a.pubDate).getTime() || 0;
      const tb = new Date(b.pubDate).getTime() || 0;
      return tb - ta;
    });

    return NextResponse.json(
      { items: unique.slice(0, 30) },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message, items: [] }, { status: 200 });
  }
}
