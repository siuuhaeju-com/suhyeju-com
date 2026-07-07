/** 등락률 표기 유틸 — 색만으로 의미를 전달하지 않도록 부호·화살표를 항상 병기한다 (DESIGN.md) */

export function formatPct(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

/** 긍정=positive(레드) / 부정=negative(그린) — 한국 시장 관례 */
export function getPctToneClass(n: number): string {
  return n >= 0 ? 'text-positive' : 'text-negative';
}

export function getPctArrow(n: number): string {
  return n >= 0 ? '↗' : '↘';
}
