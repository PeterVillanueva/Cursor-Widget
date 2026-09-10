export type MeterTone = "ok" | "warn" | "critical";

export interface UsageMeter {
  label: string;
  usedPercent: number;
  remainingPercent: number;
  usedPercentLabel: number;
  remainingPercentLabel: number;
  tone: MeterTone;
}

export interface UsageSnapshot {
  planName: string;
  cursorModels: UsageMeter;
  otherModels: UsageMeter;
  resetsAtIso: string | null;
  fetchedAtIso: string;
  hitLimit: boolean;
  limitMessage: string | null;
}

export type OverlayState =
  | {
      status: "loading";
    }
  | {
      status: "ready";
      snapshot: UsageSnapshot;
    }
  | {
      status: "error";
      message: string;
      snapshot?: UsageSnapshot;
    };

export interface OverlayApi {
  getState: () => Promise<OverlayState>;
  refresh: () => Promise<void>;
  openDashboard: () => Promise<void>;
  onState: (handler: (state: OverlayState) => void) => () => void;
}

export interface CursorAuth {
  accessToken: string;
  membershipType: string | null;
}

export interface PeriodUsageFields {
  autoPercentUsed: number | null;
  apiPercentUsed: number | null;
  billingCycleEnd: string | number | null;
  membershipType: string | null;
  displayMessage: string | null;
  autoModelSelectedDisplayMessage: string | null;
  namedModelSelectedDisplayMessage: string | null;
}

export interface PlanInfoFields {
  planName: string | null;
  billingCycleEnd: string | number | null;
}
