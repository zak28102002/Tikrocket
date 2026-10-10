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
| Videos | `sections/fw-videos.liquid`, `assets/flavwak.css`, `assets/flavwak.js`, `templates/index.json` | New **FW Vertical videos** section on the homepage between *How it works* and the FAQ: three 9:16 slots, 3 columns on desktop, swipeable on mobile. |
| Spin to Win | `sections/fw-spin-wheel.liquid`, `assets/fw-spin.js`, `assets/fw-spin.css`, `sections/header-group.json`, `spin-service/` | Popup wheel on every page (header group), driven entirely by the spin service. |

## Videos

The first clip (`assets/fw-ugc-1.mp4`, 13 s, 9:16, with cover `fw-ugc-1-poster.jpg`) is
live in **FW Vertical videos** in two places:

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

**Adding videos 2 and 3:** theme editor → homepage (and the product template) →
**FW Vertical videos** → *Video 2* / *Video 3* → pick a file under *Video (9:16
vertical)* (uploads to Shopify Files and is transcoded by Shopify). The theme-asset
field is only an alternative for files uploaded with the theme.

## Spin to Win — what is still needed to go live

The theme part is installed but stays invisible until the backend answers at
`/apps/flavwak-spin/state`. To switch it on:

1. Create a Dev Dashboard app for the store with scopes
   `write_discounts, read_discounts, read_customers` and an **App Proxy**
   (`apps` / `flavwak-spin` → `https://<service>/proxy`) — see
   `spin-service/shopify.app.toml.example`. Install it on the store.
2. Deploy `spin-service/` (Railway config and Dockerfile included) with a Postgres
   database and the variables in `spin-service/.env.example`.
3. Open `https://flavwak.com/apps/flavwak-spin/state` — it should return JSON with
   `"ok":true`. Then preview the draft theme: the wheel appears after 3 s.

Theme editor → header group → **FW Spin to win** has the texts, delay, proxy path,
an on/off switch and an editor preview. Odds and prizes live only in
`spin-service/src/prizes.ts`.
