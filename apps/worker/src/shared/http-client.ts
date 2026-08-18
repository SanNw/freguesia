import { setTimeout as sleep } from "node:timers/promises";
import { AppError } from "./errors.js";
import { withCircuitBreaker } from "./circuit-breaker.js";

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  backoff?: number;
  source?: string;
}

export async function resilientFetch(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const {
    timeout = positiveInteger("DEFAULT_HTTP_TIMEOUT_MS", 30_000),
    retries = positiveInteger("HTTP_RETRY_MAX", 4),
    backoff = positiveInteger("HTTP_RETRY_BASE_MS", 1_000),
    source,
    ...fetchOpts
  } = options;

  const attempt = async (): Promise<Response> => {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, timeout);

      try {
        const response = await fetch(url, {
          ...fetchOpts,
          signal: controller.signal,
        });

        if (response.ok) {
          clearTimeout(timer);
          return response;
        }

        if (response.status === 429) {
          return response;
        }

        if (response.status >= 500) {
          if (i === retries - 1) {
            return response;
          }
          lastError = new AppError(
            "SOURCE_UNAVAILABLE",
            `HTTP ${response.status}`,
            true,
          );
          await sleep(backoff * 2 ** i);
          continue;
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (
          lastError.name === "AbortError" ||
          lastError.name === "TimeoutError"
        ) {
          lastError = new AppError(
            "SOURCE_UNAVAILABLE",
            "Request timed out",
            true,
          );
        }
        if (i < retries - 1) {
          await sleep(backoff * 2 ** i);
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw (
      lastError ??
      new AppError("SOURCE_UNAVAILABLE", "Max retries reached", true)
    );
  };

  if (source) {
    return withCircuitBreaker(source, attempt);
  }
  return attempt();
}
