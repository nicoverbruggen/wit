/**
 * Owns: autosave timer scheduling and typing-aware tick gating.
 * Out of scope: autosave persistence internals and typing-activity measurement.
 * Inputs/Outputs: interval and typing callbacks in, autosave lifecycle controls out.
 * Side effects: manages window interval timers.
 */
/**
 * Exposes autosave timer lifecycle controls.
 */
export type AutosaveController = {
  restart: () => void;
  stop: () => void;
  runNow: () => Promise<void>;
};

/**
 * Creates the autosave controller.
 *
 * @param options Interval, typing, and autosave tick hooks.
 * @returns Timer controls for restarting, stopping, or forcing autosave ticks.
 */
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
