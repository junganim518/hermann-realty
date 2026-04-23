import { NextResponse } from 'next/server';

export const revalidate = 21600; // 6시간마다 갱신

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
  { source: '아시아경제', url: 'https://www.asiae.co.kr/rss/realestate.htm' },
  { source: '이데일리', url: 'https://rss.edaily.co.kr/edaily/section/realestate.xml' },
  { source: '머니투데이', url: 'https://rss.mt.co.kr/mt_news.xml' },
  { source: '연합뉴스', url: 'https://www.yna.co.kr/rss/economy.xml' },
  { source: '동아일보', url: 'https://rss.donga.com/economy.xml' },
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
  const start = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 21600 },
    });
  } catch (err: any) {
    console.error(`[RSS] ❌ ${source} (${url}) — fetch 실패:`, err?.message ?? err);
    throw err;
  }
  if (!res.ok) {
    console.warn(`[RSS] ❌ ${source} (${url}) — HTTP ${res.status}`);
    throw new Error(`${source} fetch failed: ${res.status}`);
  }

  const xml = await res.text();
  const contentType = res.headers.get('content-type') ?? '';
  const looksLikeXml = /^<\?xml|^<rss|^<feed/i.test(xml.trimStart().slice(0, 50));
  const itemBlocks = xml.match(/<item[^>]*>[\s\S]*?<\/item>/g) ?? [];
  const elapsed = Date.now() - start;

  if (!looksLikeXml) {
    console.warn(`[RSS] ⚠️ ${source} — XML이 아닌 응답 (content-type=${contentType}, ${elapsed}ms, ${xml.length}B)`);
  }

  const items = itemBlocks.map(block => {
    const title = stripHtml(extractTag(block, 'title'));
    const link = stripHtml(extractTag(block, 'link'));
    const rawDescription = extractTag(block, 'description');
    const description = stripHtml(rawDescription).slice(0, 150);
    const pubDate = extractTag(block, 'pubDate');
    const thumbnail = extractEnclosureUrl(block) ?? extractMediaContent(block) ?? extractImgFromDescription(rawDescription);
    return { title, link, description, pubDate, thumbnail, source };
  });

  const sampleTitle = items[0]?.title?.slice(0, 40) ?? '-';
  const icon = items.length > 0 ? '✅' : '⚠️';
  console.log(`[RSS] ${icon} ${source}: ${items.length}건 (${elapsed}ms, ${xml.length}B) | 첫 기사: "${sampleTitle}"`);

  return items;
}

export async function GET() {
  try {
    console.log(`[RSS] ━━━ RSS 수집 시작 (${RSS_SOURCES.length}개 소스) ━━━`);
    const results = await Promise.allSettled(
      RSS_SOURCES.map(s => fetchRss(s.source, s.url))
    );

    // 소스별 집계 로그
    let totalFetched = 0;
    results.forEach((r, i) => {
      const source = RSS_SOURCES[i].source;
      if (r.status === 'fulfilled') {
        totalFetched += r.value.length;
      } else {
        console.error(`[RSS] ❌ ${source}: 실패 — ${r.reason?.message ?? r.reason}`);
      }
    });
    console.log(`[RSS] ━━━ 수집 완료: 총 ${totalFetched}건 ━━━`);

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
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message, items: [] }, { status: 200 });
  }
}
