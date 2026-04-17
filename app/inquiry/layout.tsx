import type { Metadata } from 'next';

export const metadata: Metadata = { title: '매물 의뢰하기' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
