import { open, unlink } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import dotenv from "dotenv";
import { SessionStore } from "./session-store.js";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const workerUrl = process.env.WORKER_LOCAL_URL || "http://127.0.0.1:3001";
const token = process.env.WORKER_SERVICE_TOKEN;
const authDir =
  process.env.MERCADOLIVRE_AFFILIATE_LOCAL_AUTH_DIR || "./data/auth";
const sessionName =
  process.env.MERCADOLIVRE_AFFILIATE_SESSION_NAME || "mercadolivre-affiliate";
const lockPath = path.resolve("./data/mercadolivre-affiliate-queue.lock");

if (!token) throw new Error("WORKER_SERVICE_TOKEN is required");
async function workerRequest<T>(route: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${workerUrl}${route}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok)
    throw new Error(`Worker request failed: ${response.status}`);
  return (await response.json()) as T;
}

async function main() {
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch {
    return;
  }

  try {
    const queue = await workerRequest<{ offers: Array<{ id: string }> }>(
      "/v1/offers?status=needs_affiliate_link&limit=25",
    );
    if (queue.offers.length === 0) return;

    const details = await Promise.all(
      queue.offers.map((offer) =>
        workerRequest<{ id: string; canonicalUrl: string }>(
          `/v1/offers/${offer.id}/affiliate-link-data`,
        ),
      ),
    );
    const sessionStore = new SessionStore(authDir);
    const session = sessionStore.load(sessionName);
    if (!session) throw new Error("Mercado Livre affiliate session is missing");

    const browser = await chromium.launch({ headless: false });
    try {
      const context = await browser.newContext({
        storageState: JSON.parse(session),
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      const generateLinks = async (urls: string[]): Promise<string[]> => {
        await page.goto(
          "https://www.mercadolivre.com.br/afiliados/linkbuilder#hub",
          { waitUntil: "domcontentloaded", timeout: 30_000 },
        );
        await page.waitForTimeout(2_000);
        if (!/linkbuilder/.test(page.url())) {
          throw new Error("Mercado Livre affiliate session expired");
        }
        const field = page
          .getByPlaceholder(/Insira 1 ou mais URLs/i)
          .or(page.locator("textarea:visible"))
          .first();
        await field.fill(urls.join("\n"));
        await page.getByRole("button", { name: "Gerar", exact: true }).click();
        await page
          .getByText(/Copie (?:o link|seus links) e comece/i)
          .first()
          .waitFor({
            timeout: 20_000,
          });
        const values = await page
          .locator("input, textarea")
          .evaluateAll((elements: Array<{ value?: string }>) =>
            elements.flatMap((element) => (element.value || "").split(/\s+/)),
          );
        return [
          ...new Set(
            values.filter((value) => /^https:\/\/meli\.la\//.test(value)),
          ),
        ];
      };

      let links: string[] = [];
      let failed = 0;
      try {
        links = await generateLinks(details.map((item) => item.canonicalUrl));
        if (links.length !== details.length) {
          throw new Error(`Expected ${details.length} affiliate links, received ${links.length}`);
        }
      } catch (error) {
        console.warn(`${error instanceof Error ? error.message : error}; retrying individually`);
        links = [];
        for (const detail of details) {
          try {
            const individual = await generateLinks([detail.canonicalUrl]);
            if (individual.length !== 1) throw new Error("Expected one affiliate link");
            links.push(individual[0]);
          } catch (individualError) {
            console.error(`Affiliate link failed for ${detail.id}: ${individualError instanceof Error ? individualError.message : individualError}`);
            links.push("");
            failed++;
          }
        }
      }

      for (const [index, detail] of details.entries()) {
        if (!links[index]) continue;
        try {
          await workerRequest(`/v1/offers/${detail.id}/affiliate-link`, {
            method: "POST",
            body: JSON.stringify({ affiliateUrl: links[index] }),
          });
        } catch (error) {
          console.error(`Affiliate completion failed for ${detail.id}: ${error instanceof Error ? error.message : error}`);
          failed++;
        }
      }
      sessionStore.save(
        sessionName,
        JSON.stringify(await context.storageState()),
      );
      console.log(
        `${details.length - failed} Mercado Livre affiliate link(s) generated, ${failed} failed`,
      );
      if (failed > 0) process.exitCode = 1;
    } finally {
      await browser.close();
    }
  } finally {
    await lock?.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
