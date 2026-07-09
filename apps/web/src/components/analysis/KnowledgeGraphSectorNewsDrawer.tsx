'use client';

import { useEffect, useState } from 'react';
import type { SectorRelatedNews } from '@/lib/knowledge-graph/sector-info';
import { faviconUrlFromLink, googleFaviconFallback } from '@/lib/knowledge-graph/sector-favicon';

function SourceFavicon({ url, className }: { url: string; className?: string }) {
  const primary = faviconUrlFromLink(url) || googleFaviconFallback(url);
  const fallback = googleFaviconFallback(url);
  const [src, setSrc] = useState(primary);

  return (
    <img
      src={src}
      alt=""
      width={18}
      height={18}
      className={className ?? 'mt-0.5 block size-[18px] shrink-0 rounded-full object-cover'}
      onError={() => {
        if (fallback && src !== fallback) setSrc(fallback);
      }}
    />
  );
}

export function KnowledgeGraphSectorNewsDrawer({ news }: { news: SectorRelatedNews[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [news]);

  if (!news.length) return null;

  const firstUrl = news.find((item) => item.url)?.url ?? '';

  return (
    <footer
      className={[
        'pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-[background-color,border-color,box-shadow] duration-300',
        open
          ? 'border-t border-border bg-surface-raised/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.35)] backdrop-blur-sm'
          : 'border-t border-transparent bg-transparent',
      ].join(' ')}
    >
      <div className="flex flex-col px-5 pb-4 pt-2">
        <div
          className={[
            'pointer-events-auto transition-[max-height,opacity,margin] duration-300 ease-out',
            open
              ? 'mb-2.5 max-h-[min(18rem,42vh)] overflow-y-auto opacity-100'
              : 'mb-0 max-h-0 overflow-hidden opacity-0',
          ].join(' ')}
          aria-hidden={!open}
        >
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground">
            관련 뉴스
          </p>
          <ul className="m-0 list-none space-y-1 p-0 pb-1">
            {news.map((item) => (
              <li key={item.id}>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 rounded-sm px-1.5 py-1.5 text-foreground no-underline hover:bg-accent/10"
                  >
                    <SourceFavicon url={item.url} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-xs leading-5">{item.title}</span>
                      {(item.publisher || item.date) && (
                        <span className="text-[10px] text-muted-foreground">
                          {[item.publisher, item.date].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                  </a>
                ) : (
                  <div className="px-1.5 py-1.5">
                    <span className="text-xs leading-5">{item.title}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          className="pointer-events-auto relative inline-flex size-8 cursor-pointer items-center justify-center overflow-visible rounded-full border border-border bg-card shadow-sm hover:border-accent"
          aria-expanded={open}
          aria-label="관련 뉴스 보기"
          onClick={() => setOpen((value) => !value)}
        >
          {firstUrl ? (
            <SourceFavicon url={firstUrl} className="block size-[18px] rounded-full object-cover" />
          ) : (
            <span className="text-[10px] font-bold text-muted-foreground">N</span>
          )}
          {news.length > 1 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-card bg-accent px-0.5 text-[9px] font-semibold text-primary-foreground">
              {news.length}
            </span>
          )}
        </button>
      </div>
    </footer>
  );
}
