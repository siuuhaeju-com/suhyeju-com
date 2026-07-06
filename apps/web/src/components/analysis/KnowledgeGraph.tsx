'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { KnowledgeEdge, KnowledgeNode } from '@/lib/types';

/**
 * 산업 연결 지식그래프 (F-12) — 3D 노드 클라우드.
 * 드래그(트랙볼)로 회전해 뒤쪽의 작은 노드를 앞으로 끌어올 수 있고, 버튼으로 확대/축소한다.
 * 외부 3D 라이브러리 없이 구 좌표 → 원근 투영으로 구현 (데모 안정성 우선, DESIGN.md).
 */

const GROUP_STYLE: Record<
  KnowledgeNode['group'],
  { r: number; fill: string; label: string; fontSize: number; shell: number }
> = {
  center: {
    r: 3.4,
    fill: 'var(--blue-bright)',
    label: 'var(--foreground)',
    fontSize: 2.6,
    shell: 0,
  },
  tier1: { r: 2.3, fill: 'var(--tier2)', label: 'var(--foreground)', fontSize: 2.1, shell: 0.5 },
  tier2: { r: 1.7, fill: 'var(--tier3)', label: 'var(--ink-sub)', fontSize: 1.85, shell: 0.8 },
  etc: { r: 1.2, fill: '#55607a', label: 'var(--muted-foreground)', fontSize: 1.7, shell: 1.05 },
};

const LEGEND: Array<{ group: KnowledgeNode['group']; label: string }> = [
  { group: 'center', label: '중심 산업' },
  { group: 'tier1', label: '1차 연관' },
  { group: 'tier2', label: '2차 연관' },
  { group: 'etc', label: '기타 산업' },
];

const GOLDEN = 2.399963229728653;
const PERSPECTIVE = 2.8; // 카메라 거리 — 작을수록 원근 왜곡 큼
const SPREAD = 30; // 화면 확산 반경 (viewBox 단위)
const CX = 50;
const CY = 54;
const IDLE_SPIN_SPEED = 0.05; // 자동 회전 속도(rad/s) — 1회전 약 2분

interface Node3D extends KnowledgeNode {
  px: number; // 3D 원좌표
  py: number;
  pz: number;
}

/** 그룹 셸별 피보나치 구 분포로 결정적 3D 좌표 생성 */
function buildCloud(nodes: KnowledgeNode[]): Node3D[] {
  const byGroup: Record<string, KnowledgeNode[]> = {};
  for (const node of nodes) (byGroup[node.group] ??= []).push(node);

  return nodes.map((node) => {
    const style = GROUP_STYLE[node.group];
    if (node.group === 'center') return { ...node, px: 0, py: 0, pz: 0 };
    const peers = byGroup[node.group];
    const index = peers.indexOf(node);
    const count = peers.length;
    // 피보나치 구: 셸 반경 위에 고르게 분포 + 결정적 반경 지터
    const t = count === 1 ? 0 : 1 - (index / (count - 1)) * 2;
    const radius = style.shell * (0.9 + ((index * 37) % 7) / 30);
    const ring = Math.sqrt(Math.max(0, 1 - t * t));
    const theta = index * GOLDEN;
    return {
      ...node,
      px: Math.cos(theta) * ring * radius,
      py: t * radius * 0.8,
      pz: Math.sin(theta) * ring * radius,
    };
  });
}

/** 요(yaw)·피치(pitch) 회전 + 원근 투영 */
function project(node: Node3D, yaw: number, pitch: number, zoom: number) {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  // yaw (y축 회전)
  const x1 = node.px * cosY + node.pz * sinY;
  const z1 = -node.px * sinY + node.pz * cosY;
  // pitch (x축 회전)
  const y2 = node.py * cosP - z1 * sinP;
  const z2 = node.py * sinP + z1 * cosP;
  const scale = (PERSPECTIVE / (PERSPECTIVE + z2)) * zoom;
  return {
    x: CX + x1 * SPREAD * scale,
    y: CY + y2 * SPREAD * scale,
    scale,
    depth: z2, // 작을수록 앞
  };
}

