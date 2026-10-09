import { createHmac } from "node:crypto";
import { OUTCOMES, PROBABILITIES, WHEEL, type OutcomeKey } from "../src/prizes.ts";
import type { RandomInt } from "../src/random.ts";
import type { CreateDiscountInput, CreatedDiscount, DiscountGateway } from "../src/shopify.ts";
import { ShopifyError } from "../src/shopify.ts";
import type { SpinSettings } from "../src/spin.ts";
import { SpinStore } from "../src/store.ts";

export const DATABASE_URL = process.env.TEST_DATABASE_URL;

export const settings = (over: Partial<SpinSettings> = {}): SpinSettings => ({
  probabilities: { ...PROBABILITIES },
  wheel: WHEEL,
  codeValidHours: 48,
  cooldownDays: 30,
  maxSpinsPerIpPerDay: 5,
  lockCodeToCustomer: true,
  ...over,
});

/** An RNG whose first roll lands inside `key`'s probability band; later rolls return 0. */
export function forceOutcome(key: OutcomeKey, probabilities = PROBABILITIES): RandomInt {
  let offset = 0;
  for (const [k, p] of Object.entries(probabilities) as [OutcomeKey, number][]) {
    if (k === key) break;
    offset += Math.round(p * 10_000);
  }
  let first = true;
  return (max) => {
    if (first) {
      first = false;
      if (offset >= max) throw new Error("bad forced offset");
      return offset;
    }
    return 0;
  };
}

export class FakeGateway implements DiscountGateway {
  calls: CreateDiscountInput[] = [];
  failNext = 0;
  failWith: ShopifyError = new ShopifyError("http_503", true);
  delayMs = 0;

  async createPercentCode(input: CreateDiscountInput): Promise<CreatedDiscount> {
    this.calls.push(input);
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    if (this.failNext > 0) {
      this.failNext--;
      throw this.failWith;
    }
    return { discountId: `gid://shopify/DiscountCodeNode/${this.calls.length}`, code: input.code, endsAt: input.endsAt };
  }
}

export async function freshStore(): Promise<SpinStore> {
  const store = new SpinStore(DATABASE_URL!, 20);
  await store.pool.query("drop table if exists spins");
  await store.migrate();
  return store;
}

export function signQuery(params: Record<string, string>, secret: string): string {
  const message = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("");
  const signature = createHmac("sha256", secret).update(message).digest("hex");
  return new URLSearchParams({ ...params, signature }).toString();
}

export const wonOutcomes = (Object.keys(OUTCOMES) as OutcomeKey[]).filter((k) => OUTCOMES[k].percent > 0);
