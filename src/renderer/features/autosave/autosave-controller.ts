export type AutosaveController = {
  restart: () => void;
  stop: () => void;
  runNow: () => Promise<void>;
};

export function createAutosaveController(options: {
  getIntervalSec: () => number | null;
  leniencyThresholdSec: number;
  isTyping: () => boolean;
  waitForPause: () => Promise<void>;
  onTick: () => Promise<void>;
}): AutosaveController {
  let timer: number | null = null;
  let inFlight = false;

  const stop = (): void => {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const runNow = async (): Promise<void> => {
    if (inFlight) {
      return;
    }

    inFlight = true;
    try {
      await options.onTick();
    } finally {
      inFlight = false;
    }
  };

  const restart = (): void => {
    stop();

    const intervalSec = options.getIntervalSec();
    if (intervalSec === null) {
      return;
    }

    const intervalMs = intervalSec * 1000;
    timer = window.setInterval(() => {
      if (intervalSec >= options.leniencyThresholdSec && options.isTyping()) {
        void options.waitForPause().then(() => {
          void runNow();
        });
        return;
      }

      void runNow();
    }, intervalMs);
  };

  return {
    restart,
    stop,
    runNow
  };
}
