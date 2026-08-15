import { z } from "zod";

const booleanString = z
  .string()
  .transform((v) => v === "true" || v === "1" || v === "yes");

const envSchema = z.object({
  APP_NAME: z.string().default("Freguesia"),
  APP_ENV: z.enum(["development", "test", "staging", "production"]),
  APP_VERSION: z.string().default("0.1.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TZ: z.string().default("America/Sao_Paulo"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_PRETTY: booleanString.default("false"),

  WORKER_HOST: z.string().default("0.0.0.0"),
  WORKER_PORT: z.coerce.number().default(3001),
  WORKER_PUBLIC_BASE_URL: z.string().url(),
  WORKER_INTERNAL_BASE_URL: z.string().url(),
  WORKER_SERVICE_TOKEN: z.string().min(16),
  WORKER_REQUEST_TIMEOUT_MS: z.coerce.number().default(120000),
  WORKER_BODY_LIMIT_BYTES: z.coerce.number().default(1048576),
  WORKER_ALLOWED_ORIGINS: z.string().default(""),

  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().default(15000),

  DEFAULT_CURRENCY: z.string().length(3).default("BRL"),
  MIN_DISCOUNT_PERCENT: z.coerce.number().default(20),
  MAX_AUTOMATIC_DISCOUNT_PERCENT: z.coerce.number().default(80),
  MIN_PRICE_CENTS: z.coerce.number().default(100),
  MAX_PRICE_CENTS: z.coerce.number().default(5000000),
  MAX_OFFER_AGE_MINUTES: z.coerce.number().default(30),
  REVALIDATE_BEFORE_PUBLISH: booleanString.default("true"),
  REPOST_COOLDOWN_HOURS: z.coerce.number().default(168),
  REPOST_MIN_PRICE_DROP_PERCENT: z.coerce.number().default(10),
  MAX_OFFERS_PER_RUN: z.coerce.number().default(25),
  MAX_PUBLICATIONS_PER_HOUR: z.coerce.number().default(6),
  MAX_PUBLICATIONS_PER_DAY: z.coerce.number().default(40),
  PUBLICATION_MIN_INTERVAL_SECONDS: z.coerce.number().default(600),
  REQUIRE_HUMAN_APPROVAL: booleanString.default("true"),

  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_APPROVAL_CHAT_ID: z.string(),
  TELEGRAM_PUBLIC_CHANNEL_ID: z.string(),
  TELEGRAM_PUBLIC_CHANNEL_USERNAME: z.string().default(""),
  TELEGRAM_ADMIN_USER_IDS: z.string().default(""),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(""),
  TELEGRAM_PARSE_MODE: z.enum(["HTML", "MarkdownV2"]).default("HTML"),
  TELEGRAM_DISABLE_NOTIFICATION: booleanString.default("false"),
  TELEGRAM_PROTECT_CONTENT: booleanString.default("false"),
  TELEGRAM_MESSAGE_FOOTER: z.string().default("Preco sujeito a alteracao. Link de afiliado."),
  TELEGRAM_MAX_CAPTION_LENGTH: z.coerce.number().default(1024),

  AFFILIATE_DISCLOSURE_TEXT: z.string().default(""),
  AFFILIATE_LINK_TIMEOUT_MS: z.coerce.number().default(30000),
  AFFILIATE_MAX_REDIRECTS: z.coerce.number().default(5),
  AFFILIATE_REQUIRE_HTTPS: booleanString.default("true"),
  AFFILIATE_ALLOWED_DOMAINS: z.string().default(""),

  IMAGE_MAX_BYTES: z.coerce.number().default(5242880),
  IMAGE_ALLOWED_MIME_TYPES: z.string().default("image/jpeg,image/png,image/webp"),
  IMAGE_DOWNLOAD_TIMEOUT_MS: z.coerce.number().default(15000),
  IMAGE_CACHE_TTL_HOURS: z.coerce.number().default(1),
  IMAGE_HOTLINK_ALLOWED_BY_DEFAULT: booleanString.default("false"),
  IMAGE_FALLBACK_TO_TELEGRAM_PREVIEW: booleanString.default("true"),

  RETRY_MAX_ATTEMPTS: z.coerce.number().default(3),
  RETRY_BASE_DELAY_MS: z.coerce.number().default(1000),
  RETRY_MAX_DELAY_MS: z.coerce.number().default(30000),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().default(5),
  CIRCUIT_BREAKER_RESET_TIMEOUT_SECONDS: z.coerce.number().default(900),

  HEALTHCHECK_PATH: z.string().default("/health"),
  READINESS_PATH: z.string().default("/ready"),
  METRICS_ENABLED: booleanString.default("true"),
  METRICS_PORT: z.coerce.number().default(9090),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten();
    console.error("Environment variable validation failed:");
    for (const [field, msgs] of Object.entries(errors.fieldErrors)) {
      for (const msg of msgs) {
        console.error(`  ${field}: ${msg}`);
      }
    }
    for (const msg of errors.formErrors) {
      console.error(`  ${msg}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
