import { afterEach, describe, expect, it, vi } from "vitest";

const { createScheduledPublicationRunner } =
  await import("../../src/application/scheduled-publication-runner.js");

describe("scheduled publication runner", () => {
  afterEach(() => vi.useRealTimers());

  it("runs immediately and every 30 seconds", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockResolvedValue(undefined);
    const runner = createScheduledPublicationRunner(run);

    runner.start();
    await vi.runAllTicks();
    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(2);
    runner.stop();
  });

  it("does not overlap executions", async () => {
    vi.useFakeTimers();
    let release: (() => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const runner = createScheduledPublicationRunner(run);

    runner.start();
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(1);

    release?.();
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(2);
    runner.stop();
  });
});
