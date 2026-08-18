import "dotenv/config";
import { chromium } from "playwright";
import { SessionStore } from "./session-store.js";

const authDir =
  process.env.MERCADOLIVRE_AFFILIATE_LOCAL_AUTH_DIR || "./data/auth";
const sessionName =
  process.env.MERCADOLIVRE_AFFILIATE_SESSION_NAME || "mercadolivre-affiliate";
const portalUrl =
  process.env.MERCADOLIVRE_AFFILIATE_PORTAL_URL ||
  "https://www.mercadolivre.com.br/afiliados/hub?is_affiliate=true#menu-user";

async function main() {
  const sessionStore = new SessionStore(authDir);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const page = await context.newPage();

  console.log("Abrindo o Portal do Afiliado do Mercado Livre...");
  await page.goto(portalUrl, { waitUntil: "domcontentloaded" });
  console.log(
    "Entre na conta, abra o gerador de links e pressione Enter neste terminal.",
  );
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });

  const storageState = await context.storageState();
  sessionStore.save(sessionName, JSON.stringify(storageState));
  console.log("Sessao salva em", sessionStore.pathFor(sessionName));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
