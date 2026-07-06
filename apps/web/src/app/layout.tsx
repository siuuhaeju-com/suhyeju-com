import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: '수혜주.com',
  description: '뉴스 기반 산업 파급 분석 서비스',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="flex min-h-full flex-col font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
