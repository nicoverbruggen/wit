/**
 * Owns: tracked typing activity timing used by autosave leniency and writing-time counters.
 * Out of scope: autosave scheduling and editor input wiring.
 * Inputs/Outputs: typing events and timing options in, typing-state queries and counters out.
 * Side effects: manages in-memory timing state and timeout polling.
 */
/**
 * Exposes typing-activity counters and pause detection.
 */
export type TypingActivityTracker = {
  recordTypingActivity: () => void;
  consumeActiveSeconds: () => number;
  isTyping: () => boolean;
  waitForPause: (options: { maxWaitMs: number; pollMs: number }) => Promise<void>;
  reset: () => void;
};

/**
 * Creates the typing activity tracker.
 *
 * @param idleThresholdMs Maximum idle gap that still counts as continuous typing.
 * @returns Typing-state helpers for autosave and writing-time tracking.
 */
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
