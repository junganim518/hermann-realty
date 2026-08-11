import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import Header from '@/components/Header';
import ConditionalFooter from '@/components/ConditionalFooter';
import ScrollToTop from '@/components/ScrollToTop';
import PageViewTracker from '@/components/PageViewTracker';

export const metadata: Metadata = {
  metadataBase: new URL('https://hermann-realty.com'),
  title: {
    default: '부천 상가 사무실 전문 부동산 - 헤르만부동산',
    template: '%s | 헤르만부동산',
  },
  description: '부천 상가, 사무실 전문 부동산',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://hermann-realty.com',
    siteName: '헤르만부동산',
    title: '헤르만부동산',
    description: '부천 상가, 사무실 전문 부동산',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '헤르만부동산',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '헤르만부동산',
    description: '부천 상가, 사무실 전문 부동산',
    images: ['/og-image.png'],
  },
  icons: {
    apple: '/icon-192.png',
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  verification: {
    google: 'dUwwvqgiN2aBLfazjOISrtHgU-IbPwWUxj1t3lLNYlQ',
    other: {
      'naver-site-verification': '4bee81f6a3fffa0e9bdce11e6336b4cf5ee7ac49',
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="color-scheme" content="light" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'RealEstateAgent',
              name: '헤르만공인중개사사무소',
              alternateName: '헤르만부동산',
              url: 'https://hermann-realty.com',
              telephone: '010-8680-8151',
              image: 'https://hermann-realty.com/og-image.png',
              address: {
                '@type': 'PostalAddress',
                streetAddress: '신흥로 223 신중동역 랜드마크 푸르지오시티 101동 712호',
                addressLocality: '부천시',
                addressRegion: '경기도',
                addressCountry: 'KR',
              },
              openingHours: ['Mo-Fr 10:00-19:00', 'Sa 10:00-19:00'],
            }),
          }}
        />
      </head>
      <body className="font-pretendard">
        <ScrollToTop /><Header />{children}<ConditionalFooter />
        <PageViewTracker />
        <Analytics />
      </body>
    </html>
  );
}
