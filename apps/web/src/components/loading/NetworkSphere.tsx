import { formatPct, getPctArrow, getPctToneClass } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SectorChange } from '@/lib/types';

/**
 * 로딩 화면 좌측의 네트워크 구체 — "다양한 섹터에서 주요 섹터를 추출·분석 중" 연출 (PAGE-2 · #31).
 * 피보나치 구 배치(결정적 계산)로 점·연결선을 그린다. 장식 요소: aria-hidden.
 * 주위를 떠다니는 칩은 메인 화면과 같은 실제 GICS 섹터 등락률(F-03b 데이터)을 보여준다.
 */
const COUNT = 56;
const GOLDEN = 2.399963229728653;

interface SphereDot {
  x: number;
  y: number;
  depth: number; // 0(뒤) ~ 1(앞)
}

const DOTS: SphereDot[] = Array.from({ length: COUNT }, (_, i) => {
  const y = 1 - (i / (COUNT - 1)) * 2;
  const radius = Math.sqrt(1 - y * y);
  const theta = i * GOLDEN;
  const x = Math.cos(theta) * radius;
  const z = Math.sin(theta) * radius;
  // 약간 기울여 투영
  const tilt = 0.35;
  const py = y * Math.cos(tilt) - z * Math.sin(tilt) * 0.4;
  return { x: 50 + x * 40, y: 50 + py * 40, depth: (z + 1) / 2 };
});

/** 나선상 이웃 + 모듈러 코드로 만드는 연결선 (결정적) */
const LINKS: Array<[number, number]> = [
  ...Array.from({ length: COUNT - 1 }, (_, i) => [i, i + 1] as [number, number]),
  ...Array.from({ length: 18 }, (_, i) => [i * 3, (i * 3 + 13) % COUNT] as [number, number]),
];

// 구체 주위 칩 배치(% 좌표) — 구체와 같은 박스(이 컴포넌트의 루트 div) 기준.
// 중심(50, 50)에서 반지름 44%로 7등분한 원 위 좌표라 항상 좌우 대칭으로 구체를 감싼다.
const CHIP_ORBIT_COUNT = 7;
const CHIP_ORBIT_RADIUS = 44;
const CHIP_POSITIONS: Array<{ x: number; y: number }> = Array.from(
  { length: CHIP_ORBIT_COUNT },
  (_, i) => {
    const theta = (i / CHIP_ORBIT_COUNT) * 2 * Math.PI;
    return {
      x: 50 + CHIP_ORBIT_RADIUS * Math.sin(theta),
      y: 50 - CHIP_ORBIT_RADIUS * Math.cos(theta),
    };
  },
);

export function NetworkSphere({ sectors = [] }: { sectors?: SectorChange[] }) {
  const chips = sectors.slice(0, CHIP_POSITIONS.length);

  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[420px]">
      {/* 중심 글로우 — 라이브 분석 연출 (허용 지점) */}
      <div className="absolute inset-[12%] rounded-full bg-primary/15 blur-3xl animate-glow-pulse" />
      {/* 회전은 아주 느리게 — 분석 배경 연출이지 시선을 뺏는 요소가 아니다.
          주의: .animate-spin-slow(무레이어 CSS)가 Tailwind 유틸리티보다 우선이라
          duration은 인라인 스타일로 지정해야 실제 적용된다. */}
      <svg
        viewBox="0 0 100 100"
        className="relative h-full w-full animate-spin-slow"
        style={{ animationDuration: '192s' }}
      >
        {LINKS.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={DOTS[a].x}
            y1={DOTS[a].y}
            x2={DOTS[b].x}
            y2={DOTS[b].y}
            stroke="var(--tier1)"
            strokeWidth="0.18"
            opacity={0.1 + Math.min(DOTS[a].depth, DOTS[b].depth) * 0.25}
          />
        ))}
        {DOTS.map((dot, i) => (
          <circle
            key={i}
            cx={dot.x}
            cy={dot.y}
            r={0.5 + dot.depth * 0.9}
            fill={dot.depth > 0.55 ? 'var(--blue-bright)' : 'var(--primary)'}
            opacity={0.25 + dot.depth * 0.65}
          />
        ))}
      </svg>

      {/* 주요 섹터 칩 — 메인 화면(SectorOverview)과 같은 등락률 데이터 */}
      {chips.map((sector, i) => (
        <span
          key={sector.name}
          className="animate-float-y absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full border border-border bg-popover px-3 py-1.5 text-[13px] font-bold whitespace-nowrap shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
          style={{
            left: `${CHIP_POSITIONS[i].x}%`,
            top: `${CHIP_POSITIONS[i].y}%`,
            animationDelay: `${i * 0.4}s`,
          }}
        >
          {sector.name}
          <span className={cn(getPctToneClass(sector.changePct))}>
            {getPctArrow(sector.changePct)} {formatPct(sector.changePct)}
          </span>
        </span>
      ))}
    </div>
  );
}
