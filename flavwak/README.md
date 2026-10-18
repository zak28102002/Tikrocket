# Flavwak redesign — store changes

Source for the changes made to the Shopify theme **"Flavwak Redesign (draft)"**
(`gid://shopify/OnlineStoreTheme/200029569411`, unpublished) plus the backend for
Spin to Win.

- `theme/` — the theme files this work touches, laid out like the theme. The first
  commit holds the untouched originals, so `git diff d57c5c1 -- flavwak/theme` shows
  exactly what changed. These files are uploaded to the draft theme as-is.
- `spin-service/` — the Spin to Win backend (see its README).

## What changed

| Area | Files | Change |
|---|---|---|
| Announcement banner | `sections/announcement-bar.liquid` | Marquee runs at a constant **55 px/s** (was ~240 px/s): ~30–35 s for a message to cross a laptop screen, same speed on phones. Scrolls right-to-left, pauses on hover/focus, seamless loop, static text with reduced motion. New setting *Marquee speed*. |
| Single / Duo | `config/settings_data.json` | The duplicate selector came from the **Section Store** app's bundle embed. It is now disabled in this theme; the theme's own 1 / 2 / 3-pack buy box (`fw-product`) and the automatic multi-pack discounts are untouched. |
| Desktop header | `sections/header.liquid`, `snippets/header-dropdown-menu.liquid` | ≥ 990 px: logo left · **Shop miswak** on the true centre (CSS grid with equal side tracks) · How it works / Our story / FAQ + search, account, cart on the right. The menu's own "Shop" link (same URL as the button) is hidden on desktop only. Two new header settings switch either behaviour off. Mobile and tablet render exactly as before. |
| Videos | `sections/fw-videos.liquid`, `assets/flavwak.css`, `assets/flavwak.js`, `assets/fw-ugc-*`, `templates/index.json`, `templates/product*.json` | **FW Vertical videos**: three UGC clips, muted autoplay loop, tap for sound; above the flavour picker on the homepage and under the buy box on every product page. |
| Spin to Win | `sections/fw-spin-wheel.liquid`, `assets/fw-spin.js`, `assets/fw-spin.css`, `sections/header-group.json` | Popup wheel on every page (header group) with four fixed Shopify codes. |
| Sale pricing | `sections/fw-product.liquid`, `sections/fw-flavors.liquid`, `assets/flavwak.css`, `templates/product.json` | Pack cards show the paid price, the was-price crossed out and the % off, plus a *Free UK shipping* row on each card. Flavour cards on the homepage show the same. Also fixes the 2/3-pack prices, which were worked out from an old £9.90 price. |
| Flash sale banner | `snippets/fw-flash-sale.liquid`, `config/settings_schema.json`, `assets/flavwak.css`, `assets/flavwak.js` | Red banner above the pack options and the flavour picker; optional countdown to a real end time. |
| Top banner | `sections/header-group.json` | "FREE UK SHIPPING · FREE SHIPPING TO EUROPE ON ORDERS £40+". |

## Videos

Three UGC clips are live in **FW Vertical videos** (theme assets, H.264/AAC, faststart,
each with a cover image):

1. `fw-ugc-1.mp4` (44 s, sound) — plastic toothbrush vs miswak, strongest hook, shown first;
2. `fw-ugc-2.mp4` (37 s, sound) — Flavwak packs review;
3. `fw-ugc-3.mp4` (13 s, no audio track) — chewing close-up.

Placed in two spots for conversion:

- homepage, directly above the flavour picker (button: "Choose your flavor");
- every product page, directly under the buy box (button: "Choose your pack", scrolls
  back to the buy box).

Behaviour: plays muted on a loop while on screen, pauses off screen, tap = sound on
(restarts from the beginning, only one video with sound at a time), tap again = sound
off, small pause button bottom-left. Clips without an audio track hide the sound badge
and tap pauses/plays instead. Visitors with reduced motion get a play button instead
of autoplay. Nothing downloads until the section is on screen.

With one video the section shows a single featured video beside the text; with two or
three it switches to a grid (desktop) / swipe carousel (mobile). Empty slots never show
to customers.

**Replacing or adding clips:** theme editor → homepage / product template → **FW
Vertical videos** → a *Video* block → pick a file under *Video (9:16 vertical)*
(Shopify Files, transcoded by Shopify). That overrides the theme-asset file name.

## Spin to Win

Runs entirely in the theme (**FW Spin to win** in the header group). No server needed.

- Prizes are four fixed Shopify discount codes created in Discounts as *Spin to Win
  5% / 10% / 20% / 35%*: no end date, all products and customers, **one use per
  customer**, don't combine with other discounts (free shipping still applies).
- Odds (default 60 / 20 / 3 / 1 / 16% no prize) and the codes are set in the theme
  editor → header → **FW Spin to win**. Leave a code empty and the wheel is hidden.
- The popup opens 1 s after a visitor's first page view, over a dimmed background.
  One spin per browser: the result is remembered, a won code stays in a corner
  badge on every page, and the wheel is not offered again. Closing without spinning
  leaves a small "Spin to win" button; it doesn't pop up again that visit.
- The prize is drawn in the browser (crypto RNG) and the codes are embedded encoded,
  not as plain text. A technical visitor could still dig them out of the page; each
  code can only be used once per customer, and you can rotate a code any time
  (change it in Discounts and in the theme setting).

`spin-service/` holds an optional server-side version (codes created per win, exact
48 h expiry, cross-device limits) if you ever want the stricter setup; it is not used
by the theme now.

## Sale pricing

The was-price is each variant's **compare-at price** in Shopify (set to £17.90 on all five
flavours). Nothing is hard-coded in the theme:

| Option | Was | Pay | Off |
|---|---|---|---|
| 1 pack | £17.90 | £13.90 | −22% |
| 2 packs | £35.80 | £26.00 | −27% |
| 3 packs | £53.70 | £37.00 | −31% |

The 2- and 3-pack prices are the real automatic discounts (£1.80 and £4.70 off), so the
cart always charges what the card shows. To end the sale, clear the compare-at price on the
products: the cards fall back to showing only the genuine multi-pack saving.

EU shoppers: EU price rules expect a was-price to be the lowest price charged in the 30
days before the discount.

## Flash sale banner

Theme settings → **Flash sale**: on/off, banner text and an optional **Sale ends** time
(format `2026-10-25 23:59`, the store's time zone). With no end time the banner shows the
sale with no countdown. With an end time it counts down to it and hides when it passes. It
never restarts per visitor: a timer that resets while the price stays the same is a fake
urgency claim under UK consumer law (DMCC Act 2024).
