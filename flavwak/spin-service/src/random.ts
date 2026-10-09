import { randomInt } from "node:crypto";
import type { OutcomeKey } from "./prizes.ts";

/** Uniform integer in [0, max) from the OS CSPRNG. Injectable for tests. */
export type RandomInt = (max: number) => number;

export const secureRandomInt: RandomInt = (max) => randomInt(0, max);

// Probabilities are percentages with up to 4 decimals (e.g. 0.0125%).
const SCALE = 10_000;

export function pickOutcome(probabilities: Record<OutcomeKey, number>, rand: RandomInt = secureRandomInt): OutcomeKey {
  const entries = (Object.entries(probabilities) as [OutcomeKey, number][])
    .map(([key, p]) => [key, Math.round(p * SCALE)] as const)
    .filter(([, units]) => units > 0);
  const total = entries.reduce((sum, [, units]) => sum + units, 0);
  let roll = rand(total);
  for (const [key, units] of entries) {
    if (roll < units) return key;
    roll -= units;
  }
  throw new Error("unreachable: roll outside probability range");
}

/** Picks one wheel segment showing `outcome`, uniformly among those that do. */
export function pickSegment(wheel: readonly OutcomeKey[], outcome: OutcomeKey, rand: RandomInt = secureRandomInt): number {
  const indexes = wheel.flatMap((key, i) => (key === outcome ? [i] : []));
  if (!indexes.length) throw new Error(`No wheel segment for outcome "${outcome}"`);
  return indexes[rand(indexes.length)];
}

// No 0/O, 1/I/L: codes get read aloud and typed on phones.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode(percent: number, rand: RandomInt = secureRandomInt, length = 8): string {
  let body = "";
  for (let i = 0; i < length; i++) body += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
  return `SPIN${percent}-${body}`;
}