export function KnowledgeGraph({
  nodes,
  edges,
}: {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [rotation, setRotation] = useState({ yaw: -0.5, pitch: 0.18 });
  const [zoom, setZoom] = useState(1);
  const dragState = useRef<{ isDragging: boolean; lastX: number; lastY: number }>({
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });
  // 유휴 상태에서 가로 방향으로 천천히 자동 회전 — 드래그·hover 중엔 정지,
  // prefers-reduced-motion이면 비활성 (DESIGN.md 모션 규칙)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (hovered != null) return; // hover 중엔 회전 정지 (해제되면 effect 재실행으로 재개)
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!dragState.current.isDragging) {
        setRotation((prev) => ({ ...prev, yaw: prev.yaw + IDLE_SPIN_SPEED * dt }));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hovered]);

  const cloud = useMemo(() => buildCloud(nodes), [nodes]);
  const projected = Object.fromEntries(
    cloud.map((node) => [node.id, { node, ...project(node, rotation.yaw, rotation.pitch, zoom) }]),
  );
  // 뒤(멀리)부터 그려서 앞 노드가 위에 오게
  const drawOrder = [...cloud].sort((a, b) => projected[b.id].depth - projected[a.id].depth);

  const connected = new Set(
    hovered
      ? edges.flatMap((edge) =>
          edge.from === hovered || edge.to === hovered ? [edge.from, edge.to] : [],
        )
      : [],
  );

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    dragState.current = { isDragging: true, lastX: event.clientX, lastY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragState.current.isDragging) return;
    const dx = event.clientX - dragState.current.lastX;
    const dy = event.clientY - dragState.current.lastY;
    dragState.current.lastX = event.clientX;
    dragState.current.lastY = event.clientY;
    setRotation((prev) => ({
      yaw: prev.yaw + dx * 0.008,
      // 상하 뒤집힘 방지로 피치만 제한
      pitch: Math.max(-1.2, Math.min(1.2, prev.pitch + dy * 0.008)),
    }));
  }
  function handlePointerUp() {
    dragState.current.isDragging = false;
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">산업 연결 지식그래프</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            금융시장 {nodes.length}개 산업 3D 네트워크 · 중심 산업 &lsquo;반도체&rsquo; 기준 ·
            드래그하여 회전하면 뒤쪽 산업을 앞으로 가져올 수 있습니다
          </p>
        </div>
        <ul className="flex items-center gap-4 text-xs text-muted-foreground">
          {LEGEND.map(({ group, label }) => (
            <li key={group} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: GROUP_STYLE[group].fill }}
              />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-4">
        {/* 확대/축소 컨트롤 */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="지식그래프 확대"
            onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.2).toFixed(2)))}
          >
            +
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="지식그래프 축소"
            onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))}
          >
            −
          </Button>
        </div>

        <svg
          viewBox="0 0 100 100"
          className="h-[520px] w-full cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="img"
          aria-label="산업 연결 3D 지식그래프 — 드래그로 회전, 중심 산업 반도체와 주변 산업의 연결망"
        >
          {/* 연결선 — 양끝 깊이에 따라 투명도 */}
          {edges.map((edge) => {
            const from = projected[edge.from];
            const to = projected[edge.to];
            const isActive = hovered != null && (edge.from === hovered || edge.to === hovered);
            const depthFade = Math.max(0.05, 0.3 - (from.depth + to.depth) * 0.12);
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={
                  isActive ? 'var(--blue-bright)' : `rgba(255,255,255,${depthFade.toFixed(3)})`
                }
                strokeWidth={(isActive ? 0.4 : 0.16) * from.scale}
              />
            );
          })}

          {/* 노드 — 뒤에서 앞 순서로 렌더 */}
          {drawOrder.map((node) => {
            const style = GROUP_STYLE[node.group];
            const p = projected[node.id];
            const isHovered = hovered === node.id;
            const isActive = isHovered || connected.has(node.id);
            const isDimmed = hovered != null && !isActive;
            // 깊이 기반 표현: 앞(scale↑)일수록 크고 선명
            const r = style.r * p.scale * (isHovered ? 1.35 : 1);
            const nodeOpacity = isDimmed ? 0.25 : Math.min(1, 0.35 + p.scale * 0.6);
            const shouldShowLabel =
              node.group === 'center' || node.group === 'tier1' || p.scale > 0.92 || isActive;
            return (
              <g
                key={node.id}
                opacity={nodeOpacity}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer"
              >
                {node.group === 'center' && (
                  <circle cx={p.x} cy={p.y} r={r * 2.1} fill="var(--primary)" opacity={0.16} />
                )}
                <circle cx={p.x} cy={p.y} r={r} fill={style.fill} />
                {shouldShowLabel && (
                  <text
                    x={p.x}
                    y={p.y - r - 1.1}
                    textAnchor="middle"
                    fontSize={style.fontSize * Math.max(0.75, p.scale)}
                    fontWeight={node.group === 'center' ? 800 : 600}
                    fill={style.label}
                    className="pointer-events-none"
                  >
                    {node.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}
