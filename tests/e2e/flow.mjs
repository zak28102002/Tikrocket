// End-to-end smoke of the core workflow in the demo workspace.
// node tests/e2e/flow.mjs <outDir>
import { chromium } from "@playwright/test";
const out = process.argv[2];
const base = process.env.BASE ?? "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(p.url() + " :: " + e.message.split("\n").filter((l) => /^\s*[+-]\s/.test(l)).join(" / ").slice(0, 600)));
const step = (s) => console.log("•", s);

await p.goto(`${base}/login`);
await p.fill("#email", "demo@pulse.local");
await p.fill("#password", "pulse-demo-2026");
await p.click("button[type=submit]");
await p.waitForURL((u) => u.pathname === "/");
step("signed in");

await p.getByRole("button", { name: "New app" }).first().click();
await p.getByLabel("App name").fill("Snapnote");
await p.getByPlaceholder(/What does this app do/).fill("Voice notes that write themselves.");
await p.screenshot({ path: `${out}/flow_1_new_app.png` });
await p.getByRole("button", { name: "Create app" }).click();
await p.waitForURL(/\/apps\//);
await p.getByText("No social accounts connected").waitFor();
step("app created → empty app page");
await p.screenshot({ path: `${out}/flow_2_empty_app.png` });

await p.getByRole("button", { name: "Add account" }).first().click();
await p.getByLabel("Public profile URL").fill("https://www.tiktok.com/@snapnoteapp");
await p.getByText("@snapnoteapp").waitFor();
await p.getByText("Ready").waitFor();
await p.screenshot({ path: `${out}/flow_3_detected.png` });
await p.getByRole("button", { name: "Connect account" }).click();
await p.getByText("Checking profile…").waitFor();
await p.waitForTimeout(900);
await p.screenshot({ path: `${out}/flow_4_progress.png` });
await p.getByText("Account connected").waitFor({ timeout: 60000 });
await p.screenshot({ path: `${out}/flow_5_connected.png` });
step("account connected");
await p.getByRole("button", { name: "Done" }).click();
await p.getByText("@snapnoteapp").first().waitFor();
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/flow_6_app_with_account.png`, fullPage: true });

// Duplicate detection
await p.getByRole("button", { name: "Add account" }).first().click();
await p.getByLabel("Public profile URL").fill("tiktok.com/@snapnoteapp");
await p.getByText("Already in Snapnote").waitFor();
step("duplicate detected");
await p.keyboard.press("Escape");

// Command palette
await p.keyboard.press("Control+k");
await p.getByPlaceholder(/Search apps/).fill("catrot");
await p.getByText("@catrotviral").first().waitFor();
await p.screenshot({ path: `${out}/flow_7_palette.png` });
step("search works");
await p.keyboard.press("Escape");

// Range switching
await p.goto(`${base}/?range=90d`);
await p.getByText("vs previous 90 days").first().waitFor();
step("range switch updates analytics");

// CSV export
const res = await p.request.get(`${base}/api/v1/export?range=7d`);
const csv = await res.text();
console.log("• csv", res.status(), csv.split("\n")[0].replace("﻿", ""), `(${csv.split("\n").length - 2} rows)`);

// Cleanup the app we created.
const apps = await (await p.request.get(`${base}/api/v1/apps`)).json();
const created = apps.apps.find((a) => a.name === "Snapnote");
if (created) await p.request.delete(`${base}/api/v1/apps/${created.id}`, { headers: { origin: base } });
console.log(errors.length ? `page errors: ${errors.join(" | ")}` : "• no page errors");
await b.close();
