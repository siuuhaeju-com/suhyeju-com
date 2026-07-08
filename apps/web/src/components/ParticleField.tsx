'use client';

import { useEffect, useRef } from 'react';

/**
 * 메인 페이지 전체 배경의 파티클 네트워크(canvas) — "뉴스가 산업으로 번지는 파장" 연출.
 * 원본 목업의 <canvas> 배경(homeBgRef)을 복원한 것. 마우스 인터랙션 없음(순수 장식, pointer-events 차단).
 * 색은 하드코딩하지 않고 런타임에 CSS 토큰(--tier1 등)을 읽어서 쓴다(DESIGN.md 토큰 원칙).
 *
 * 노드 위치는 시드 시점에 정해지면 움직이지 않는다(드리프트/물리 없음) — 예전엔 노드가 떠다니다
 * 서로를 당기기만 해서 시간이 지날수록 네트워크 전체가 중앙으로 수축하는 문제가 있었는데,
 * 가장 근본적인 해결은 애초에 노드를 움직이지 않는 것이다.
 * 대신 "살아있는 네트워크" 느낌은 각 연결선 위를 별빛처럼 흐르는 빛 점으로 표현한다.
 *
 * 연결은 각 노드→자신보다 먼저 태어난 노드 중 가장 가까운 것을 잇는 고정 그래프
 * (SpreadGraph와 같은 원점→파급 구조). 등장은 처음 INITIAL_COUNT만 보이고 이후
 * SPAWN_INTERVAL_MS마다 하나씩 태어나는데, 그때마다 곧바로 연결선이 이어지는 게 아니라
 * LINE_DRAW_MS 동안 선이 먼저 천천히 그어지고, 다 그어진 뒤에야 새 노드가 나타난다 —
 * "연결된 뒤에 노드가 생긴다"는 순서가 눈에 보이도록 하기 위함.
 *
 * prefers-reduced-motion에서는 다 자란 상태의 정지 프레임 한 장만 그리고(별빛 이동 없이)
 * 애니메이션 루프를 돌리지 않는다.
 *
 * 노드는 두 가지 방식으로 UI와 겹치지 않게 배치한다. 이 컴포넌트 바깥의 마크업은 건드리지
 * 않고, 자신이 속한 컨테이너 안의 텍스트 요소를 스스로 찾아서 피한다.
 * 1) 캔버스의 부모 요소 안에 있는 제목·문단·버튼·링크 등 글자 요소의 영역을 런타임에
 *    측정해서 피해 좌표를 뽑는다(거부 샘플링).
 * 2) y좌표를 위쪽으로 치우치게 뽑아서, 카드가 빽빽한 "인기 뉴스·주요 섹터 현황" 구간보다
 *    비어 있는 히어로 상단에 훨씬 많은 노드가 몰리도록 한다.
 *
 * 처음 INITIAL_COUNT개는 "핵심 노드"로, 무작위 위치가 아니라 히어로 h1 제목 주위를
 * 감싸듯 한꺼번에 나타난다 — 로딩 직후 화면이 휑해 보이는 걸 막기 위함. 이후 나머지는
 * 지금까지처럼 전체 캔버스에서 하나씩 점진적으로 태어난다.
 */
const PARTICLE_COUNT = 46;
const Y_BIAS_POWER = 1.35; // 클수록 위쪽(작은 y)에 더 쏠림 — rand()**power. 너무 크면 위쪽에 뭉쳐 보임
const AVOID_SELECTOR = 'h1, h2, h3, p, a, button, label';
const AVOID_PADDING = 20; // 글자 영역 주변 여유(px)
const MIN_SPACING = 46; // 노드끼리 이 거리보다 가깝게 뭉치지 않도록(고르게 퍼져 보이게)
const AVOID_SAMPLE_ATTEMPTS = 30;
const INITIAL_COUNT = 7; // 최초에 핵심 노드로 곧바로 보이는 노드 수
const INITIAL_STAGGER_MS = 220; // 최초 노드들끼리도 살짝 시차를 두고 등장
const HERO_HALO_MARGIN = 140; // 히어로 제목 테두리에서 핵심 노드가 놓일 바깥쪽 여유(px)
const LINE_DRAW_MS = 750; // 새 연결선이 a→b로 그어지는 데 걸리는 시간(느리게, 눈에 띄게)
const NODE_FADE_MS = 300; // 선이 다 그어진 뒤 노드가 페이드인하는 시간
// 한 노드의 "선 긋기 + 페이드인"이 완전히 끝난 뒤에야 다음 노드가 시작되도록 간격을 맞춘다
// (겹쳐서 여러 선이 동시에 그어지면 사람 눈에는 구분이 안 됨)
const SPAWN_INTERVAL_MS = LINE_DRAW_MS + NODE_FADE_MS;
const PULSE_PERIOD_MS = 2600; // 별빛이 연결선 한쪽 끝에서 반대쪽까지 흐르는 데 걸리는 시간
const COLOR_TOKENS = ['--tier1', '--tier2', '--tier3', '--positive', '--negative'];
// 배지·섹터 카드 등에 쓰는 토큰 원색은 그대로 두고, 캔버스에 그릴 때만 흰색을 섞어 파스텔로 순화
const PASTEL_MIX = 0.55;

