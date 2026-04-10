/**
 * Owns: debounced preview word-count refresh scheduling with stale-request protection.
 * Out of scope: editor lifecycle and total-project state ownership.
 * Inputs/Outputs: content snapshots and callbacks in, applied next-word-count values out.
 * Side effects: schedules/clears window timers.
 */

export type LiveWordCountScheduleOptions = {
  contentSnapshot: string;
  filePathSnapshot: string;
  countPreviewWords: (text: string) => Promise<number>;
  shouldApply: (filePathSnapshot: string) => boolean;
  onApply: (nextWordCount: number) => void;
  onError?: () => void;
};

export type LiveWordCountTracker = {
  cancelPending: () => void;
  schedule: (options: LiveWordCountScheduleOptions) => void;
  dispose: () => void;
};

/**
 * Creates a debounced live word-count tracker.
 *
 * @param debounceMs Delay in milliseconds before preview counting is executed.
 * @returns Tracker with `schedule`, `cancelPending`, and `dispose` methods.
 */
export function createLiveWordCountTracker(debounceMs: number): LiveWordCountTracker {
  let liveWordCountTimer: number | null = null;
  let liveWordCountRequestToken = 0;

  const cancelPending = (): void => {
    liveWordCountRequestToken += 1;

    if (liveWordCountTimer) {
      window.clearTimeout(liveWordCountTimer);
      liveWordCountTimer = null;
    }
  };

  const schedule = (options: LiveWordCountScheduleOptions): void => {
    cancelPending();
    const requestToken = liveWordCountRequestToken;

    liveWordCountTimer = window.setTimeout(async () => {
      liveWordCountTimer = null;

      try {
        const nextWordCount = await options.countPreviewWords(options.contentSnapshot);

        if (requestToken !== liveWordCountRequestToken) {
          return;
        }

        if (!options.shouldApply(options.filePathSnapshot)) {
          return;
        }

        options.onApply(nextWordCount);
      } catch {
        options.onError?.();
      }
    }, debounceMs);
  };

  return {
    cancelPending,
    schedule,
    dispose: cancelPending
  };
}
