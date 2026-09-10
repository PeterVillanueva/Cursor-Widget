import {
  formatResetsIn,
  formatUpdatedAgo,
  remainingLabel,
} from "../shared/format";
import type { OverlayState, UsageMeter, UsageSnapshot } from "../shared/types";

const TICK_MS = 1_000;

function requireOverlayApi(): NonNullable<Window["overlay"]> {
  const api = window.overlay;
  if (!api) {
    throw new Error("Overlay preload bridge is unavailable.");
  }
  return api;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`);
  }
  return node as T;
}

const card = el<HTMLElement>("card");
const plan = el<HTMLElement>("plan");
const banner = el<HTMLElement>("banner");
const refreshButton = el<HTMLButtonElement>("refresh");
const cursorPercent = el<HTMLElement>("cursor-percent");
const cursorFill = el<HTMLElement>("cursor-fill");
const cursorRemaining = el<HTMLElement>("cursor-remaining");
const otherPercent = el<HTMLElement>("other-percent");
const otherFill = el<HTMLElement>("other-fill");
const otherRemaining = el<HTMLElement>("other-remaining");
const resets = el<HTMLElement>("resets");
const updated = el<HTMLElement>("updated");
const cursorMeterNode = document.querySelector('[data-meter="cursor"]');
const otherMeterNode = document.querySelector('[data-meter="other"]');

if (
  !(cursorMeterNode instanceof HTMLElement) ||
  !(otherMeterNode instanceof HTMLElement)
) {
  throw new Error("Meter containers were not found.");
}

const cursorMeter: HTMLElement = cursorMeterNode;
const otherMeter: HTMLElement = otherMeterNode;

let latestSnapshot: UsageSnapshot | null = null;
let tickTimer: number | null = null;

function applyTone(meterEl: HTMLElement, meter: UsageMeter): void {
  meterEl.classList.remove("tone-ok", "tone-warn", "tone-critical");
  meterEl.classList.add(`tone-${meter.tone}`);
}

function renderMeter(
  meterEl: HTMLElement,
  percentEl: HTMLElement,
  fillEl: HTMLElement,
  remainingEl: HTMLElement,
  meter: UsageMeter,
): void {
  percentEl.textContent = `${meter.usedPercentLabel}%`;
  fillEl.style.width = `${meter.usedPercent}%`;
  remainingEl.textContent = remainingLabel(meter.remainingPercentLabel);
  applyTone(meterEl, meter);
}

function renderMeta(snapshot: UsageSnapshot, now: Date): void {
  resets.textContent = formatResetsIn(snapshot.resetsAtIso, now);
  updated.textContent = formatUpdatedAgo(snapshot.fetchedAtIso, now);
}

function renderSnapshot(snapshot: UsageSnapshot): void {
  latestSnapshot = snapshot;
  plan.textContent = snapshot.planName;
  renderMeter(
    cursorMeter,
    cursorPercent,
    cursorFill,
    cursorRemaining,
    snapshot.cursorModels,
  );
  renderMeter(
    otherMeter,
    otherPercent,
    otherFill,
    otherRemaining,
    snapshot.otherModels,
  );
  renderMeta(snapshot, new Date());

  if (snapshot.hitLimit && snapshot.limitMessage) {
    banner.textContent = snapshot.limitMessage;
    banner.classList.remove("hidden");
  } else {
    banner.textContent = "";
    banner.classList.add("hidden");
  }
}

function renderState(state: OverlayState): void {
  card.classList.toggle("error", state.status === "error");

  if (state.status === "loading") {
    plan.textContent = "…";
    cursorPercent.textContent = "—";
    otherPercent.textContent = "—";
    cursorRemaining.textContent = "Loading usage…";
    otherRemaining.textContent = "Loading usage…";
    cursorFill.style.width = "0%";
    otherFill.style.width = "0%";
    resets.textContent = "Resets in —";
    updated.textContent = "Updated —";
    banner.classList.add("hidden");
    return;
  }

  if (state.snapshot) {
    renderSnapshot(state.snapshot);
  }

  if (state.status === "error") {
    banner.textContent = state.message;
    banner.classList.remove("hidden");
  }
}

function startTicker(): void {
  if (tickTimer !== null) {
    window.clearInterval(tickTimer);
  }
  tickTimer = window.setInterval(() => {
    if (latestSnapshot) {
      renderMeta(latestSnapshot, new Date());
    }
  }, TICK_MS);
}

async function refresh(): Promise<void> {
  const api = requireOverlayApi();
  refreshButton.classList.add("refreshing");
  refreshButton.disabled = true;
  try {
    await api.refresh();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Refresh failed.";
    banner.textContent = message;
    banner.classList.remove("hidden");
    card.classList.add("error");
  } finally {
    refreshButton.classList.remove("refreshing");
    refreshButton.disabled = false;
  }
}

function boot(): void {
  const api = requireOverlayApi();
  api.onState(renderState);
  void api.getState().then(renderState);
  startTicker();

  refreshButton.addEventListener("click", () => {
    void refresh();
  });

  const meta = document.querySelector(".meta");
  meta?.addEventListener("click", () => {
    void api.openDashboard();
  });
}

boot();