type Particle = { x: number; y: number; r: number; o: number; color: string };
type Edge = { a: number; b: number };
type AvoidRect = { left: number; right: number; top: number; bottom: number };

/** hex 색을 흰색과 섞어 파스텔 톤으로 순화(토큰 원본 hex는 건드리지 않고 그릴 때만 변환) */
function toPastel(hex: string, mix: number) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const [r, g, b] = [m[1], m[2], m[3]].map((c) => parseInt(c, 16));
  const blend = (c: number) => Math.round(c + (255 - c) * mix);
  return `rgb(${blend(r)},${blend(g)},${blend(b)})`;
}

/** 결정적 PRNG — 리로드마다 같은 초기 배치로 시작(마운트 시 1회만 사용) */
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 노드별 "연결선이 그어지기 시작하는" 시각(ms) — 처음 INITIAL_COUNT는 살짝만 시차, 이후는 하나씩 */
function computeSpawnDelays(count: number) {
  return Array.from({ length: count }, (_, i) =>
    i < INITIAL_COUNT
      ? i * INITIAL_STAGGER_MS
      : INITIAL_COUNT * INITIAL_STAGGER_MS + (i - INITIAL_COUNT) * SPAWN_INTERVAL_MS,
  );
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const colors = COLOR_TOKENS.map((token) => {
      const hex =
        getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#6ea0ff';
      return toPastel(hex, PASTEL_MIX);
    });
    const rand = mulberry32(20260707);

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let edges: Edge[] = [];
    let spawnDelays: number[] = [];
    let nodeAppearAt: number[] = [];
    let rafId = 0;
    let startTime = 0;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** 캔버스 기준 상대 좌표로 변환한, 글자가 그대로 비치는 UI 영역 목록(같은 컨테이너 안에서만 탐색) */
    function getAvoidRects(): AvoidRect[] {
      const container = canvas!.parentElement ?? document.body;
      const canvasRect = canvas!.getBoundingClientRect();
      return Array.from(container.querySelectorAll(AVOID_SELECTOR)).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left - canvasRect.left - AVOID_PADDING,
          right: r.right - canvasRect.left + AVOID_PADDING,
          top: r.top - canvasRect.top - AVOID_PADDING,
          bottom: r.bottom - canvasRect.top + AVOID_PADDING,
        };
      });
    }

    /** 히어로 h1(제목)을 캔버스 기준 좌표로, 핵심 노드를 감쌀 여유 영역까지 확장해서 반환 */
    function getHeroHaloRect(): AvoidRect | null {
      const container = canvas!.parentElement ?? document.body;
      const heading = container.querySelector('h1');
      if (!heading) return null;
      const canvasRect = canvas!.getBoundingClientRect();
      const r = heading.getBoundingClientRect();
      return {
        left: Math.max(0, r.left - canvasRect.left - HERO_HALO_MARGIN),
        right: Math.min(width, r.right - canvasRect.left + HERO_HALO_MARGIN),
        top: Math.max(0, r.top - canvasRect.top - HERO_HALO_MARGIN),
        bottom: Math.min(height, r.bottom - canvasRect.top + HERO_HALO_MARGIN),
      };
    }

    /**
     * UI 텍스트 영역을 피하면서, 위쪽(히어로)에 살짝 더 쏠리도록 좌표를 뽑는다.
     * 이미 놓인 노드와 너무 가까우면 다시 뽑아서 한쪽에 뭉치지 않고 고르게 퍼지게 한다.
     */
    function samplePosition(avoidRects: AvoidRect[], placed: Particle[]) {
      let x = 0;
      let y = 0;
      for (let attempt = 0; attempt < AVOID_SAMPLE_ATTEMPTS; attempt++) {
        x = rand() * width;
        y = Math.pow(rand(), Y_BIAS_POWER) * height;
        const collides = avoidRects.some(
          (r) => x > r.left && x < r.right && y > r.top && y < r.bottom,
        );
        if (collides) continue;
        const tooClose = placed.some((p) => Math.hypot(p.x - x, p.y - y) < MIN_SPACING);
        if (!tooClose) break;
      }
      return { x, y };
    }

    /** 핵심 노드용: 히어로 제목을 감싸는 테두리 영역 안에서만(단, 글자 자체는 피해서) 좌표를 뽑는다 */
    function sampleAroundHero(haloRect: AvoidRect, avoidRects: AvoidRect[], placed: Particle[]) {
      let x = 0;
      let y = 0;
      for (let attempt = 0; attempt < AVOID_SAMPLE_ATTEMPTS; attempt++) {
        x = haloRect.left + rand() * (haloRect.right - haloRect.left);
        y = haloRect.top + rand() * (haloRect.bottom - haloRect.top);
        const collides = avoidRects.some(
          (r) => x > r.left && x < r.right && y > r.top && y < r.bottom,
        );
        if (collides) continue;
        const tooClose = placed.some((p) => Math.hypot(p.x - x, p.y - y) < MIN_SPACING);
        if (!tooClose) break;
      }
      return { x, y };
    }

    function seedParticles() {
      const avoidRects = getAvoidRects();
      const heroHalo = getHeroHaloRect();
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const { x, y } =
          i < INITIAL_COUNT && heroHalo
            ? sampleAroundHero(heroHalo, avoidRects, particles)
            : samplePosition(avoidRects, particles);
        particles.push({
          x,
          y,
          r: 2.6 + rand() * 2.4,
          o: 0.55 + rand() * 0.35,
          color: colors[Math.floor(rand() * colors.length)],
        });
      }

      // 각 노드를 자신보다 먼저 태어난 노드 중 가장 가까운 것과 연결 — 고정된 트리 구조(위치 불변)
      edges = particles.slice(1).map((p, idx) => {
        const i = idx + 1;
        let nearest = 0;
        let best = Infinity;
        for (let j = 0; j < i; j++) {
          const d = Math.hypot(p.x - particles[j].x, p.y - particles[j].y);
          if (d < best) {
            best = d;
            nearest = j;
          }
        }
        return { a: nearest, b: i };
      });

      spawnDelays = computeSpawnDelays(particles.length);
      // 노드 0(원점)은 연결선 없이 바로 나타나고, 나머지는 자신을 잇는 선이 다 그어진 뒤에 나타난다
      nodeAppearAt = spawnDelays.map((delay, i) => (i === 0 ? delay : delay + LINE_DRAW_MS));
    }

    function drawFrame(elapsed: number, withPulse: boolean) {
      ctx!.clearRect(0, 0, width, height);

      edges.forEach((e, i) => {
        const start = spawnDelays[e.b];
        if (elapsed < start) return;
        const a = particles[e.a];
        const b = particles[e.b];
        const drawT = Math.min((elapsed - start) / LINE_DRAW_MS, 1);
        const tipX = a.x + (b.x - a.x) * drawT;
        const tipY = a.y + (b.y - a.y) * drawT;

        ctx!.strokeStyle = 'rgba(110,160,255,0.18)';
        ctx!.lineWidth = 0.7;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(tipX, tipY);
        ctx!.stroke();

        if (withPulse && drawT >= 1) {
          // 다 이어진 선 위를 흐르는 별빛 — 엣지마다 위상을 다르게 둬서 반짝임이 서로 어긋나게
          const sinceComplete = elapsed - (start + LINE_DRAW_MS);
          const phase = (i * 0.6180339887) % 1;
          const travel = (sinceComplete / PULSE_PERIOD_MS + phase) % 1;
          const glow = Math.sin(travel * Math.PI); // 양 끝에서 0, 중간에서 1
          const px = a.x + (b.x - a.x) * travel;
          const py = a.y + (b.y - a.y) * travel;
          ctx!.beginPath();
          ctx!.fillStyle = `rgba(210,225,255,${0.75 * glow})`;
          ctx!.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx!.fill();
        }
      });

      particles.forEach((p, i) => {
        const appearAt = nodeAppearAt[i];
        if (elapsed < appearAt) return;
        const alpha = Math.min((elapsed - appearAt) / NODE_FADE_MS, 1);
        ctx!.beginPath();
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = p.o * alpha;
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      });
      ctx!.globalAlpha = 1;
    }

    function step(time: number) {
      if (!startTime) startTime = time;
      drawFrame(time - startTime, true);
      rafId = requestAnimationFrame(step);
    }

    resize();
    seedParticles();

    if (reduceMotionQuery.matches) {
      const fullyGrown = nodeAppearAt[nodeAppearAt.length - 1] + NODE_FADE_MS;
      drawFrame(fullyGrown, false);
    } else {
      rafId = requestAnimationFrame(step);
    }

    let resizeTimer = 0;
    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 150);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute top-0 bottom-0 left-1/2 -z-10 w-screen -translate-x-1/2"
    />
  );
}
