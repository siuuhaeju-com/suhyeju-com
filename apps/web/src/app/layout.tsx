import type { Metadata } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { Providers } from '@/app/providers';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: '수혜주.com — 뉴스 영향력 분석',
  description: '뉴스 한 건이 시장에 만드는 파장을 추적하세요. AI 뉴스 기반 산업 파급 분석.',
};

// Google Analytics 4 측정 ID (공개값 — 페이지에 그대로 노출되는 식별자)
const GA_ID = 'G-ZD6Y061HW9';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        {/* Google 태그 (gtag.js) — next/script(afterInteractive)로 head 상단에 주입 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
        </Script>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="flex min-h-full flex-col overflow-x-hidden font-sans antialiased">
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
