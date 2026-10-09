/**
 * Spin-to-Win prizes, probabilities and wheel layout — the single place to change them.
 *
 * PROBABILITIES decide what a customer actually wins. They are percentages and must
 * total 100. They live only on the server: the browser never sees or sends them, it
 * is told which segment to land on after the server has picked the outcome.
 *
 * WHEEL is the visual layout, clockwise from the pointer at 12 o'clock. Its segment
 * counts deliberately do not match the probabilities (6 × 5% segments, but 5% is won
 * 60% of the time): the layout is designed to look balanced, the odds come from
 * PROBABILITIES. Every outcome on the wheel must be winnable and every winnable
 * outcome must appear on the wheel; `validatePrizeConfig` enforces both at startup.
 *
 * Override the probabilities without a deploy via the SPIN_PROBABILITIES env var,
 * e.g. SPIN_PROBABILITIES='{"p5":60,"p10":20,"p20":3,"p35":1,"none":16}'.
 */

export type OutcomeKey = "p5" | "p10" | "p20" | "p35" | "none";

export interface Outcome {
  key: OutcomeKey;
  /** Percentage off the order; 0 for "no prize". */
  percent: number;
  /** Text printed on the wheel segment. */
  label: string;
}

export const OUTCOMES: Record<OutcomeKey, Outcome> = {
  p5: { key: "p5", percent: 5, label: "5% off" },
  p10: { key: "p10", percent: 10, label: "10% off" },
  p20: { key: "p20", percent: 20, label: "20% off" },
  p35: { key: "p35", percent: 35, label: "35% off" },
  none: { key: "none", percent: 0, label: "No prize" },
};

/** Target odds in percent. Must total 100. */
export const PROBABILITIES: Record<OutcomeKey, number> = {
  p5: 60,
  p10: 20,
  p20: 3,
  p35: 1,
  none: 16,
};

/**
 * 14 segments: 6 × 5%, 2 × 10%, 1 × 20%, 1 × 35%, 4 × no prize.
 * 35% sits under the pointer at rest and 20% directly opposite; no two 5% segments
 * touch — each pair is split by a red "no prize" or a bigger prize.
 */
export const WHEEL: readonly OutcomeKey[] = [
  "p35", //  0
  "p5", //   1
  "none", // 2
  "p10", //  3
  "p5", //   4
  "none", // 5
  "p5", //   6
  "p20", //  7
  "p5", //   8
  "none", // 9
  "p10", // 10
  "p5", //  11
  "none", // 12
  "p5", //  13
];

const KEYS = Object.keys(OUTCOMES) as OutcomeKey[];

export function parseProbabilities(raw: string | undefined): Record<OutcomeKey, number> {
  if (!raw || !raw.trim()) return { ...PROBABILITIES };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("SPIN_PROBABILITIES is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("SPIN_PROBABILITIES must be a JSON object");
  const out = {} as Record<OutcomeKey, number>;
  for (const key of KEYS) {
    const v = (parsed as Record<string, unknown>)[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      throw new Error(`SPIN_PROBABILITIES.${key} must be a number >= 0`);
    }
    out[key] = v;
  }
  for (const key of Object.keys(parsed as object)) {
    if (!KEYS.includes(key as OutcomeKey)) throw new Error(`SPIN_PROBABILITIES has unknown outcome "${key}"`);
  }
  return out;
}

export function validatePrizeConfig(probabilities: Record<OutcomeKey, number>, wheel: readonly OutcomeKey[] = WHEEL): void {
  const total = KEYS.reduce((sum, k) => sum + probabilities[k], 0);
  if (Math.abs(total - 100) > 1e-9) throw new Error(`Spin probabilities must total 100, got ${total}`);
  if (wheel.length < 2) throw new Error("The wheel needs at least 2 segments");
  for (const key of wheel) {
    if (!(key in OUTCOMES)) throw new Error(`Unknown wheel outcome "${key}"`);
    if (!(probabilities[key] > 0)) {
      throw new Error(`Wheel shows "${OUTCOMES[key].label}" but its probability is 0; remove it from the wheel or give it odds`);
    }
  }
  for (const key of KEYS) {
    if (probabilities[key] > 0 && !wheel.includes(key)) {
      throw new Error(`"${OUTCOMES[key].label}" can be won but has no segment on the wheel`);
    }
  }
}
