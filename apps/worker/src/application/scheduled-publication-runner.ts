const DEFAULT_INTERVAL_MS = 30_000;

export function createScheduledPublicationRunner(
  run: () => Promise<unknown>,
  intervalMs = DEFAULT_INTERVAL_MS,
) {
  let started = false;
  let timer: NodeJS.Timeout | undefined;

  const tick = async () => {
    try {
      await run();
    } finally {
      if (started) timer = setTimeout(() => void tick(), intervalMs);
    }
  };

  return {
    start() {
      if (started) return;
      started = true;
      void tick();
    },
    stop() {
      started = false;
      if (!timer) return;
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
