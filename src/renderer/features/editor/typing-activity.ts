export type TypingActivityTracker = {
  recordTypingActivity: () => void;
  consumeActiveSeconds: () => number;
  isTyping: () => boolean;
  waitForPause: (options: { maxWaitMs: number; pollMs: number }) => Promise<void>;
  reset: () => void;
};

export function createTypingActivityTracker(idleThresholdMs: number): TypingActivityTracker {
  let lastTypedAtMs: number | null = null;
  let activeTypingSeconds = 0;

  return {
    recordTypingActivity: () => {
      const now = Date.now();

      if (lastTypedAtMs !== null) {
        const gap = now - lastTypedAtMs;
        if (gap < idleThresholdMs) {
          activeTypingSeconds += gap / 1000;
        }
      }

      lastTypedAtMs = now;
    },
    consumeActiveSeconds: () => {
      const seconds = Math.floor(activeTypingSeconds);
      activeTypingSeconds = 0;
      lastTypedAtMs = null;
      return seconds;
    },
    isTyping: () => lastTypedAtMs !== null && (Date.now() - lastTypedAtMs) < idleThresholdMs,
    waitForPause: ({ maxWaitMs, pollMs }) =>
      new Promise((resolve) => {
        const deadline = Date.now() + maxWaitMs;
        const check = () => {
          if ((lastTypedAtMs === null || Date.now() - lastTypedAtMs >= idleThresholdMs) || Date.now() >= deadline) {
            resolve();
            return;
          }

          window.setTimeout(check, pollMs);
        };

        check();
      }),
    reset: () => {
      activeTypingSeconds = 0;
      lastTypedAtMs = null;
    }
  };
}
