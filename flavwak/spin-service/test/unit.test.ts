import assert from "node:assert/strict";
import { test } from "node:test";
import { mintVisitorToken, readVisitorToken, verifyAppProxySignature } from "../src/auth.ts";
import { loadConfig } from "../src/config.ts";
import { OUTCOMES, PROBABILITIES, WHEEL, parseProbabilities, validatePrizeConfig, type OutcomeKey } from "../src/prizes.ts";
import { generateCode, pickOutcome, pickSegment } from "../src/random.ts";
import { forceOutcome } from "./helpers.ts";

test("wheel has the requested 14 segments and distribution", () => {
  const counts: Record<string, number> = {};
  for (const k of WHEEL) counts[k] = (counts[k] ?? 0) + 1;
  assert.equal(WHEEL.length, 14);
  assert.deepEqual(counts, { p5: 6, p10: 2, p20: 1, p35: 1, none: 4 });
});

test("no two 5% segments are adjacent (including wrap-around)", () => {
  for (let i = 0; i < WHEEL.length; i++) {
    const next = WHEEL[(i + 1) % WHEEL.length];
    assert.ok(!(WHEEL[i] === "p5" && next === "p5"), `segments ${i} and ${(i + 1) % WHEEL.length} are both 5%`);
  }
});

test("default probabilities are the requested ones and validate", () => {
  assert.deepEqual(PROBABILITIES, { p5: 60, p10: 20, p20: 3, p35: 1, none: 16 });
  validatePrizeConfig(PROBABILITIES);
});

test("config validation rejects odds that do not total 100 or do not match the wheel", () => {
  assert.throws(() => validatePrizeConfig({ ...PROBABILITIES, p5: 59 }), /total 100/);
  assert.throws(() => validatePrizeConfig({ p5: 64, p10: 20, p20: 0, p35: 0, none: 16 }), /probability is 0/);
  assert.throws(() => validatePrizeConfig(PROBABILITIES, ["p5", "p10", "p20", "none"]), /no segment on the wheel/);
});

test("SPIN_PROBABILITIES env override is parsed strictly", () => {
  assert.deepEqual(parseProbabilities('{"p5":50,"p10":30,"p20":3,"p35":1,"none":16}'), { p5: 50, p10: 30, p20: 3, p35: 1, none: 16 });
  assert.throws(() => parseProbabilities("{"), /valid JSON/);
  assert.throws(() => parseProbabilities('{"p5":60,"p10":20,"p20":3,"p35":1}'), /none must be/);
  assert.throws(() => parseProbabilities('{"p5":60,"p10":20,"p20":3,"p35":1,"none":16,"p50":0}'), /unknown outcome/);
  assert.throws(() => parseProbabilities('{"p5":-1,"p10":20,"p20":3,"p35":1,"none":16}'), />= 0/);
});

test("secure roll matches the configured odds (200k samples)", () => {
  const n = 200_000;
  const counts: Record<string, number> = { p5: 0, p10: 0, p20: 0, p35: 0, none: 0 };
  for (let i = 0; i < n; i++) counts[pickOutcome(PROBABILITIES)]++;
  for (const [k, p] of Object.entries(PROBABILITIES)) {
    const observed = (counts[k] / n) * 100;
    // 5 standard errors — effectively never flaky, still catches a wrong distribution.
    const tolerance = 5 * Math.sqrt((p * (100 - p)) / n);
    assert.ok(Math.abs(observed - p) <= tolerance, `${k}: expected ~${p}%, got ${observed.toFixed(3)}%`);
  }
});

test("forced rolls pick each outcome, and segments always show that outcome", () => {
  for (const key of Object.keys(OUTCOMES) as OutcomeKey[]) {
    assert.equal(pickOutcome(PROBABILITIES, forceOutcome(key)), key);
    for (let i = 0; i < 50; i++) assert.equal(WHEEL[pickSegment(WHEEL, key)], key);
  }
});

test("codes are unambiguous and carry the percentage", () => {
  const code = generateCode(35);
  assert.match(code, /^SPIN35-[A-HJKMNP-Z2-9]{8}$/);
  assert.notEqual(generateCode(5), generateCode(5));
});

