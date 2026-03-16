import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "playwright";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOLIFY_URL = "http://5.161.45.94:8000";
const DOMAIN = "hosting.devbox.party";

// Read credentials from .env
const envContent = readFileSync(resolve(__dirname, "../.env"), "utf8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#][^=]+)=(.+)$/);
  if (match) {
    const [, key, value] = match;
    env[key.trim()] = value.trim();
  }
}

const screenshot = async (page: Page, name: string) => {
  await page.screenshot({
    fullPage: true,
    path: resolve(__dirname, `${name}.png`),
  });
  console.log(`  [screenshot] ${name}.png`);
};

const dismissPopups = async (page: Page) => {
  for (const text of ["Accept and Close", "Acknowledge & Disable This Popup"]) {
    const btn = page.getByText(text, { exact: false }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
};

const login = async (page: Page) => {
  console.log("1. Logging in...");
  await page.goto(`${COOLIFY_URL}/login`, { waitUntil: "load" });
  await page.waitForSelector('input[name="email"]', {
    state: "visible",
    timeout: 30_000,
  });
  await page.fill('input[name="email"]', env.COOLIFY_ADMIN_EMAIL);
  await page.fill('input[name="password"]', env.COOLIFY_ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  for (let i = 0; i < 10; i += 1) {
    await page.waitForTimeout(2000);
    if (!page.url().includes("/login")) {
      break;
    }
  }
  console.log(`   -> ${page.url()}`);
};

const setFqdn = async (page: Page) => {
  console.log("2. Setting FQDN...");
  await page.goto(`${COOLIFY_URL}/settings`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await dismissPopups(page);

  // Find the URL input (placeholder contains "yourdomain")
  const inputs = page.locator('input[type="text"]');
  const count = await inputs.count();
  for (let i = 0; i < count; i += 1) {
    const input = inputs.nth(i);
    if (await input.isVisible().catch(() => false)) {
      const placeholder =
        (await input.getAttribute("placeholder").catch(() => "")) || "";
      if (
        placeholder.includes("yourdomain") ||
        placeholder.includes("coolify")
      ) {
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
};

const enableApi = async (page: Page) => {
  console.log("3. Ensuring API is enabled...");
  const advancedLink = page.getByText("Advanced", { exact: true }).first();
  if (await advancedLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await advancedLink.click();
    await page.waitForTimeout(3000);

    const checkboxes = page.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    for (let i = 0; i < cbCount; i += 1) {
      const cb = checkboxes.nth(i);
      const model = (await cb.getAttribute("wire:model").catch(() => "")) || "";
      if (model.includes("api")) {
        if (await cb.isChecked()) {
          console.log("   API already enabled.");
        } else {
          await cb.evaluate((el: HTMLElement) => el.click());
          await page.waitForTimeout(2000);
          console.log("   API enabled.");
        }
        break;
      }
    }
  }
};

const fetchServerUuid = async (): Promise<string | null> => {
  if (!env.COOLIFY_API_TOKEN) {
    return null;
  }

  try {
    const response = await fetch(`${COOLIFY_URL}/api/v1/servers`, {
      headers: { Authorization: `Bearer ${env.COOLIFY_API_TOKEN}` },
    });
    const servers: unknown = await response.json();
    if (Array.isArray(servers) && servers.length > 0) {
      return (servers[0] as Record<string, unknown>).uuid as string;
    }
    return null;
  } catch {
    return null;
  }
};

const startProxy = async (page: Page) => {
  console.log("4. Starting proxy...");

  const serverUUID = await fetchServerUuid();

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
    await page.waitForTimeout(20_000);
    await screenshot(page, "02-proxy-starting");
  } else {
    console.log("   Start Proxy button not found.");
    // Check all buttons
    const allBtns = page.locator("button");
    const btnCount = await allBtns.count();
    for (let i = 0; i < btnCount; i += 1) {
      const btn = allBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        const rawText = await btn.textContent().catch(() => "");
        const text = rawText?.trim() || "";
        if (
          text.toLowerCase().includes("proxy") ||
          text.toLowerCase().includes("start")
        ) {
          console.log(`   Button: "${text}"`);
        }
      }
    }
  }
};

const waitForProxy = async (page: Page) => {
  console.log("5. Waiting for proxy to start...");
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.waitForTimeout(10_000);
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
};

const main = async () => {
  const proxyUrl = process.env.HTTP_PROXY || process.env.http_proxy;
  const launchOptions: Record<string, unknown> = { headless: true };
  if (proxyUrl) {
    const parsed = new URL(proxyUrl);
    launchOptions.proxy = {
      password: decodeURIComponent(parsed.password),
      server: `${parsed.protocol}//${parsed.hostname}:${parsed.port}`,
      username: decodeURIComponent(parsed.username),
    };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { height: 1080, width: 1920 },
  });
  const page = await context.newPage();

  await login(page);
  await setFqdn(page);
  await enableApi(page);
  await startProxy(page);
  await waitForProxy(page);

  await screenshot(page, "03-final");
  console.log("   Done!");
  await browser.close();
};

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed: ${message}`);
  process.exit(1);
}
