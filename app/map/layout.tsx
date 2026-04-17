import type { Metadata } from 'next';

export const metadata: Metadata = { title: '지도검색' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
