import {
  CRITICAL_USED_PERCENT,
  CURSOR_MODELS_LABEL,
  OTHER_MODELS_LABEL,
  WARNING_USED_PERCENT,
} from "./constants";
import type {
  MeterTone,
  PeriodUsageFields,
  PlanInfoFields,
  UsageMeter,
  UsageSnapshot,
} from "./types";

const PERCENT_IN_MESSAGE = /(\d+(?:\.\d+)?)\s*%/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function readString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  return null;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

export function toneForUsedPercent(usedPercent: number): MeterTone {
  if (usedPercent >= CRITICAL_USED_PERCENT) {
    return "critical";
  }
  if (usedPercent >= WARNING_USED_PERCENT) {
    return "warn";
  }
  return "ok";
}

export function createMeter(label: string, usedPercent: number): UsageMeter {
  const used = clampPercent(usedPercent);
  const usedPercentLabel = Math.round(used);
  const remainingPercentLabel = Math.max(0, 100 - usedPercentLabel);
  return {
    label,
    usedPercent: used,
    remainingPercent: clampPercent(100 - used),
    usedPercentLabel,
    remainingPercentLabel,
    tone: toneForUsedPercent(used),
  };
}

export function parseTimestamp(
  value: string | number | null | undefined,
): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 1e12 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  if (/^\d+$/.test(value.trim())) {
    const numeric = Number(value);
    const milliseconds = numeric < 1e12 ? numeric * 1000 : numeric;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function percentFromDisplayMessage(message: string | null): number | null {
  if (message === null) {
    return null;
  }
  const match = PERCENT_IN_MESSAGE.exec(message);
  if (!match) {
    return null;
  }
  const raw = match[1];
  if (raw === undefined) {
    return null;
  }
  return readFiniteNumber(raw);
}

export function formatPlanName(raw: string | null | undefined): string {
  if (!raw || raw.trim() === "") {
    return "PRO";
  }
  const normalized = raw.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (normalized === "pro" || normalized === "free" || normalized === "ultra") {
    return normalized.toUpperCase();
  }
  if (
    normalized === "pro plus" ||
    normalized === "proplus" ||
    normalized === "pro+"
  ) {
    return "PRO+";
  }
  if (normalized === "business" || normalized === "team") {
    return "BUSINESS";
  }
  return raw.trim().toUpperCase();
}

function pickPercent(
  primary: number | null,
  fallbackMessage: string | null,
): number {
  if (primary !== null) {
    return clampPercent(primary);
  }
  const fromMessage = percentFromDisplayMessage(fallbackMessage);
  if (fromMessage !== null) {
    return clampPercent(fromMessage);
  }
  return 0;
}

function limitWasHit(
  cursorModels: UsageMeter,
  otherModels: UsageMeter,
  displayMessage: string | null,
): boolean {
  if (cursorModels.usedPercentLabel >= 100 || otherModels.usedPercentLabel >= 100) {
    return true;
  }
  if (displayMessage === null) {
    return false;
  }
  return displayMessage.toLowerCase().includes("hit your usage limit");
}

export function extractPeriodUsage(value: unknown): PeriodUsageFields {
  const root = isRecord(value) ? value : {};
  const planUsage = isRecord(root.planUsage) ? root.planUsage : root;
  const individualUsage = isRecord(root.individualUsage)
    ? root.individualUsage
    : null;
  const summaryPlan =
    individualUsage && isRecord(individualUsage.plan)
      ? individualUsage.plan
      : null;
  const source = summaryPlan ?? planUsage;

  return {
    autoPercentUsed: readFiniteNumber(source.autoPercentUsed),
    apiPercentUsed: readFiniteNumber(source.apiPercentUsed),
    billingCycleEnd:
      readString(root.billingCycleEnd) ??
      readFiniteNumber(root.billingCycleEnd),
    membershipType: readString(root.membershipType),
    displayMessage: readString(root.displayMessage),
    autoModelSelectedDisplayMessage: readString(
      root.autoModelSelectedDisplayMessage,
    ),
    namedModelSelectedDisplayMessage: readString(
      root.namedModelSelectedDisplayMessage,
    ),
  };
}

export function extractPlanInfo(value: unknown): PlanInfoFields {
  const root = isRecord(value) ? value : {};
  const planInfo = isRecord(root.planInfo) ? root.planInfo : root;
  return {
    planName: readString(planInfo.planName),
    billingCycleEnd:
      readString(planInfo.billingCycleEnd) ??
      readFiniteNumber(planInfo.billingCycleEnd),
  };
}

export function buildUsageSnapshot(input: {
  period: PeriodUsageFields;
  plan: PlanInfoFields;
  membershipType: string | null;
  fetchedAt: Date;
}): UsageSnapshot {
  const cursorModels = createMeter(
    CURSOR_MODELS_LABEL,
    pickPercent(
      input.period.autoPercentUsed,
      input.period.autoModelSelectedDisplayMessage,
    ),
  );
  const otherModels = createMeter(
    OTHER_MODELS_LABEL,
    pickPercent(
      input.period.apiPercentUsed,
      input.period.namedModelSelectedDisplayMessage,
    ),
  );
  const resetsAt = parseTimestamp(
    input.period.billingCycleEnd ?? input.plan.billingCycleEnd,
  );
  const planName = formatPlanName(
    input.plan.planName ?? input.period.membershipType ?? input.membershipType,
  );
  const hitLimit = limitWasHit(
    cursorModels,
    otherModels,
    input.period.displayMessage,
  );

  return {
    planName,
    cursorModels,
    otherModels,
    resetsAtIso: resetsAt ? resetsAt.toISOString() : null,
    fetchedAtIso: input.fetchedAt.toISOString(),
    hitLimit,
    limitMessage: hitLimit
      ? (input.period.displayMessage ?? "You've hit your usage limit")
      : null,
  };
}

export const DEMO_SNAPSHOT: UsageSnapshot = buildUsageSnapshot({
  period: {
    autoPercentUsed: 72,
    apiPercentUsed: 86,
    billingCycleEnd: null,
    membershipType: "pro",
    displayMessage: null,
    autoModelSelectedDisplayMessage: null,
    namedModelSelectedDisplayMessage: null,
  },
  plan: {
    planName: "Pro",
    billingCycleEnd: null,
  },
  membershipType: "pro",
  fetchedAt: new Date(0),
});
