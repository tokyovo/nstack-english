// The parent gate in front of account and profile screens while a child is learning: a
// multiplication of two numbers from 6 to 9, asked in Vietnamese words and answered in digits.
// It keeps young children out; it is not security (the server refuses a child's token there).
export const GATE_FACTORS = [6, 7, 8, 9] as const;

export type GateFactor = (typeof GATE_FACTORS)[number];

export type GateQuestion = { a: GateFactor; b: GateFactor };

/** A new question; `random` returns a number in [0, 1), like Math.random. */
export function newGateQuestion(random: () => number = Math.random): GateQuestion {
  const pick = () => GATE_FACTORS[Math.floor(random() * GATE_FACTORS.length)];
  return { a: pick(), b: pick() };
}

/** True when `answer` is the product in digits. */
export function isGateAnswer(question: GateQuestion, answer: string): boolean {
  const digits = answer.trim();
  return /^\d+$/.test(digits) && Number(digits) === question.a * question.b;
}
