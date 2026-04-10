export type SnapshotLabelController = {
  update: (snapshotCreatedAtMs: number | null) => void;
  render: () => void;
  start: () => void;
  stop: () => void;
};

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
