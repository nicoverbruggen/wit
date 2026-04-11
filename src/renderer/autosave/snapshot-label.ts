/**
 * Owns: snapshot footer label state and periodic relative-time refresh.
 * Out of scope: snapshot creation and project metadata loading.
 * Inputs/Outputs: snapshot timestamps in, label update helpers out.
 * Side effects: mutates the provided footer element and manages a refresh timer.
 */
/**
 * Exposes snapshot label update and timer controls.
 */
export type SnapshotLabelController = {
  update: (snapshotCreatedAtMs: number | null) => void;
  render: () => void;
  start: () => void;
  stop: () => void;
};

/**
 * Creates the snapshot label controller.
 *
 * @param options Label element and relative-time formatting hooks.
 * @returns Controls for updating and refreshing the snapshot label.
 */
export function createSnapshotLabelController(options: {
  element: HTMLElement;
  refreshMs: number;
  formatRelativeElapsed: (elapsedMs: number) => string;
}): SnapshotLabelController {
  let snapshotCreatedAtMs: number | null = null;
  let timer: number | null = null;

  const render = (): void => {
    if (!snapshotCreatedAtMs) {
      options.element.textContent = "✓ --";
      options.element.title = "No snapshot yet";
      return;
    }

    const elapsedMs = Date.now() - snapshotCreatedAtMs;
    const relative = options.formatRelativeElapsed(elapsedMs);
    options.element.textContent = `✓ ${relative}`;
    options.element.title = `Last snapshot at ${new Date(snapshotCreatedAtMs).toLocaleString()}`;
  };

  const stop = (): void => {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  return {
    update: (nextSnapshotCreatedAtMs) => {
      snapshotCreatedAtMs = nextSnapshotCreatedAtMs;
      render();
    },
    render,
    start: () => {
      stop();
      timer = window.setInterval(() => {
        if (!snapshotCreatedAtMs) {
          return;
        }

        render();
      }, options.refreshMs);
    },
    stop
  };
}
