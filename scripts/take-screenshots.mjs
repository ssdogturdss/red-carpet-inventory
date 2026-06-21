import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`;
const OUT = "/home/runner/workspace/screenshots";
mkdirSync(OUT, { recursive: true });

// iPhone 6.5" @3x → 1242×2688
const PORT_414 = { width: 414, height: 896, dpr: 3 };
// iPhone 6.7" @3x → 1284×2778
const PORT_428 = { width: 428, height: 926, dpr: 3 };
// Landscape 6.5" @3x → 2688×1242
const LAND_414 = { width: 896, height: 414, dpr: 3 };

async function makePage(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
  });
  const page = await ctx.newPage();
  return { page, ctx };
}

async function shot(page, name) {
  await page.waitForTimeout(1800);
  const file = join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("✓", name);
}

async function loginAsAdmin(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.locator("text=Admin").first().click();
  await page.waitForTimeout(2000);
}

async function navigateToTab(page, label) {
  // Expo tab bar uses accessible labels or text
  const tab = page.locator(`[aria-label="${label}"]`).first();
  const fallback = page.locator(`text=${label}`).last();
  try {
    await tab.click({ timeout: 4000 });
  } catch {
    await fallback.click({ timeout: 4000 });
  }
  await page.waitForTimeout(1500);
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // ─── 10 PORTRAIT SCREENSHOTS at 1242×2688 (414×896 @3x) ───────────────────

  const { page: p1, ctx: c1 } = await makePage(browser, PORT_414);

  // 01 Login screen
  await p1.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await p1.waitForTimeout(2500);
  await shot(p1, "01-login.png");

  // Log in
  await p1.locator("text=Admin").first().click();
  await p1.waitForTimeout(2500);

  // 02 Dashboard / home
  await shot(p1, "02-dashboard.png");

  // 03 Count Entry – all unfilled (amber)
  await navigateToTab(p1, "Count");
  await shot(p1, "03-count-entry-unfilled.png");

  // 04 Count Entry – store selected + some fields filled
  try {
    await p1.locator("text=Select your store").first().click({ timeout: 3000 });
    await p1.waitForTimeout(800);
    await p1.locator("text=Store 1").first().click({ timeout: 3000 });
    await p1.waitForTimeout(800);
    // Fill a few chemical rows
    const inputs = await p1.locator('input[inputmode="decimal"]').all();
    for (let i = 0; i < Math.min(5, inputs.length); i++) {
      await inputs[i].fill(String(10 + i * 5));
      await p1.waitForTimeout(200);
    }
  } catch {}
  await shot(p1, "04-count-entry-filled.png");

  // 05 Scan Sheet
  await navigateToTab(p1, "Scan");
  await shot(p1, "05-scan-sheet.png");

  // 06 History / Inventory Hub
  await navigateToTab(p1, "History");
  await shot(p1, "06-history.png");

  // 07 History – scroll down a bit
  await p1.mouse.wheel(0, 400);
  await p1.waitForTimeout(800);
  await shot(p1, "07-history-detail.png");

  // 08 Admin Panel
  await navigateToTab(p1, "Admin");
  await shot(p1, "08-admin-panel.png");

  // 09 Admin – Stores tab
  try {
    await p1.locator("text=Stores").first().click({ timeout: 3000 });
    await p1.waitForTimeout(1000);
  } catch {}
  await shot(p1, "09-admin-stores.png");

  // 10 Back to dashboard (final hero shot)
  try {
    await p1.locator('[aria-label="index"]').first().click({ timeout: 3000 });
  } catch {
    try {
      await p1.locator("text=Dashboard").first().click({ timeout: 3000 });
    } catch {}
  }
  await p1.waitForTimeout(1500);
  await p1.mouse.wheel(0, 200);
  await p1.waitForTimeout(800);
  await shot(p1, "10-dashboard-alerts.png");
  await c1.close();

  // ─── 3 APP PREVIEW LANDSCAPE IMAGES at 2688×1242 (896×414 @3x) ────────────

  const { page: p2, ctx: c2 } = await makePage(browser, LAND_414);

  await loginAsAdmin(p2);
  await shot(p2, "preview-01-dashboard-landscape.png");

  await navigateToTab(p2, "Count");
  await shot(p2, "preview-02-count-landscape.png");

  await navigateToTab(p2, "History");
  await shot(p2, "preview-03-history-landscape.png");
  await c2.close();

  await browser.close();
  console.log("\nAll done →", OUT);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
