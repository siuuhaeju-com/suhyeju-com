/** 등락률 표기 유틸 — 색만으로 의미를 전달하지 않도록 부호·화살표를 항상 병기한다 (DESIGN.md) */

export function formatPct(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

/** 긍정=positive(레드) / 부정=negative(블루) — 한국 시장 관례 */
export function getPctToneClass(n: number): string {
  return n >= 0 ? 'text-positive' : 'text-negative';
}

export function getPctArrow(n: number): string {
  return n >= 0 ? '↗' : '↘';
}

/**
 * ISO 일시 → 'YYYY.MM.DD HH:mm' (로컬 시간).
 * ISO 형식이 아니면(mock의 '어제', '2026.07.05 14:23' 등) 원문을 그대로 돌려준다.
 */
export function formatDateTime(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** ISO 일시 → '방금 전' · '3분 전' · '2시간 전' · '4일 전'. */
export function formatRelativeDateTime(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  return `${Math.floor(diffHour / 24)}일 전`;
}
