# Flavwak Spin to Win — spin service

The secure backend behind the theme's **FW Spin to win** popup. It picks the prize,
creates a real Shopify discount code, and remembers who has already spun. The theme
only animates the wheel to the segment this service chose.

```
Browser ──/apps/flavwak-spin/state|spin──▶ Shopify App Proxy ──signed──▶ this service ──▶ Shopify Admin API
                                         (adds shop, logged_in_customer_id,              (discountCodeBasicCreate)
                                          timestamp, HMAC signature)        │
                                                                            └──▶ Postgres (spins table)
```

## How a spin works

1. `GET /proxy/state` — returns the wheel layout, whether this visitor/customer may
   spin, and any earlier result. Mints a signed visitor token on first visit (App
   Proxies strip cookies, so the theme keeps it in `localStorage`).
2. `POST /proxy/spin` — under Postgres advisory locks for the visitor and customer:
   - an earlier finished spin in the cooldown window is returned unchanged (refreshes,
     double clicks, other tabs and other devices of a logged-in customer all get the
     same reward);
   - otherwise the outcome is rolled with `crypto.randomInt` from `src/prizes.ts`, a
     wheel segment showing that outcome is chosen, and the spin is stored;
   - a win creates a Shopify code: `usageLimit: 1`, `appliesOncePerCustomer: true`,
     `endsAt` = now + 48 h, all products, `combinesWith` order/product discounts
     **false** (no stacking with other codes or the multi-pack automatic discounts),
     locked to the customer when logged in;
   - if Shopify fails, no code is returned (`503`), and the next attempt retries
     **the same outcome and the same code** — a failure can never be used to re-roll,
     and a code Shopify created before a crash is adopted rather than duplicated.
3. The browser cannot influence the result: odds never leave the server, request
   bodies are ignored apart from the visitor token, and every request must carry a
   valid App Proxy signature.

**Change the odds or the wheel in one place:** `src/prizes.ts` (or the
`SPIN_PROBABILITIES` env var). The service refuses to start if the odds don't total
100, if the wheel shows an outcome that can't be won, or if a winnable outcome has no
segment.

### Limits that apply

- One spin per visitor token **and** per logged-in customer within `SPIN_COOLDOWN_DAYS`
  (default 30).
- Anonymous visitors can get a new token by clearing site data; `SPIN_MAX_SPINS_PER_IP_PER_DAY`
  (default 5) caps that per IP. A browser session alone cannot guarantee one reward
  per *person* across devices — only logged-in customers are tracked across devices.
- Shopify enforces single use and the expiry at checkout, whatever happens here.

## Setup

1. **Create the app** in the Shopify Dev Dashboard (owned by the store's organisation),
   with the scopes and App Proxy from `shopify.app.toml.example`, and install it on the
   store. App proxy: prefix `apps`, subpath `flavwak-spin`, URL `https://<service>/proxy`.
2. **Deploy this folder** (Railway: new service from this repo with root directory
   `flavwak/spin-service`, add a Postgres database). `railway.json` and the
   `Dockerfile` are ready; the table is created on start.
3. **Set the environment** from `.env.example` — `DATABASE_URL`, `SHOPIFY_SHOP_DOMAIN`,
   `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SPIN_VISITOR_SECRET`.
   The service uses the client credentials grant (24 h tokens, refreshed
   automatically); `SHOPIFY_ADMIN_ACCESS_TOKEN` works too for an existing admin-created
   app. No secret is ever sent to the browser.
4. **Check it**: `https://<service>/health` → `{"ok":true}`, then
   `https://flavwak.com/apps/flavwak-spin/state` in a browser → JSON with `"ok":true`.
   Until that URL works, the theme shows no popup at all.

## Develop & test

```bash
npm install
npm run typecheck
TEST_DATABASE_URL=postgres://localhost/spin_test npm test   # DB tests skip without it
```

Requires Node ≥ 22.18 (runs the TypeScript sources directly). Tests cover the odds,
the wheel layout, App Proxy signatures (against Shopify's documented vectors), every
outcome, 20 concurrent spins → one code, Shopify failures and retries, per-IP caps,
cross-device customers, expiry, the exact `discountCodeBasicCreate` input, and the HTTP
endpoints.

Expired, unused spin discounts stay in Shopify admin (they're inert); filter by the
title prefix "Spin to Win" to bulk-delete them occasionally.
