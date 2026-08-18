import { chromium, type Browser, type BrowserContextOptions } from "playwright";

const MAX_CONCURRENCY = Number(process.env.PLAYWRIGHT_MAX_CONCURRENCY || "1");

export class BrowserPool {
  private browser: Browser | null = null;
  private activeCount = 0;
  private readonly maxConcurrency = MAX_CONCURRENCY;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
      });
    }
    return this.browser;
  }

  async acquire(options: BrowserContextOptions = {}) {
    if (this.activeCount >= this.maxConcurrency) {
      throw new Error("Browser concurrency limit reached");
    }
    this.activeCount++;
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      locale: process.env.PLAYWRIGHT_LOCALE || "pt-BR",
      timezoneId: process.env.PLAYWRIGHT_TIMEZONE_ID || "America/Sao_Paulo",
      ...options,
    });
    return context;
  }

  release() {
    this.activeCount = Math.max(0, this.activeCount - 1);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const browserPool = new BrowserPool();
