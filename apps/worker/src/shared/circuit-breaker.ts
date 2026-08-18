import { AppError } from "./errors.js";

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

type CircuitState = "closed" | "open" | "half-open";

interface Circuit {
  state: CircuitState;
  failures: number;
  lastFailure: number;
}

const circuits = new Map<string, Circuit>();

function getCircuit(source: string): Circuit {
  if (!circuits.has(source)) {
    circuits.set(source, {
      state: "closed",
      failures: 0,
      lastFailure: 0,
    });
  }
  return circuits.get(source)!;
}

export async function withCircuitBreaker<T>(
  source: string,
  fn: () => Promise<T>,
): Promise<T> {
  const circuit = getCircuit(source);
  const now = Date.now();

  if (circuit.state === "open") {
    const resetTimeoutSeconds = positiveInteger(
      "CIRCUIT_BREAKER_RESET_TIMEOUT_SECONDS",
      900,
    );
    if (now - circuit.lastFailure > resetTimeoutSeconds * 1000) {
      circuit.state = "half-open";
    } else {
      throw new AppError(
        "SOURCE_CIRCUIT_OPEN",
        `Circuit is open for ${source}`,
        true,
      );
    }
  }

  try {
    const result = await fn();
    if (circuit.state === "half-open") {
      circuit.state = "closed";
      circuit.failures = 0;
    }
    return result;
  } catch (error) {
    if (circuit.state === "half-open") {
      circuit.state = "open";
      circuit.lastFailure = now;
    } else {
      circuit.failures++;
      circuit.lastFailure = now;
      const failureThreshold = positiveInteger(
        "CIRCUIT_BREAKER_FAILURE_THRESHOLD",
        5,
      );
      if (circuit.failures >= failureThreshold) {
        circuit.state = "open";
      }
    }
    throw error;
  }
}
