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
      </head>
      <body className="font-pretendard">
        <ScrollToTop /><Header />{children}<ConditionalFooter />
        <PageViewTracker />
        <Analytics />
      </body>
    </html>
  );
}
