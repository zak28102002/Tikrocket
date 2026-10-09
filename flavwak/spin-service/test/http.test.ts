import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { createHandler } from "../src/server.ts";
import { ShopifyDiscountGateway, ShopifyError, discountTitle } from "../src/shopify.ts";
import { SpinService } from "../src/spin.ts";
import type { SpinStore } from "../src/store.ts";
import { DATABASE_URL, FakeGateway, forceOutcome, freshStore, settings, signQuery } from "./helpers.ts";

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: ((call: Call) => unknown)[]) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    const body = next(call);
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { calls, impl };
}

const input = () => ({
  code: "SPIN10-ABCDEFGH",
  percent: 10,
  spinId: "spin_test",
  startsAt: new Date("2026-10-10T10:00:00Z"),
  endsAt: new Date("2026-10-12T10:00:00Z"),
  customerGid: null,
});

describe("ShopifyDiscountGateway", () => {
  test("creates a one-use, once-per-customer, expiring, non-stacking percentage code", async () => {
    const f = fakeFetch([
      () => ({ data: { discountCodeBasicCreate: { codeDiscountNode: { id: "gid://shopify/DiscountCodeNode/1", codeDiscount: { endsAt: "2026-10-12T10:00:00Z" } }, userErrors: [] } } }),
    ]);
    const gw = new ShopifyDiscountGateway({ shop: "flavwak.myshopify.com", apiVersion: "2026-10", accessToken: "shpat_x", combinesWithShipping: true, fetchImpl: f.impl });
    const out = await gw.createPercentCode(input());
    assert.equal(out.discountId, "gid://shopify/DiscountCodeNode/1");
    assert.equal(f.calls[0].url, "https://flavwak.myshopify.com/admin/api/2026-10/graphql.json");
    assert.equal((f.calls[0].init.headers as Record<string, string>)["X-Shopify-Access-Token"], "shpat_x");
    const vars = JSON.parse(f.calls[0].init.body as string).variables.input;
    assert.deepEqual(vars, {
      title: discountTitle(10, "spin_test"),
      code: "SPIN10-ABCDEFGH",
      startsAt: "2026-10-10T10:00:00.000Z",
      endsAt: "2026-10-12T10:00:00.000Z",
      usageLimit: 1,
      appliesOncePerCustomer: true,
      customerGets: { value: { percentage: 0.1 }, items: { all: true } },
      context: { all: "ALL" },
      combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: true },
    });
  });

  test("locks the code to the logged-in customer when given", async () => {
    const f = fakeFetch([() => ({ data: { discountCodeBasicCreate: { codeDiscountNode: { id: "g", codeDiscount: { endsAt: null } }, userErrors: [] } } })]);
    const gw = new ShopifyDiscountGateway({ shop: "flavwak.myshopify.com", apiVersion: "2026-10", accessToken: "t", combinesWithShipping: false, fetchImpl: f.impl });
    await gw.createPercentCode({ ...input(), customerGid: "gid://shopify/Customer/42" });
    const vars = JSON.parse(f.calls[0].init.body as string).variables.input;
    assert.deepEqual(vars.context, { customers: { add: ["gid://shopify/Customer/42"] } });
    assert.equal(vars.combinesWith.shippingDiscounts, false);
  });

  test("adopts its own half-created code after a crash, but not someone else's", async () => {
    const taken = () => ({ data: { discountCodeBasicCreate: { codeDiscountNode: null, userErrors: [{ field: ["basicCodeDiscount", "code"], code: "TAKEN", message: "Code must be unique." }] } } });
    const mine = fakeFetch([taken, () => ({ data: { codeDiscountNodeByCode: { id: "gid://shopify/DiscountCodeNode/9", codeDiscount: { title: discountTitle(10, "spin_test"), endsAt: "2026-10-12T10:00:00Z" } } } })]);
    const gw = new ShopifyDiscountGateway({ shop: "flavwak.myshopify.com", apiVersion: "2026-10", accessToken: "t", combinesWithShipping: true, fetchImpl: mine.impl });
    assert.equal((await gw.createPercentCode(input())).discountId, "gid://shopify/DiscountCodeNode/9");

    const theirs = fakeFetch([taken, () => ({ data: { codeDiscountNodeByCode: { id: "x", codeDiscount: { title: "Summer sale", endsAt: null } } } })]);
    const gw2 = new ShopifyDiscountGateway({ shop: "flavwak.myshopify.com", apiVersion: "2026-10", accessToken: "t", combinesWithShipping: true, fetchImpl: theirs.impl });
    await assert.rejects(gw2.createPercentCode(input()), (e: unknown) => e instanceof ShopifyError && e.message === "code_collision");
  });

  test("validation errors and auth failures are surfaced, never treated as success", async () => {
    const f = fakeFetch([() => ({ data: { discountCodeBasicCreate: { codeDiscountNode: null, userErrors: [{ field: ["endsAt"], code: "INVALID", message: "Ends at is invalid" }] } } })]);
    const gw = new ShopifyDiscountGateway({ shop: "flavwak.myshopify.com", apiVersion: "2026-10", accessToken: "t", combinesWithShipping: true, fetchImpl: f.impl });
    await assert.rejects(gw.createPercentCode(input()), /discount_rejected: Ends at is invalid/);

    const g = fakeFetch([() => new Response("{}", { status: 403 })]);
    const gw2 = new ShopifyDiscountGateway({ shop: "flavwak.myshopify.com", apiVersion: "2026-10", accessToken: "t", combinesWithShipping: true, fetchImpl: g.impl });
    await assert.rejects(gw2.createPercentCode(input()), (e: unknown) => e instanceof ShopifyError && !e.retryable);
  });

  test("client credentials: fetches a token once and reuses it", async () => {
    const ok = () => ({ data: { discountCodeBasicCreate: { codeDiscountNode: { id: "g", codeDiscount: { endsAt: null } }, userErrors: [] } } });
    const f = fakeFetch([() => ({ access_token: "tok_1", expires_in: 86399, scope: "write_discounts" }), ok, ok]);
    const gw = new ShopifyDiscountGateway({ shop: "flavwak.myshopify.com", apiVersion: "2026-10", clientId: "cid", clientSecret: "csec", combinesWithShipping: true, fetchImpl: f.impl });
    await gw.createPercentCode(input());
    await gw.createPercentCode(input());
    assert.equal(f.calls.length, 3);
    assert.equal(f.calls[0].url, "https://flavwak.myshopify.com/admin/oauth/access_token");
    const form = new URLSearchParams(String(f.calls[0].init.body));
    assert.equal(form.get("grant_type"), "client_credentials");
    assert.equal(form.get("client_id"), "cid");
    assert.equal((f.calls[2].init.headers as Record<string, string>)["X-Shopify-Access-Token"], "tok_1");
  });
});

