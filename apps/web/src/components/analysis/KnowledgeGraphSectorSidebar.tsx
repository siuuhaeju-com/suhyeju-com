'use client';

import { Badge } from '@/components/ui/badge';
import type { SectorSidebarInfo } from '@/lib/knowledge-graph/sector-info';
import { KnowledgeGraphSectorNewsDrawer } from '@/components/analysis/KnowledgeGraphSectorNewsDrawer';

const MARKET_LABEL: Record<string, string> = {
  KR: '한국',
  US: '미국',
  Global: '글로벌',
};

const SIDEBAR_SHELL =
  'relative h-full min-h-0 border-t border-border bg-surface-raised/40 lg:border-t-0 lg:border-l';

function RelationList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (!items.length) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="space-y-1.5 text-xs text-ink-sub">
      {items.map((item) => (
        <li key={item} className="leading-5">
          {item}
        </li>
      ))}
    </ul>
  );
}

function CompanyLine({
  companies,
  selectedCompanyId,
  onCompanyClick,
}: {
  companies: SectorSidebarInfo['bridgeCompanies'];
  selectedCompanyId?: string | null;
  onCompanyClick: (companyId: string, companyName: string) => void;
}) {
  if (!companies.length) return null;

  return (
    <div className="mt-2 pl-4 -indent-4 text-xs leading-6 text-ink-sub">
      {companies.map((item, index) => {
        const selectionKey = item.companyId || item.companyName;
        const isSelected = Boolean(selectedCompanyId && selectionKey === selectedCompanyId);

        return (
          <span key={`${item.companyId}-${item.companyName}-${index}`}>
            {index > 0 && <span className="text-muted-foreground"> · </span>}
            <button
              type="button"
              onClick={() => onCompanyClick(item.companyId, item.companyName)}
              className={[
                'cursor-pointer border-0 bg-transparent p-0 font-medium underline-offset-2 transition-colors hover:text-accent hover:underline',
                isSelected ? 'text-accent underline' : 'text-foreground',
              ].join(' ')}
            >
              {item.companyName}
            </button>
            {item.newsCount > 0 && (
              <span className="text-muted-foreground"> ({item.newsCount})</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export function KnowledgeGraphSectorSidebar({
  info,
  documentSector,
  selectedCompanyId,
  onCompanyClick,
}: {
  info: SectorSidebarInfo | null;
  documentSector: string;
  selectedCompanyId?: string | null;
  onCompanyClick: (companyId: string, companyName: string) => void;
}) {
  if (!info) {
    return (
      <aside className={SIDEBAR_SHELL}>
        <div className="absolute inset-0 overflow-y-auto p-5">
          <p className="text-sm font-bold text-muted-foreground">섹터 정보</p>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            &lsquo;{documentSector}&rsquo;에 해당하는 섹터를 그래프에서 찾지 못했습니다.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className={SIDEBAR_SHELL}>
      <div className="absolute inset-0 overflow-y-auto overscroll-contain p-5 pb-14">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">섹터 정보</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-foreground">{info.name}</h3>
          {info.market && <Badge tone="neutral">{MARKET_LABEL[info.market] ?? info.market}</Badge>}
          {info.isDocumentSector && <Badge tone="positive">이 분석 핵심</Badge>}
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border border-border bg-card px-2 py-2.5">
            <dt className="text-[10px] text-muted-foreground">연결 기업</dt>
            <dd className="mt-0.5 text-sm font-bold">{info.companyCount}</dd>
          </div>
          <div className="rounded-md border border-border bg-card px-2 py-2.5">
            <dt className="text-[10px] text-muted-foreground">연결 뉴스</dt>
            <dd className="mt-0.5 text-sm font-bold">{info.newsCount}</dd>
          </div>
          <div className="rounded-md border border-border bg-card px-2 py-2.5">
            <dt className="text-[10px] text-muted-foreground">브릿지</dt>
            <dd className="mt-0.5 text-sm font-bold">{info.edgeNodeCount}</dd>
          </div>
        </dl>

        {info.bridgeCompanies.length > 0 && (
          <section className="mt-5">
            <h4 className="text-[13px] font-bold text-muted-foreground">포함 기업</h4>
            <CompanyLine
              companies={info.bridgeCompanies}
              selectedCompanyId={selectedCompanyId}
              onCompanyClick={onCompanyClick}
            />
          </section>
        )}

        {(info.outgoing.length > 0 || info.incoming.length > 0) && (
          <div className="mt-5 space-y-4 pb-1">
            <section>
              <h4 className="text-[13px] font-bold text-muted-foreground">영향을 끼침</h4>
              <div className="mt-2">
                <RelationList items={info.outgoing} emptyText="연결된 대상 없음" />
              </div>
            </section>
            <section>
              <h4 className="text-[13px] font-bold text-muted-foreground">영향을 받음</h4>
              <div className="mt-2">
                <RelationList items={info.incoming} emptyText="연결된 출처 없음" />
              </div>
            </section>
          </div>
        )}
      </div>
      <KnowledgeGraphSectorNewsDrawer news={info.relatedNews} />
    </aside>
  );
}
