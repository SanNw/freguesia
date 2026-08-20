import { mercadoLivreEnv as env } from "../../config/runtime.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";
import { browserPool } from "../browser/browser-pool.js";
import { detectBlocked, detectCaptcha } from "../browser/captcha-detector.js";
import { SessionStore } from "../browser/session-store.js";

const authDir = process.env.PLAYWRIGHT_AUTH_DIR || "./data/auth";

function isGeneratedLink(value: string, sourceUrl: string): boolean {
  try {
    const candidate = new URL(value.trim());
    if (candidate.toString() === sourceUrl) return false;
    return (
      candidate.protocol === "https:" &&
      (candidate.hostname === "mercadolivre.com" ||
        candidate.hostname.endsWith(".mercadolivre.com") ||
        candidate.hostname === "mercadolivre.com.br" ||
        candidate.hostname.endsWith(".mercadolivre.com.br") ||
        candidate.hostname === "meli.la" ||
        candidate.hostname.endsWith(".meli.la"))
    );
  } catch {
    return false;
  }
}

async function findGeneratedLink(
  page: import("playwright").Page,
  sourceUrl: string,
): Promise<string | null> {
  const fieldValues = await page
    .locator("input, textarea")
    .evaluateAll((elements: Array<{ value?: string }>) =>
      elements.map((element) => element.value ?? ""),
    );
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((elements: Array<{ href?: string }>) =>
      elements.map((element) => element.href ?? ""),
    );
  return (
    [...fieldValues, ...hrefs].find((value) =>
      isGeneratedLink(value, sourceUrl),
    ) ?? null
  );
}

export async function generateMercadoLivreAffiliateLink(
  canonicalUrl: string,
): Promise<AffiliateLinkResult> {
  if (!env.MERCADOLIVRE_AFFILIATE_AUTOMATION_ENABLED) {
    return { status: "unsupported", reason: "affiliate_automation_disabled" };
  }
  const sessionStore = new SessionStore(authDir);
  const session = sessionStore.load(env.MERCADOLIVRE_AFFILIATE_SESSION_NAME);
  if (!session) return { status: "session_expired" };

  const context = await browserPool.acquire({
    storageState: JSON.parse(session),
  });
  try {
    const page = await context.newPage();
    await page.goto(env.MERCADOLIVRE_AFFILIATE_PORTAL_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    const content = await page.content();
    if (detectCaptcha(content) || detectBlocked(content)) {
      return { status: "captcha_required" };
    }
    if (
      /login|auth|registration/i.test(page.url()) ||
      (await page.getByText(/entrar|iniciar sess[aã]o/i).count()) > 0
    ) {
      return { status: "session_expired" };
    }

    let urlField = page
      .locator(
        'input[type="url"]:visible, textarea:visible, input[type="text"]:visible',
      )
      .first();
    if ((await urlField.count()) === 0) {
      const toolsEntry = page
        .getByRole("link", { name: /ferramentas/i })
        .or(page.getByRole("button", { name: /ferramentas/i }))
        .first();
      if ((await toolsEntry.count()) > 0) {
        await toolsEntry.click();
        await page.waitForTimeout(500);
      }
      const generatorEntry = page
        .getByRole("link", {
          name: /gerar links?|gerador de links?|criador de links?/i,
        })
        .or(
          page.getByRole("button", {
            name: /gerar links?|gerador de links?|criador de links?/i,
          }),
        )
        .first();
      if ((await generatorEntry.count()) > 0) {
        await generatorEntry.click();
        await page.waitForLoadState("domcontentloaded");
      } else {
        await page.goto(
          "https://www.mercadolivre.com.br/afiliados/linkbuilder#hub",
          { waitUntil: "domcontentloaded", timeout: 30_000 },
        );
      }
      urlField = page
        .locator(
          'input[type="url"]:visible, textarea:visible, input[type="text"]:visible',
        )
        .first();
      if ((await urlField.count()) === 0) {
        await page.screenshot({
          path: `${process.env.PLAYWRIGHT_SCREENSHOT_DIR || "/app/data/screenshots"}/mercadolivre-affiliate-debug.png`,
          fullPage: true,
        });
        return {
          status: "unsupported",
          reason: "affiliate_url_field_not_found",
        };
      }
    }
    await urlField.fill(canonicalUrl);

    const generateButton = page
      .getByRole("button", { name: /gerar|criar|transformar|obter link/i })
      .first();
    if ((await generateButton.count()) === 0) {
      return {
        status: "unsupported",
        reason: "affiliate_generate_button_not_found",
      };
    }
    await generateButton.click();
    await page.waitForTimeout(1_500);

    const afterContent = await page.content();
    if (detectCaptcha(afterContent) || detectBlocked(afterContent)) {
      return { status: "captcha_required" };
    }
    const generated = await findGeneratedLink(page, canonicalUrl);
    if (!generated) {
      return { status: "unsupported", reason: "affiliate_result_not_found" };
    }
    const storageState = await context.storageState();
    sessionStore.save(
      env.MERCADOLIVRE_AFFILIATE_SESSION_NAME,
      JSON.stringify(storageState),
    );
    return { status: "generated", url: generated };
  } finally {
    await context.close();
    browserPool.release();
  }
}
