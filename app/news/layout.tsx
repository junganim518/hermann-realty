import type { Metadata } from 'next';

export const metadata: Metadata = { title: '부동산 소식' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
