import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "playwright";
import { chromium } from "playwright";

const currentDir = dirname(fileURLToPath(import.meta.url));
const COOLIFY_URL = "http://5.161.45.94:8000";
const ENV_PATH = resolve(currentDir, "../.env");

const adminEmail = "lachlan@heywood.net.au";
const adminPassword = `${randomBytes(16).toString("base64url")}!Aa1`;
const adminName = "Lachlan";

const takeScreenshot = async (page: Page, name: string) => {
  await page.screenshot({
    fullPage: true,
    path: resolve(currentDir, `${name}.png`),
  });
  console.log(`  [screenshot] ${name}.png`);
};

const dismissPopups = async (page: Page) => {
  const acceptBtn = page
    .getByText("Accept and Close", { exact: false })
    .first();
  if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await acceptBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }
  const closeButtons = page.locator(
    '[x-on\\:click*="false"], [\\@click*="false"]'
  );
  const count = await closeButtons.count();
  for (let i = 0; i < Math.min(count, 3); i += 1) {
    const btn = closeButtons.nth(i);
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true }).catch(() => null);
      await page.waitForTimeout(500);
    }
  }
};

const register = async (page: Page) => {
  console.log("1. Registering...");
  await page.goto(`${COOLIFY_URL}/register`, { waitUntil: "load" });
  await page.waitForSelector('input[name="name"]', {
    state: "visible",
    timeout: 30_000,
  });
  await page.fill('input[name="name"]', adminName);
  await page.fill('input[name="email"]', adminEmail);
  await page.fill('input[name="password"]', adminPassword);
  await page.fill('input[name="password_confirmation"]', adminPassword);
  await page.click('button[type="submit"]');

  for (let i = 0; i < 15; i += 1) {
    await page.waitForTimeout(2000);
    if (!page.url().includes("/register")) {
      break;
    }
  }
  console.log(`   -> ${page.url()}`);
};

const skipOnboarding = async (page: Page) => {
  if (!page.url().includes("onboarding")) {
    return;
  }
  console.log("2. Skipping onboarding...");
  await page.waitForTimeout(3000);

  const letsGo = page.getByText("Let's go!", { exact: false }).first();
  if (await letsGo.isVisible({ timeout: 3000 }).catch(() => false)) {
    await letsGo.click();
    await page.waitForTimeout(3000);
  }

  const skip = page.getByText("Skip Setup", { exact: false }).first();
  if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(3000);
  }
  console.log(`   -> ${page.url()}`);
};

