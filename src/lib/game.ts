export type Operator = "+" | "-";

export type Problem = {
  left: number;
  right: number;
  operator: Operator;
  answer: number;
};

export type Speed = "normal" | "fast";

export const SPEED_MS: Record<Speed, number> = {
  normal: 4500,
  fast: 2800,
};

export const PREVIEW_MS: Record<Speed, number> = {
  normal: 2200,
  fast: 1400,
};

export const ANSWER_COUNT = 20;
export const MIN_N = 1;
export const MAX_N = 20;

export function formatProblem(p: Problem): string {
  return `${p.left} ${p.operator} ${p.right}`;
}

/** Generate a single-digit (0–9) addition or subtraction problem. */
export function generateProblem(): Problem {
  if (Math.random() < 0.5) {
    const answer = Math.floor(Math.random() * 10);
    const left = Math.floor(Math.random() * (answer + 1));
    const right = answer - left;
    return { left, right, operator: "+", answer };
  }

  const left = Math.floor(Math.random() * 10);
  const right = Math.floor(Math.random() * (left + 1));
  return { left, right, operator: "-", answer: left - right };
}

export function generateProblems(count: number): Problem[] {
  return Array.from({ length: count }, () => generateProblem());
}

export function accuracyPercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 1000) / 10;
}
