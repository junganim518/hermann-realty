const BOT_REGEX =
  /bot|crawler|spider|crawling|slurp|mediapartners|facebookexternalhit|embedly|quora|outbrain|vkshare|whatsapp|kakaotalk|line|telegram|discordbot|preview|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|yeti|naverbot|daumoa|kakaobot|applebot|ahrefsbot|semrushbot|mj12bot|dotbot|screaming frog|headlesschrome|phantomjs|puppeteer|playwright|curl|wget|python-requests|axios|node-fetch/i;

export function isBot(userAgent: string): boolean {
  return BOT_REGEX.test(userAgent);
}