const enableApi = async (page: Page) => {
  console.log("3. Enabling API...");
  await page.goto(`${COOLIFY_URL}/settings`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await dismissPopups(page);

  const advancedLink = page.getByText("Advanced", { exact: true }).first();
  if (!(await advancedLink.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log("   'Advanced' link not found.");
    await takeScreenshot(page, "03-settings-no-advanced");
    return;
  }

  await advancedLink.click();
  await page.waitForTimeout(3000);
  await takeScreenshot(page, "03-settings-advanced");

  const checkboxes = page.locator('input[type="checkbox"]');
  const cbCount = await checkboxes.count();

  for (let i = 0; i < cbCount; i += 1) {
    const cb = checkboxes.nth(i);
    const wireModel =
      (await cb.getAttribute("wire:model").catch(() => "")) ?? "";
    const wireModelLive =
      (await cb.getAttribute("wire:model.live").catch(() => "")) ?? "";
    const id = (await cb.getAttribute("id").catch(() => "")) ?? "";
    const model = wireModel || wireModelLive;

    if (
      model.toLowerCase().includes("api") ||
      id.toLowerCase().includes("api")
    ) {
      console.log(`   Found API checkbox: wire:model="${model}" id="${id}"`);
      if (await cb.isChecked()) {
        console.log("   API already enabled.");
      } else {
        await cb.evaluate((el: HTMLElement) => el.click());
        await page.waitForTimeout(2000);
        console.log("   API enabled!");
      }
      return;
    }
  }

  console.log("   API toggle not found.");
};

const findTokenInput = async (page: Page): Promise<boolean> => {
  const inputs = page.locator('input[type="text"]');
  const inputCount = await inputs.count();

  for (let i = 0; i < inputCount; i += 1) {
    const input = inputs.nth(i);
    if (await input.isVisible().catch(() => false)) {
      const wireModel =
        (await input.getAttribute("wire:model").catch(() => "")) ?? "";
      const placeholder =
        (await input.getAttribute("placeholder").catch(() => "")) ?? "";

      const isTokenField =
        wireModel.toLowerCase().includes("token") ||
        wireModel.toLowerCase().includes("description") ||
        placeholder.toLowerCase().includes("token") ||
        placeholder.toLowerCase().includes("name") ||
        placeholder.toLowerCase().includes("description");

      if (isTokenField) {
        await input.fill("babytalk-automation");
        console.log("   Filled token name.");
        return true;
      }
    }
  }

  // Fallback: fill first visible text input
  for (let i = 0; i < inputCount; i += 1) {
    const input = inputs.nth(i);
    if (await input.isVisible().catch(() => false)) {
      await input.fill("babytalk-automation");
      console.log("   Filled first visible text input as token name.");
      return true;
    }
  }

  return false;
};

const captureToken = async (page: Page): Promise<string> => {
  const html = await page.content();
  const htmlMatch = html.match(/(\d+\|[A-Za-z0-9]{40,})/);
  if (htmlMatch) {
    const [, token] = htmlMatch;
    console.log("   Token captured!");
    return token;
  }

  const allInputs = page.locator("input");
  const allCount = await allInputs.count();
  for (let i = 0; i < allCount; i += 1) {
    const val = await allInputs
      .nth(i)
      .inputValue()
      .catch(() => "");
    if (val && val.length > 30 && /\d+\|/.test(val)) {
      console.log("   Token captured from input.");
      return val;
    }
  }

  const text = await page.textContent("body").catch(() => "");
  const textMatch = text?.match(/(\d+\|[A-Za-z0-9]{40,})/);
  if (textMatch) {
    const [, token] = textMatch;
    console.log("   Token captured from text.");
    return token;
  }

  return "";
};

const createApiToken = async (page: Page): Promise<string> => {
  console.log("4. Creating API token...");
  await page.goto(`${COOLIFY_URL}/security/api-tokens`, {
    waitUntil: "load",
  });
  await page.waitForTimeout(5000);
  await dismissPopups(page);
  await takeScreenshot(page, "05-api-tokens");

  const bodyText = await page.textContent("body").catch(() => "");
  if (bodyText?.includes("API is disabled")) {
    console.log("   API still disabled. Token creation skipped.");
    return "";
  }

  const filledInput = await findTokenInput(page);
  if (!filledInput) {
    return "";
  }

  // Uncheck "Read Only" if visible and checked
  const readOnly = page.getByLabel(/read.?only/i).first();
  if (
    (await readOnly.isVisible({ timeout: 2000 }).catch(() => false)) &&
    (await readOnly.isChecked())
  ) {
    await readOnly.uncheck();
    console.log("   Unchecked Read Only.");
  }

  const createBtn = page.getByRole("button", { name: /create/i }).first();
  if (!(await createBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    return "";
  }

  await createBtn.click();
  await page.waitForTimeout(5000);
  await takeScreenshot(page, "06-token-created");

  return captureToken(page);
};

const saveCredentials = (apiToken: string) => {
  console.log("5. Saving to .env...");
  const envLines = [
    "# Coolify Instance Configuration",
    `COOLIFY_URL=${COOLIFY_URL}`,
    `COOLIFY_ADMIN_EMAIL=${adminEmail}`,
    `COOLIFY_ADMIN_PASSWORD=${adminPassword}`,
    apiToken
      ? `COOLIFY_API_TOKEN=${apiToken}`
      : "# COOLIFY_API_TOKEN=<enable API in Settings > Advanced, then create at /security/api-tokens>",
    "",
  ].join("\n");

  if (existsSync(ENV_PATH)) {
    const existing = readFileSync(ENV_PATH, "utf8");
    if (!existing.includes("COOLIFY_URL")) {
      writeFileSync(ENV_PATH, `${existing}\n${envLines}`);
    }
  } else {
    writeFileSync(ENV_PATH, envLines);
  }
};

const main = async () => {
  const proxyUrl = process.env.HTTP_PROXY ?? process.env.http_proxy;
  const launchOptions: Record<string, unknown> = { headless: true };
  if (proxyUrl) {
    const parsed = new URL(proxyUrl);
    launchOptions.proxy = {
      password: decodeURIComponent(parsed.password),
      server: `${parsed.protocol}//${parsed.hostname}:${parsed.port}`,
      username: decodeURIComponent(parsed.username),
    };
    console.log(`Using proxy: ${parsed.hostname}:${parsed.port}`);
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await register(page);
  await skipOnboarding(page);
  await enableApi(page);
  await takeScreenshot(page, "04-after-api-enable");

  const apiToken = await createApiToken(page);
  if (!apiToken) {
    console.warn("   Could not capture API token.");
    await takeScreenshot(page, "07-token-failed");
  }

  saveCredentials(apiToken);

  console.log("\n=== Coolify Setup Complete ===");
  console.log(`Dashboard:      ${COOLIFY_URL}`);
  console.log(`Admin email:    ${adminEmail}`);
  console.log(`Admin password: ${adminPassword}`);
  console.log(`API token:      ${apiToken || "(see .env for instructions)"}`);
  console.log(`Env file:       ${ENV_PATH}`);
  console.log("==============================\n");

  await browser.close();
};

try {
  await main();
} catch (error) {
  console.error("Setup failed:", (error as Error).message);
  process.exit(1);
}
