import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/app/providers';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: '수혜주.com — 뉴스 영향력 분석',
  description: '뉴스 한 건이 시장에 만드는 파장을 추적하세요. AI 뉴스 기반 산업 파급 분석.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="flex min-h-full flex-col font-sans antialiased">
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
