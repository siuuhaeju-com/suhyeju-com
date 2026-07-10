/**
 * 영향도(SpreadNode.impact) 표현 파생 — FE 계산 (F-16).
 * impact: 부호=방향(+긍정/−부정), |값|=강도(1~100). 시세(등락률)가 아니라 GPT 분석값이다.
 */

export type ImpactStrength = 'weak' | 'medium' | 'strong';

/**
 * |impact| → 3단계. 경계는 GPT 프롬프트의 tier별 가이드와 일치
 * (tier1 = 60~100 · tier2 = 30~60 · tier3 = 10~30).
 */
export function getImpactStrength(impact: number): ImpactStrength {
  const size = Math.abs(impact);
  if (size >= 60) return 'strong';
  if (size >= 30) return 'medium';
  return 'weak';
}

export const IMPACT_STRENGTH_LABEL: Record<ImpactStrength, string> = {
  strong: '강한 영향을 받아요',
  medium: '보통 영향을 받아요',
  weak: '약한 영향을 받아요',
};

/**
 * 강도 → 방향색(positive/negative)에 섞을 잉크(--foreground) 비율(%).
 * 채도를 낮춰 강/중/약을 구분하되, 어두운 색이 아니라 밝은 잉크와 섞으므로
 * '약함'도 흐려지지 않고 대비가 유지된다(다크 배경 기준).
 */
export const IMPACT_STRENGTH_INK_MIX: Record<ImpactStrength, number> = {
  strong: 0,
  medium: 30,
  weak: 55,
};
