import { chromium } from "playwright";
import { SessionStore } from "./session-store.js";

const authDir = process.env.PLAYWRIGHT_AUTH_DIR || "./data/auth";

async function main() {
  const sessionStore = new SessionStore(authDir);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const page = await context.newPage();

  console.log("Navegando para Mercado Livre...");
  await page.goto("https://www.mercadolivre.com.br");

  console.log(
    "Fac?a login manualmente. Pressione Enter no terminal quando terminar.",
  );
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });

  const storageState = await context.storageState();
  sessionStore.save("mercadolivre", JSON.stringify(storageState));
  console.log("Sessao salva em", sessionStore.pathFor("mercadolivre"));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
