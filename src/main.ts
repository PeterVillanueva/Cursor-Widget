import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} from "electron";
import {
  DASHBOARD_SPENDING_URL,
  POLL_INTERVAL_MS,
  WINDOW_HEIGHT,
  WINDOW_MARGIN,
  WINDOW_WIDTH,
} from "./shared/constants";
import { DEMO_SNAPSHOT } from "./shared/parse-usage";
import type { OverlayState, UsageSnapshot } from "./shared/types";
import { readCursorAuth } from "./main/auth";
import { fetchUsageSnapshot } from "./main/cursor-api";
import { loadSettings, saveSettings, type OverlaySettings } from "./main/settings";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const isDemoMode = process.argv.includes("--demo");

let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let overlayState: OverlayState = { status: "loading" };
let settings: OverlaySettings = {
  x: null,
  y: null,
  opacity: 0.96,
  openAtLogin: false,
};
let savePositionTimer: ReturnType<typeof setTimeout> | null = null;

function demoSnapshot(): UsageSnapshot {
  const now = Date.now();
  return {
    ...DEMO_SNAPSHOT,
    resetsAtIso: new Date(now + 12 * 24 * 60 * 60 * 1000).toISOString(),
    fetchedAtIso: new Date(now - 18_000).toISOString(),
  };
}

function sendState(): void {
  overlayWindow?.webContents.send("overlay:state", overlayState);
}

function setState(next: OverlayState): void {
  overlayState = next;
  sendState();
}

async function refreshUsage(): Promise<void> {
  if (isDemoMode) {
    setState({ status: "ready", snapshot: demoSnapshot() });
    return;
  }

  const previous =
    overlayState.status === "ready"
      ? overlayState.snapshot
      : overlayState.status === "error"
        ? overlayState.snapshot
        : undefined;

  try {
    const auth = readCursorAuth();
    const snapshot = await fetchUsageSnapshot(auth);
    setState({ status: "ready", snapshot });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load Cursor usage.";
    if (previous) {
      setState({ status: "error", message, snapshot: previous });
      return;
    }
    setState({ status: "error", message });
  }
}

function defaultWindowPosition(): { x: number; y: number } {
  const workArea = screen.getPrimaryDisplay().workArea;
  return {
    x: workArea.x + workArea.width - WINDOW_WIDTH - WINDOW_MARGIN,
    y: workArea.y + WINDOW_MARGIN,
  };
}

function createOverlayWindow(): BrowserWindow {
  const savedX = settings.x;
  const savedY = settings.y;
  const fallback = defaultWindowPosition();
  const htmlPath = path.join(currentDir, "renderer", "overlay.html");
  if (!existsSync(htmlPath)) {
    throw new Error(`Overlay HTML was not found at ${htmlPath}`);
  }

  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: savedX ?? fallback.x,
    y: savedY ?? fallback.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(currentDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.setAlwaysOnTop(true, "screen-saver");
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.setOpacity(settings.opacity);

  window.once("ready-to-show", () => {
    window.showInactive();
  });

  window.on("moved", () => {
    if (savePositionTimer) {
      clearTimeout(savePositionTimer);
    }
    savePositionTimer = setTimeout(() => {
      if (window.isDestroyed()) {
        return;
      }
      const position = window.getPosition();
      const x = position[0];
      const y = position[1];
      if (x === undefined || y === undefined) {
        return;
      }
      settings = { ...settings, x, y };
      saveSettings(settings);
    }, 250);
  });

  void window.loadFile(htmlPath);
  return window;
}

function trayIcon(): Electron.NativeImage {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAhUlEQVQ4T2NkYGD4z0ABY6QZMAqp4P///5WMjIyNDAwMCxiIAQv+MzAw/GdkZNxAlIZhm4GBpwz/GRgY9hClAVkDLg0MDAz7iNKAbAAuDQwMDPuI0oBsAC4NDAwM+4jSgGwALg0MDAz7iNKAbAAuDQwMDPuI0oBsAC4NDAwM+4jSgGwALg0MDAz7iNKAbAAuDQwMDPsACqkZ0g0A2Y4n1l0n3k0AAAAASUVORK5CYII=",
    "base64",
  );
  const image = nativeImage.createFromBuffer(png);
  image.setTemplateImage(false);
  return image;
}

function setOpenAtLogin(openAtLogin: boolean): void {
  settings = { ...settings, openAtLogin };
  saveSettings(settings);
  app.setLoginItemSettings({ openAtLogin });
}

function buildTrayMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: overlayWindow?.isVisible() ? "Hide overlay" : "Show overlay",
      click: () => {
        if (!overlayWindow) {
          return;
        }
        if (overlayWindow.isVisible()) {
          overlayWindow.hide();
        } else {
          overlayWindow.showInactive();
        }
        tray?.setContextMenu(buildTrayMenu());
      },
    },
    {
      label: "Refresh now",
      click: () => {
        void refreshUsage();
      },
    },
    { type: "separator" },
    {
      label: "Open spending dashboard",
      click: () => {
        void shell.openExternal(DASHBOARD_SPENDING_URL);
      },
    },
    {
      label: "Start with Windows",
      type: "checkbox",
      checked: settings.openAtLogin,
      click: (item) => {
        setOpenAtLogin(item.checked);
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);
}

function createTray(): Tray {
  const nextTray = new Tray(trayIcon());
  nextTray.setToolTip("Cursor Usage");
  nextTray.setContextMenu(buildTrayMenu());
  nextTray.on("click", () => {
    if (!overlayWindow) {
      return;
    }
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.showInactive();
    }
    nextTray.setContextMenu(buildTrayMenu());
  });
  return nextTray;
}

function registerIpc(): void {
  ipcMain.handle("overlay:get-state", () => overlayState);
  ipcMain.handle("overlay:refresh", async () => {
    await refreshUsage();
  });
  ipcMain.handle("overlay:open-dashboard", async () => {
    await shell.openExternal(DASHBOARD_SPENDING_URL);
  });
  ipcMain.handle("overlay:quit", () => {
    app.quit();
  });
}

function startPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  pollTimer = setInterval(() => {
    void refreshUsage();
  }, POLL_INTERVAL_MS);
}

app.setName("Cursor Usage");
app.setAppUserModelId("com.cursor.usage-overlay");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    overlayWindow?.showInactive();
    overlayWindow?.focus();
  });

  void app.whenReady().then(() => {
    settings = loadSettings();
    app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
    registerIpc();
    overlayWindow = createOverlayWindow();
    tray = createTray();
    void refreshUsage();
    startPolling();
  });
}

app.on("before-quit", () => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  if (savePositionTimer) {
    clearTimeout(savePositionTimer);
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
