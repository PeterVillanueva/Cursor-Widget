import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { app } from "electron";
import { isRecord, readFiniteNumber } from "../shared/parse-usage";

export interface OverlaySettings {
  x: number | null;
  y: number | null;
  opacity: number;
  openAtLogin: boolean;
}

const DEFAULT_SETTINGS: OverlaySettings = {
  x: null,
  y: null,
  opacity: 0.96,
  openAtLogin: false,
};

function settingsPath(): string {
  return path.join(app.getPath("userData"), "overlay-settings.json");
}

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0.55, value));
}

function parseSettings(value: unknown): OverlaySettings {
  if (!isRecord(value)) {
    return { ...DEFAULT_SETTINGS };
  }
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  const opacity = readFiniteNumber(value.opacity);
  return {
    x,
    y,
    opacity: opacity === null ? DEFAULT_SETTINGS.opacity : clampOpacity(opacity),
    openAtLogin: value.openAtLogin === true,
  };
}

export function loadSettings(): OverlaySettings {
  const filePath = settingsPath();
  if (!existsSync(filePath)) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const raw = readFileSync(filePath, "utf8");
    return parseSettings(JSON.parse(raw) as unknown);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error(`Failed to read overlay settings: ${detail}`);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: OverlaySettings): void {
  const directory = app.getPath("userData");
  mkdirSync(directory, { recursive: true });
  writeFileSync(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}
