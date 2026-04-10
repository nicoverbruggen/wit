export type SidebarController = {
  isVisible: () => boolean;
  getWidthPx: () => number;
  getVisibleBeforeFullscreen: () => boolean;
  setVisibleBeforeFullscreen: (value: boolean) => void;
  setFaded: (faded: boolean) => void;
  loadWidthPreference: () => void;
  syncToggleButton: (projectAvailable: boolean) => void;
  setVisibility: (
    nextVisible: boolean,
    options?: {
      showStatus?: boolean;
      setStatus?: (message: string, clearAfterMs?: number) => void;
      projectAvailable?: boolean;
    }
  ) => void;
  toggleVisibility: (
    projectAvailable: boolean,
    options?: {
      showStatus?: boolean;
      setStatus?: (message: string, clearAfterMs?: number) => void;
    }
  ) => void;
  applyWidth: (width: number) => void;
  adjustWidth: (delta: number) => void;
  beginResize: (pointerClientX: number, projectAvailable: boolean) => void;
  stopResize: () => void;
};

export function createSidebarController(options: {
  appShell: HTMLElement;
  toggleButton: HTMLButtonElement;
  minWidthPx: number;
  maxWidthPx: number;
  defaultWidthPx: number;
  widthStorageKey: string;
}): SidebarController {
  let visible = true;
  let visibleBeforeFullscreen = true;
  let widthPx = options.defaultWidthPx;
  let resizeCleanup: (() => void) | null = null;

  const clampWidth = (width: number): number =>
    Math.min(options.maxWidthPx, Math.max(options.minWidthPx, Math.round(width)));

  const stopResize = (): void => {
    if (!resizeCleanup) {
      return;
    }

    resizeCleanup();
    resizeCleanup = null;
    options.appShell.classList.remove("sidebar-resizing");
  };

  const applyWidth = (width: number): void => {
    widthPx = clampWidth(width);
    options.appShell.style.setProperty("--sidebar-width", `${widthPx}px`);

    try {
      localStorage.setItem(options.widthStorageKey, String(widthPx));
    } catch {
      // Ignore storage failures.
    }
  };

  const syncToggleButton = (projectAvailable: boolean): void => {
    options.toggleButton.hidden = !projectAvailable;

    if (!projectAvailable) {
      options.toggleButton.disabled = false;
      options.toggleButton.title = "Hide sidebar";
      options.toggleButton.setAttribute("aria-label", "Hide sidebar");
      options.toggleButton.setAttribute("aria-pressed", "false");
      return;
    }

    options.toggleButton.disabled = false;
    const nextActionLabel = visible ? "Hide sidebar" : "Show sidebar";
    options.toggleButton.title = nextActionLabel;
    options.toggleButton.setAttribute("aria-label", nextActionLabel);
    options.toggleButton.setAttribute("aria-pressed", String(visible));
  };

  const setVisibility: SidebarController["setVisibility"] = (nextVisible, args) => {
    const showStatus = args?.showStatus ?? true;
    const projectAvailable = args?.projectAvailable ?? true;

    if (visible === nextVisible) {
      syncToggleButton(projectAvailable);
      return;
    }

    visible = nextVisible;
    options.appShell.classList.toggle("sidebar-hidden", !visible);
    options.appShell.classList.remove("sidebar-faded");
    syncToggleButton(projectAvailable);

    if (showStatus && args?.setStatus) {
      args.setStatus(visible ? "Sidebar shown." : "Sidebar hidden.", 1200);
    }
  };

  return {
    isVisible: () => visible,
    getWidthPx: () => widthPx,
    getVisibleBeforeFullscreen: () => visibleBeforeFullscreen,
    setVisibleBeforeFullscreen: (value) => {
      visibleBeforeFullscreen = value;
    },
    setFaded: (faded) => {
      options.appShell.classList.toggle("sidebar-faded", faded);
    },
    loadWidthPreference: () => {
      try {
        const rawValue = localStorage.getItem(options.widthStorageKey);
        if (!rawValue) {
          applyWidth(options.defaultWidthPx);
          return;
        }

        const parsed = Number.parseInt(rawValue, 10);
        applyWidth(Number.isFinite(parsed) ? parsed : options.defaultWidthPx);
      } catch {
        applyWidth(options.defaultWidthPx);
      }
    },
    syncToggleButton,
    setVisibility,
    toggleVisibility: (projectAvailable, args) => {
      if (!projectAvailable) {
        return;
      }

      setVisibility(!visible, {
        showStatus: args?.showStatus,
        setStatus: args?.setStatus,
        projectAvailable
      });
    },
    applyWidth,
    adjustWidth: (delta) => {
      applyWidth(widthPx + delta);
    },
    beginResize: (pointerClientX, projectAvailable) => {
      if (!projectAvailable || !visible) {
        return;
      }

      stopResize();
      options.appShell.classList.add("sidebar-resizing");

      const shellLeft = options.appShell.getBoundingClientRect().left;
      const handlePointerMove = (event: MouseEvent) => {
        applyWidth(event.clientX - shellLeft);
      };
      const handlePointerUp = () => {
        stopResize();
      };

      applyWidth(pointerClientX - shellLeft);
      window.addEventListener("mousemove", handlePointerMove);
      window.addEventListener("mouseup", handlePointerUp, { once: true });

      resizeCleanup = () => {
        window.removeEventListener("mousemove", handlePointerMove);
      };
    },
    stopResize
  };
}
