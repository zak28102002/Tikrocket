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
| Spin to Win | `sections/fw-spin-wheel.liquid`, `assets/fw-spin.js`, `assets/fw-spin.css`, `sections/header-group.json`, `spin-service/` | Popup wheel on every page (header group), driven entirely by the spin service. |

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