// Vectors from https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
// (the page shows the shop as "{shop}"; the signatures were computed with "shop-name").
const DOC_ANON =
  "extra=1&extra=2&shop=shop-name.myshopify.com&logged_in_customer_id=&path_prefix=%2Fapps%2Fawesome_reviews&timestamp=1317327555&signature=e072b6d7e6622d85912a5214b860d3100dc1e73d9bc29f43796ac8c9ff8093cb";
const DOC_CUSTOMER =
  "extra=1&extra=2&shop=shop-name.myshopify.com&logged_in_customer_id=1&path_prefix=%2Fapps%2Fawesome_reviews&timestamp=1317327555&signature=4c68c8624d737112c91818c11017d24d334b524cb5c2b8ba08daa056f7395ddb";

test("app proxy signature matches Shopify's documented examples", () => {
  assert.equal(verifyAppProxySignature(DOC_ANON, "hush").ok, true);
  const res = verifyAppProxySignature(DOC_CUSTOMER, "hush");
  assert.ok(res.ok && res.params.get("logged_in_customer_id") === "1");
});

test("app proxy signature rejects tampering, wrong secret, staleness and other shops", () => {
  assert.deepEqual(verifyAppProxySignature(DOC_ANON.replace("customer_id=", "customer_id=7"), "hush"), { ok: false, reason: "bad_signature" });
  assert.deepEqual(verifyAppProxySignature(DOC_ANON, "nope"), { ok: false, reason: "bad_signature" });
  assert.deepEqual(verifyAppProxySignature(DOC_ANON.replace(/&signature=.*/, ""), "hush"), { ok: false, reason: "missing_signature" });
  assert.deepEqual(verifyAppProxySignature(DOC_ANON, "hush", { maxAgeSeconds: 300, now: 1317327555 + 301 }), { ok: false, reason: "stale_signature" });
  assert.equal(verifyAppProxySignature(DOC_ANON, "hush", { maxAgeSeconds: 300, now: 1317327555 + 10 }).ok, true);
  assert.deepEqual(verifyAppProxySignature(DOC_ANON, "hush", { shop: "flavwak.myshopify.com" }), { ok: false, reason: "wrong_shop" });
});

test("visitor tokens round-trip and resist forgery", () => {
  const secret = "s".repeat(40);
  const { id, token } = mintVisitorToken(secret);
  assert.equal(readVisitorToken(token, secret), id);
  assert.equal(readVisitorToken(token, "t".repeat(40)), null);
  const [p, , sig] = token.split(".");
  assert.equal(readVisitorToken(`${p}.AAAAAAAAAAAAAAAAAAAAAA.${sig}`, secret), null);
  assert.equal(readVisitorToken(undefined, secret), null);
  assert.equal(readVisitorToken("x".repeat(500), secret), null);
});

test("config requires secrets and refuses unsigned mode in production", () => {
  const base = {
    DATABASE_URL: "postgres://x",
    SHOPIFY_SHOP_DOMAIN: "flavwak.myshopify.com",
    SHOPIFY_CLIENT_ID: "id",
    SHOPIFY_CLIENT_SECRET: "secret",
    SPIN_VISITOR_SECRET: "v".repeat(32),
  };
  const cfg = loadConfig(base);
  assert.equal(cfg.proxySecret, "secret");
  assert.equal(cfg.spin.codeValidHours, 48);
  assert.equal(cfg.apiVersion, "2026-10");
  assert.throws(() => loadConfig({ ...base, SPIN_VISITOR_SECRET: "short" }), /at least 32/);
  assert.throws(() => loadConfig({ ...base, SHOPIFY_SHOP_DOMAIN: "flavwak.com" }), /myshopify/);
  assert.throws(() => loadConfig({ ...base, SPIN_ALLOW_UNSIGNED: "true", NODE_ENV: "production" }), /never be enabled/);
  assert.throws(() => loadConfig({ ...base, SPIN_PROBABILITIES: '{"p5":10,"p10":20,"p20":3,"p35":1,"none":16}' }), /total 100/);
});
