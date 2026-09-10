import {
  CURSOR_API_BASE_URL,
  CURRENT_PERIOD_USAGE_PATH,
  FETCH_TIMEOUT_MS,
  PLAN_INFO_PATH,
} from "../shared/constants";
import {
  buildUsageSnapshot,
  extractPeriodUsage,
  extractPlanInfo,
} from "../shared/parse-usage";
import type { CursorAuth, UsageSnapshot } from "../shared/types";

export class CursorApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CursorApiError";
  }
}

async function postDashboardJson(
  requestPath: string,
  accessToken: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${CURSOR_API_BASE_URL}${requestPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
      },
      body: "{}",
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new CursorApiError(
        `Cursor API ${requestPath} failed (${response.status})`,
        response.status,
      );
    }
    try {
      return JSON.parse(text) as unknown;
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : "Invalid JSON";
      throw new CursorApiError(
        `Cursor API ${requestPath} returned invalid JSON: ${detail}`,
        response.status,
      );
    }
  } catch (error: unknown) {
    if (error instanceof CursorApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new CursorApiError(`Cursor API ${requestPath} timed out`, 408);
    }
    const detail = error instanceof Error ? error.message : "Unknown network error";
    throw new CursorApiError(`Cursor API ${requestPath} failed: ${detail}`, 0);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchUsageSnapshot(auth: CursorAuth): Promise<UsageSnapshot> {
  const periodResult = await postDashboardJson(
    CURRENT_PERIOD_USAGE_PATH,
    auth.accessToken,
  );

  let planResult: unknown = {};
  try {
    planResult = await postDashboardJson(PLAN_INFO_PATH, auth.accessToken);
  } catch (error: unknown) {
    if (!(error instanceof CursorApiError)) {
      throw error;
    }
  }

  return buildUsageSnapshot({
    period: extractPeriodUsage(periodResult),
    plan: extractPlanInfo(planResult),
    membershipType: auth.membershipType,
    fetchedAt: new Date(),
  });
}