describe("HTTP App Proxy endpoints", { skip: !DATABASE_URL && "set TEST_DATABASE_URL to run" }, () => {
  const SECRET = "app-client-secret";
  const VISITOR_SECRET = "v".repeat(40);
  const SHOP = "flavwak.myshopify.com";
  let store: SpinStore;
  let server: Server;
  let base: string;
  let gateway: FakeGateway;
  let nextOutcome: Parameters<typeof forceOutcome>[0] = "p10";

  before(async () => {
    store = await freshStore();
    gateway = new FakeGateway();
    const handler = createHandler({
      // A fresh service per request lets each test force the roll.
      service: new Proxy({} as SpinService, {
        get: (_t, prop) => {
          const svc = new SpinService({ store, gateway, settings: settings(), rand: forceOutcome(nextOutcome) });
          const v = (svc as unknown as Record<string | symbol, unknown>)[prop];
          return typeof v === "function" ? v.bind(svc) : v;
        },
      }),
      proxySecret: SECRET,
      visitorSecret: VISITOR_SECRET,
      shop: SHOP,
      signatureMaxAgeSeconds: 300,
      allowUnsigned: false,
      trustedProxyHops: 1,
    });
    server = createServer(handler);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server.close();
    await store.close();
  });

  const signed = (path: string, extra: Record<string, string> = {}, customer = "") =>
    `${base}${path}?${signQuery({ shop: SHOP, logged_in_customer_id: customer, path_prefix: "/apps/flavwak-spin", timestamp: String(Math.floor(Date.now() / 1000)), ...extra }, SECRET)}`;

  test("rejects requests that did not come through the App Proxy", async () => {
    assert.equal((await fetch(`${base}/proxy/state`)).status, 401);
    const forged = signed("/proxy/state").replace("logged_in_customer_id=", "logged_in_customer_id=1");
    assert.equal((await fetch(forged)).status, 401);
    const res = await fetch(signed("/proxy/spin"), { method: "POST", body: "{}" });
    assert.equal(res.status, 400, "a signed spin still needs a valid visitor token");
  });

  test("full journey: state → spin → refresh keeps the same code", async () => {
    const s1 = await (await fetch(signed("/proxy/state"))).json();
    assert.equal(s1.ok, true);
    assert.equal(s1.eligible, true);
    assert.equal(s1.wheel.length, 14);
    assert.equal(s1.codeValidHours, 48);
    assert.match(s1.visitor, /^v1\./);
    assert.equal(JSON.stringify(s1).includes("probab"), false, "odds are never sent to the browser");

    nextOutcome = "p10";
    const spinRes = await fetch(signed("/proxy/spin"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.9, 23.227.38.1" },
      body: JSON.stringify({ visitor: s1.visitor, outcome: "p35", percent: 35 }),
    });
    assert.equal(spinRes.headers.get("cache-control"), "no-store");
    const spin = await spinRes.json();
    assert.equal(spin.ok, true);
    assert.equal(spin.result.percent, 10, "client-sent fields cannot change the prize");
    assert.match(spin.result.code, /^SPIN10-/);

    const s2 = await (await fetch(signed("/proxy/state", { visitor: s1.visitor }))).json();
    assert.equal(s2.visitor, s1.visitor);
    assert.equal(s2.eligible, false);
    assert.equal(s2.result.code, spin.result.code);

    nextOutcome = "p35";
    const again = await (await fetch(signed("/proxy/spin"), { method: "POST", body: JSON.stringify({ visitor: s1.visitor }) })).json();
    assert.equal(again.alreadySpun, true);
    assert.equal(again.result.code, spin.result.code);

    const { rows } = await store.pool.query("select ip_hash from spins limit 1");
    assert.ok(rows[0].ip_hash && !String(rows[0].ip_hash).includes("203.0.113.9"), "raw IPs are not stored");
  });

  test("Shopify outage returns 503 without a code", async () => {
    const s = await (await fetch(signed("/proxy/state"))).json();
    nextOutcome = "p5";
    gateway.failNext = 1;
    const res = await fetch(signed("/proxy/spin"), { method: "POST", body: JSON.stringify({ visitor: s.visitor }) });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.deepEqual(body, { ok: false, error: "discount_unavailable", retryable: true });
  });
});
