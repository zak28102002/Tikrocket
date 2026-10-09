import { randomBytes } from "node:crypto";
import { OUTCOMES, type OutcomeKey } from "./prizes.ts";
import { generateCode, pickOutcome, pickSegment, secureRandomInt, type RandomInt } from "./random.ts";
import { ShopifyError, type DiscountGateway } from "./shopify.ts";
import type { Identity, SpinRecord, SpinStore } from "./store.ts";

export interface SpinSettings {
  probabilities: Record<OutcomeKey, number>;
  wheel: readonly OutcomeKey[];
  codeValidHours: number;
  /** One spin per visitor/customer within this window. */
  cooldownDays: number;
  /** Spins allowed per IP address per 24 h (0 = no limit). Caps storage-clearing abuse. */
  maxSpinsPerIpPerDay: number;
  /** Lock the code to the logged-in customer so it can't be shared. */
  lockCodeToCustomer: boolean;
}

export interface Requester extends Identity {
  ipHash: string | null;
}

/** What the storefront is allowed to see about a spin. */
export interface PublicResult {
  won: boolean;
  outcome: OutcomeKey;
  percent: number;
  label: string;
  segmentIndex: number;
  code: string | null;
  expiresAt: string | null;
  expired: boolean;
}

export type SpinResponse =
  | { kind: "result"; alreadySpun: boolean; result: PublicResult }
  | { kind: "rate_limited" }
  | { kind: "unavailable"; retryable: boolean };

export interface WheelSegment {
  outcome: OutcomeKey;
  label: string;
  percent: number;
}

export interface StateResponse {
  eligible: boolean;
  wheel: WheelSegment[];
  /** The latest finished spin in the cooldown window (a win, even if expired, or a loss). */
  result: PublicResult | null;
  /** Shown in the terms line so it always matches the real configuration. */
  codeValidHours: number;
}

export class SpinService {
  private readonly store: SpinStore;
  private readonly gateway: DiscountGateway;
  private readonly settings: SpinSettings;
  private readonly rand: RandomInt;
  private readonly now: () => Date;

  constructor(deps: { store: SpinStore; gateway: DiscountGateway; settings: SpinSettings; rand?: RandomInt; now?: () => Date }) {
    this.store = deps.store;
    this.gateway = deps.gateway;
    this.settings = deps.settings;
    this.rand = deps.rand ?? secureRandomInt;
    this.now = deps.now ?? (() => new Date());
  }

  wheel(): WheelSegment[] {
    return this.settings.wheel.map((key) => ({ outcome: key, label: OUTCOMES[key].label, percent: OUTCOMES[key].percent }));
  }

  async state(identity: Identity): Promise<StateResponse> {
    const rec = await this.store.findRecent(identity, this.cooldownStart());
    // A pending record (issuance failed earlier) still counts as "can spin": the next
    // spin request resumes it with the outcome already rolled — it is never re-rolled.
    const finished = rec && rec.status !== "pending" ? rec : null;
    return {
      eligible: !finished,
      wheel: this.wheel(),
      result: finished ? this.toPublic(finished) : null,
      codeValidHours: this.settings.codeValidHours,
    };
  }

  async spin(req: Requester): Promise<SpinResponse> {
    return this.store.withIdentityLock(req, async (db) => {
      let rec = await db.findRecent(req, this.cooldownStart());

      if (rec && rec.status !== "pending") {
        return { kind: "result", alreadySpun: true, result: this.toPublic(rec) };
      }

      if (!rec) {
        if (req.ipHash && this.settings.maxSpinsPerIpPerDay > 0) {
          const since = new Date(this.now().getTime() - 24 * 3600 * 1000);
          if ((await db.countByIpSince(req.ipHash, since)) >= this.settings.maxSpinsPerIpPerDay) return { kind: "rate_limited" };
        }
        const outcome = pickOutcome(this.settings.probabilities, this.rand);
        const segmentIndex = pickSegment(this.settings.wheel, outcome, this.rand);
        const won = OUTCOMES[outcome].percent > 0;
        rec = await db.insert({
          id: `spin_${randomBytes(9).toString("base64url")}`,
          visitorId: req.visitorId,
          customerId: req.customerId,
          ipHash: req.ipHash,
          outcome,
          percent: OUTCOMES[outcome].percent,
          segmentIndex,
          status: won ? "pending" : "lost",
          code: null,
          discountId: null,
          expiresAt: null,
        });
        if (!won) return { kind: "result", alreadySpun: false, result: this.toPublic(rec) };
      }

      // Won (fresh, or resuming an earlier attempt that failed): create the real code.
      // The code is stored before calling Shopify so a crash can be recovered from.
      const code = rec.code ?? generateCode(rec.percent, secureRandomInt);
      if (!rec.code) await db.setCode(rec.id, code);
      const startsAt = this.now();
      const endsAt = new Date(startsAt.getTime() + this.settings.codeValidHours * 3600 * 1000);

      try {
        const created = await this.gateway.createPercentCode({
          code,
          percent: rec.percent,
          spinId: rec.id,
          startsAt,
          endsAt,
          customerGid: this.settings.lockCodeToCustomer && rec.customerId ? `gid://shopify/Customer/${rec.customerId}` : null,
        });
        const issued = await db.markIssued(rec.id, created.discountId, created.code, created.endsAt);
        return { kind: "result", alreadySpun: false, result: this.toPublic(issued) };
      } catch (err) {
        const retryable = err instanceof ShopifyError ? err.retryable : true;
        await db.markFailed(rec.id, (err as Error).message);
        // A rare code collision with an unrelated discount: pick a new code next time.
        if (err instanceof ShopifyError && err.message === "code_collision") await db.setCode(rec.id, generateCode(rec.percent, secureRandomInt));
        console.error(JSON.stringify({ level: "error", msg: "discount_create_failed", spin: rec.id, error: (err as Error).message }));
        return { kind: "unavailable", retryable };
      }
    });
  }

  private cooldownStart(): Date {
    return new Date(this.now().getTime() - this.settings.cooldownDays * 24 * 3600 * 1000);
  }

  private toPublic(rec: SpinRecord): PublicResult {
    const won = rec.status === "issued";
    const expired = won && !!rec.expiresAt && rec.expiresAt.getTime() <= this.now().getTime();
    return {
      won,
      outcome: rec.outcome,
      percent: rec.percent,
      label: OUTCOMES[rec.outcome].label,
      segmentIndex: rec.segmentIndex,
      code: won && !expired ? rec.code : null,
      expiresAt: won && rec.expiresAt ? rec.expiresAt.toISOString() : null,
      expired,
    };
  }
}
