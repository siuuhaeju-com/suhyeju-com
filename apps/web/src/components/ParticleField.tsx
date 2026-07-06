/**
 * 메인 배경의 파티클 네트워크 — "뉴스 한 건이 산업으로 번지는 파장" 연출 (DESIGN.md Overview).
 * 장식 요소이므로 pointer-events 차단 + aria-hidden. 좌표는 결정적(고정 배열).
 */
const DOTS: Array<{ x: number; y: number; r: number; c: string; o: number }> = [
  { x: 6, y: 18, r: 3, c: 'var(--tier1)', o: 0.5 },
  { x: 14, y: 62, r: 4, c: 'var(--positive)', o: 0.35 },
  { x: 9, y: 86, r: 3, c: 'var(--negative)', o: 0.4 },
  { x: 22, y: 38, r: 2, c: 'var(--tier2)', o: 0.45 },
  { x: 30, y: 78, r: 3, c: 'var(--tier3)', o: 0.4 },
  { x: 44, y: 90, r: 2, c: 'var(--tier1)', o: 0.4 },
  { x: 58, y: 12, r: 3, c: 'var(--tier2)', o: 0.4 },
  { x: 68, y: 82, r: 4, c: 'var(--positive)', o: 0.3 },
  { x: 76, y: 30, r: 2, c: 'var(--tier1)', o: 0.5 },
  { x: 86, y: 64, r: 3, c: 'var(--negative)', o: 0.35 },
  { x: 92, y: 20, r: 3, c: 'var(--tier3)', o: 0.4 },
  { x: 95, y: 88, r: 2, c: 'var(--tier2)', o: 0.4 },
];

const LINES: Array<[number, number]> = [
  [0, 3],
  [3, 4],
  [1, 4],
  [4, 5],
  [6, 8],
  [8, 9],
  [7, 9],
  [9, 10],
  [2, 1],
  [5, 7],
];

export function ParticleField() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {LINES.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={DOTS[a].x}
          y1={DOTS[a].y}
          x2={DOTS[b].x}
          y2={DOTS[b].y}
          stroke="rgba(110,160,255,0.08)"
          strokeWidth="0.15"
        />
      ))}
      {DOTS.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r / 10} fill={d.c} opacity={d.o * 0.5} />
      ))}
    </svg>
  );
}
