import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOLIFY_URL = "http://5.161.45.94:8000";
const DOMAIN = "hosting.devbox.party";

// Read credentials from .env
const envContent = readFileSync(resolve(__dirname, "../.env"), "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#][^=]+)=(.+)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

async function screenshot(page: any, name: string) {
  await page.screenshot({ path: resolve(__dirname, `${name}.png`), fullPage: true });
  console.log(`  [screenshot] ${name}.png`);
}

async function dismissPopups(page: any) {
  for (const text of ["Accept and Close", "Acknowledge & Disable This Popup"]) {
    const btn = page.getByText(text, { exact: false }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
}

async function main() {
  const proxyUrl = process.env.HTTP_PROXY || process.env.http_proxy;
  const launchOptions: any = { headless: true };
  if (proxyUrl) {
    const parsed = new URL(proxyUrl);
    launchOptions.proxy = {
      server: `${parsed.protocol}//${parsed.hostname}:${parsed.port}`,
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // Login
  console.log("1. Logging in...");
  await page.goto(`${COOLIFY_URL}/login`, { waitUntil: "load" });
  await page.waitForSelector('input[name="email"]', { state: "visible", timeout: 30000 });
  await page.fill('input[name="email"]', env.COOLIFY_ADMIN_EMAIL);
  await page.fill('input[name="password"]', env.COOLIFY_ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2000);
    if (!page.url().includes("/login")) break;
  }
  console.log(`   -> ${page.url()}`);

  // Step A: Set FQDN in Settings
  console.log("2. Setting FQDN...");
  await page.goto(`${COOLIFY_URL}/settings`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await dismissPopups(page);

  // Find the URL input (placeholder contains "yourdomain")
  const inputs = page.locator('input[type="text"]');
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    if (await input.isVisible().catch(() => false)) {
      const placeholder = (await input.getAttribute("placeholder").catch(() => "")) || "";
      if (placeholder.includes("yourdomain") || placeholder.includes("coolify")) {
        await input.clear();
        await input.fill(`https://${DOMAIN}`);
        console.log(`   Set URL to https://${DOMAIN}`);
        break;
      }
    }
  }

  // Save
  const saveBtn = page.getByRole("button", { name: /save/i }).first();
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(3000);
    console.log("   Settings saved.");
  }

  // Step B: Enable API (in case it was reset)
  console.log("3. Ensuring API is enabled...");
  const advancedLink = page.getByText("Advanced", { exact: true }).first();
  if (await advancedLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await advancedLink.click();
    await page.waitForTimeout(3000);

    const checkboxes = page.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    for (let i = 0; i < cbCount; i++) {
      const cb = checkboxes.nth(i);
      const model = (await cb.getAttribute("wire:model").catch(() => "")) || "";
      if (model.includes("api")) {
        if (!(await cb.isChecked())) {
          await cb.evaluate((el: HTMLElement) => el.click());
          await page.waitForTimeout(2000);
          console.log("   API enabled.");
        } else {
          console.log("   API already enabled.");
        }
        break;
      }
    }
  }

  // Step C: Navigate to server proxy page directly
  console.log("4. Starting proxy...");

  // Use the server UUID from the API
  const serverUUID = env.COOLIFY_API_TOKEN
    ? await fetch(`${COOLIFY_URL}/api/v1/servers`, {
        headers: { Authorization: `Bearer ${env.COOLIFY_API_TOKEN}` },
      })
        .then((r: any) => r.json())
        .then((s: any) => s[0]?.uuid)
        .catch(() => null)
    : null;

  const proxyPageUrl = `${COOLIFY_URL}/server/${serverUUID || "hfbqjiy2sx09u1xoleaiqcan"}/proxy`;
  await page.goto(proxyPageUrl, { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await dismissPopups(page);
  await page.waitForTimeout(2000);
  await dismissPopups(page);

  await screenshot(page, "01-proxy-page");
  console.log(`   Proxy page: ${page.url()}`);

  // Click "Start Proxy" button
  const startBtn = page.getByRole("button", { name: /start proxy/i }).first();
  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log("   Clicking Start Proxy...");
    await startBtn.click();
    await page.waitForTimeout(20000);
    await screenshot(page, "02-proxy-starting");
  } else {
    console.log("   Start Proxy button not found.");
    // Check all buttons
    const allBtns = page.locator("button");
    const btnCount = await allBtns.count();
    for (let i = 0; i < btnCount; i++) {
      const btn = allBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        const text = (await btn.textContent().catch(() => ""))?.trim() || "";
        if (text.toLowerCase().includes("proxy") || text.toLowerCase().includes("start")) {
          console.log(`   Button: "${text}"`);
        }
      }
    }
  }

  // Wait and check port 443
  console.log("5. Waiting for proxy to start...");
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.waitForTimeout(10000);
    try {
      const resp = await page.request.get(`https://${DOMAIN}`, {
        ignoreHTTPSErrors: true,
        timeout: 5000,
      });
      console.log(`   Attempt ${attempt + 1}: HTTPS ${resp.status()}`);
      if (resp.status() !== 502 && resp.status() !== 503) {
        console.log("   Proxy is up!");
        break;
      }
    } catch {
      console.log(`   Attempt ${attempt + 1}: not yet...`);
    }
  }

  await screenshot(page, "03-final");
  console.log("   Done!");
  await browser.close();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
