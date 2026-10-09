import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { OUTCOMES, WHEEL, type OutcomeKey } from "../src/prizes.ts";
import { ShopifyError } from "../src/shopify.ts";
import { SpinService } from "../src/spin.ts";
import type { SpinStore } from "../src/store.ts";
import { DATABASE_URL, FakeGateway, forceOutcome, freshStore, settings } from "./helpers.ts";

describe("SpinService (Postgres)", { skip: !DATABASE_URL && "set TEST_DATABASE_URL to run" }, () => {
  let store: SpinStore;
  let gateway: FakeGateway;
  let n = 0;
  const visitor = () => ({ visitorId: `visitor-${++n}`, customerId: null, ipHash: `ip-${n}` });
  const service = (rand?: (max: number) => number, over = {}, now?: () => Date) =>
    new SpinService({ store, gateway, settings: settings(over), rand, now });

  before(async () => {
    store = await freshStore();
  });
  after(async () => {
    await store.close();
  });
  beforeEach(() => {
    gateway = new FakeGateway();
  });

  for (const key of Object.keys(OUTCOMES) as OutcomeKey[]) {
    test(`outcome ${key}: lands on a matching segment and ${OUTCOMES[key].percent ? "issues a real code" : "issues nothing"}`, async () => {
      const req = visitor();
      const out = await service(forceOutcome(key)).spin(req);
      assert.equal(out.kind, "result");
      if (out.kind !== "result") return;
      const r = out.result;
      assert.equal(r.outcome, key);
      assert.equal(WHEEL[r.segmentIndex], key, "the wheel must stop on a segment showing the awarded outcome");
      if (OUTCOMES[key].percent) {
        assert.equal(r.won, true);
        assert.equal(r.percent, OUTCOMES[key].percent);
        assert.match(r.code!, new RegExp(`^SPIN${r.percent}-`));
        assert.equal(gateway.calls.length, 1);
        const call = gateway.calls[0];
        assert.equal(call.percent, OUTCOMES[key].percent);
        assert.equal(call.code, r.code);
        assert.equal(call.endsAt.getTime() - call.startsAt.getTime(), 48 * 3600 * 1000);
        assert.equal(r.expiresAt, call.endsAt.toISOString());
      } else {
        assert.equal(r.won, false);
        assert.equal(r.code, null);
        assert.equal(gateway.calls.length, 0, "a losing spin must never create a discount");
      }
    });
  }

  test("a second spin returns the first result instead of rolling again", async () => {
    const req = visitor();
    const first = await service(forceOutcome("p10")).spin(req);
    const second = await service(forceOutcome("p35")).spin(req);
    assert.ok(first.kind === "result" && second.kind === "result");
    assert.equal(second.alreadySpun, true);
    assert.deepEqual(second.result, first.result);
    assert.equal(gateway.calls.length, 1);
  });

  test("state after a win (a page refresh) shows the same code and no new spin", async () => {
    const req = visitor();
    const svc = service(forceOutcome("p20"));
    assert.equal((await svc.state(req)).eligible, true);
    const out = await svc.spin(req);
    const state = await svc.state(req);
    assert.ok(out.kind === "result");
    assert.equal(state.eligible, false);
    assert.deepEqual(state.result, out.result);
    assert.equal(state.wheel.length, 14);
  });

  test("20 concurrent spins from one visitor create exactly one discount", async () => {
    const req = visitor();
    gateway.delayMs = 50;
    const results = await Promise.all(Array.from({ length: 20 }, () => service(forceOutcome("p5")).spin(req)));
    assert.equal(gateway.calls.length, 1);
    const codes = new Set(results.map((r) => (r.kind === "result" ? r.result.code : "x")));
    assert.equal(codes.size, 1);
    assert.equal(results.filter((r) => r.kind === "result" && !r.alreadySpun).length, 1);
    const { rows } = await store.pool.query("select count(*)::int n from spins where visitor_id = $1", [req.visitorId]);
    assert.equal(rows[0].n, 1);
  });

  test("Shopify failure shows no code, and the retry keeps the same outcome (no re-roll)", async () => {
    const req = visitor();
    gateway.failNext = 1;
    const failed = await service(forceOutcome("p35")).spin(req);
    assert.deepEqual(failed, { kind: "unavailable", retryable: true });
    assert.equal((await service().state(req)).eligible, true, "a failed issuance does not use up the spin");

    // Retry with an RNG that would pick "no prize": the stored 35% must win.
    const retry = await service(forceOutcome("none")).spin(req);
    assert.ok(retry.kind === "result");
    assert.equal(retry.result.outcome, "p35");
    assert.equal(retry.result.won, true);
    assert.equal(gateway.calls.length, 2);
    assert.equal(gateway.calls[0].code, gateway.calls[1].code, "the same code is retried so a half-created discount is adopted");
  });

  test("a non-retryable Shopify rejection is reported as such and never shows a code", async () => {
    const req = visitor();
    gateway.failNext = 1;
    gateway.failWith = new ShopifyError("discount_rejected: bad", false);
    const out = await service(forceOutcome("p5")).spin(req);
    assert.deepEqual(out, { kind: "unavailable", retryable: false });
    const { rows } = await store.pool.query("select status, discount_id from spins where visitor_id = $1", [req.visitorId]);
    assert.equal(rows[0].status, "pending");
    assert.equal(rows[0].discount_id, null);
  });

  test("a logged-in customer gets one reward across devices, locked to their account", async () => {
    const phone = { visitorId: `visitor-${++n}`, customerId: "123456789", ipHash: "ip-a" };
    const laptop = { visitorId: `visitor-${++n}`, customerId: "123456789", ipHash: "ip-b" };
    const first = await service(forceOutcome("p10")).spin(phone);
    const second = await service(forceOutcome("p35")).spin(laptop);
    assert.ok(first.kind === "result" && second.kind === "result");
    assert.equal(second.alreadySpun, true);
    assert.equal(second.result.code, first.result.code);
    assert.equal(gateway.calls[0].customerGid, "gid://shopify/Customer/123456789");
  });

  test("anonymous codes are not locked to a customer", async () => {
    await service(forceOutcome("p5")).spin(visitor());
    assert.equal(gateway.calls[0].customerGid, null);
  });

  test("per-IP cap stops fresh visitor ids from spinning endlessly", async () => {
    const ip = `shared-ip-${++n}`;
    const svc = service(undefined, { maxSpinsPerIpPerDay: 3 });
    for (let i = 0; i < 3; i++) assert.equal((await svc.spin({ visitorId: `v-ip-${n}-${i}`, customerId: null, ipHash: ip })).kind, "result");
    assert.deepEqual(await svc.spin({ visitorId: `v-ip-${n}-x`, customerId: null, ipHash: ip }), { kind: "rate_limited" });
  });

  test("expired codes are not shown again, and the spin stays used until the cooldown ends", async () => {
    const req = visitor();
    const t0 = Date.now();
    await service(forceOutcome("p20"), {}, () => new Date(t0)).spin(req);
    const later = service(undefined, {}, () => new Date(t0 + 49 * 3600 * 1000));
    const state = await later.state(req);
    assert.equal(state.eligible, false);
    assert.equal(state.result?.expired, true);
    assert.equal(state.result?.code, null);
    const afterCooldown = service(undefined, {}, () => new Date(t0 + 31 * 24 * 3600 * 1000));
    assert.equal((await afterCooldown.state(req)).eligible, true);
  });
});
