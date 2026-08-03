'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

import '@/lib/knowledge-graph/embed.css';
import {
  getSectorSidebarFromPool,
  type SectorSidebarInfo,
} from '@/lib/knowledge-graph/sector-info';

type KnowledgeGraphRuntime = {
  destroy: () => void;
  resize: () => void;
  highlightCompany: (companyId?: string, companyName?: string) => boolean;
};

export type KnowledgeGraphCanvasHandle = {
  highlightCompany: (companyId: string, companyName?: string) => void;
};

type KnowledgeGraphCanvasProps = {
  className?: string;
  nodeCount?: number;
  highlightSector?: string;
  mode?: 'full' | 'analysis';
  onSectorInfoChange?: (info: SectorSidebarInfo | null) => void;
};

/**
 * knowledge-graph 프로젝트 원본 렌더러(embed.mjs)를 React에 마운트.
 */
export const KnowledgeGraphCanvas = forwardRef<
  KnowledgeGraphCanvasHandle,
  KnowledgeGraphCanvasProps
>(function KnowledgeGraphCanvas(
  { className, nodeCount, highlightSector, mode = 'full', onSectorInfoChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<KnowledgeGraphRuntime | null>(null);
  const onSectorInfoChangeRef = useRef(onSectorInfoChange);

  onSectorInfoChangeRef.current = onSectorInfoChange;

  const initialPoolInfo = useMemo(
    () => (highlightSector ? getSectorSidebarFromPool(highlightSector, highlightSector) : null),
    [highlightSector],
  );

  useImperativeHandle(
    ref,
    () => ({
      highlightCompany(companyId, companyName) {
        runtimeRef.current?.highlightCompany(companyId, companyName);
      },
    }),
    [],
  );

  useEffect(() => {
    if (initialPoolInfo) {
      onSectorInfoChangeRef.current?.(initialPoolInfo);
    }
  }, [initialPoolInfo]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    void (async () => {
      const { mountKnowledgeGraph } = await import('@/lib/knowledge-graph/embed.mjs');
      if (cancelled || !containerRef.current) return;

      runtimeRef.current = mountKnowledgeGraph(containerRef.current, {
        versionId: 3,
        themeId: 'midnight',
        nodeCount,
        highlightSector,
        mode,
        onSectorFocus: (info) => {
          onSectorInfoChangeRef.current?.(info);
        },
      });
    })();

    return () => {
      cancelled = true;
      runtimeRef.current?.destroy();
      runtimeRef.current = null;
    };
  }, [nodeCount, highlightSector, mode]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="img"
      aria-label="산업 연결 지식그래프 — 드래그로 노드 이동, 스크롤로 확대·축소"
    />
  );
});
