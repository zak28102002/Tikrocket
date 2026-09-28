// Visual review helper: signs in and screenshots pages at several widths.
// Usage: node tests/e2e/shots.mjs <outDir> [path...] [--w=1440,375] [--theme=dark]
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const out = args[0];
const opts = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const paths = args.slice(1).filter((a) => !a.startsWith("--"));
const widths = (opts.w ?? "1440").split(",").map(Number);
const base = opts.base ?? "http://localhost:3000";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1, colorScheme: opts.theme === "dark" ? "dark" : "light" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text().slice(0, 300)));
  await page.goto(`${base}/login`);
  await page.fill("#email", opts.email ?? "demo@pulse.local");
  await page.fill("#password", opts.password ?? "pulse-demo-2026");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  for (const p of paths) {
    await page.goto(`${base}${p}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(Number(opts.wait ?? 1600));
    await page.evaluate(async () => {
      for (let y = 0; y < Math.min(document.body.scrollHeight, 9000); y += 600) {
        window.scrollTo(0, y);
        document.querySelectorAll("img[loading=lazy]").forEach((i) => (i.loading = "eager"));
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(800);
    const name = `${out}/${p.replace(/[^a-z0-9]+/gi, "_") || "root"}_${w}${opts.theme === "dark" ? "_dark" : ""}.png`;
    await page.screenshot({ path: name, fullPage: opts.full !== "false" });
    console.log("saved", name);
  }
  await ctx.close();
}
await browser.close();
