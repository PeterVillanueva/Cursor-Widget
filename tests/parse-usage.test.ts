import { describe, expect, it } from "vitest";
import {
  buildUsageSnapshot,
  createMeter,
  extractPeriodUsage,
  formatPlanName,
  percentFromDisplayMessage,
  toneForUsedPercent,
} from "../src/shared/parse-usage";

describe("toneForUsedPercent", () => {
  it("marks warn and critical thresholds", () => {
    expect(toneForUsedPercent(79)).toBe("ok");
    expect(toneForUsedPercent(80)).toBe("warn");
    expect(toneForUsedPercent(95)).toBe("critical");
  });
});

describe("createMeter", () => {
  it("rounds used/remaining labels", () => {
    const meter = createMeter("Cursor Models", 72.4);
    expect(meter.usedPercentLabel).toBe(72);
    expect(meter.remainingPercentLabel).toBe(28);
  });
});

describe("extractPeriodUsage", () => {
  it("reads nested individualUsage.plan fields", () => {
    const fields = extractPeriodUsage({
      individualUsage: {
        plan: {
          autoPercentUsed: 100,
          apiPercentUsed: 98.2,
        },
      },
      billingCycleEnd: "2026-09-22T00:00:00.000Z",
      membershipType: "pro",
      displayMessage: "You've hit your usage limit",
      autoModelSelectedDisplayMessage: "You've used 100% of your included usage",
      namedModelSelectedDisplayMessage: "You've used 98% of your included usage",
    });

    expect(fields.autoPercentUsed).toBe(100);
    expect(fields.apiPercentUsed).toBe(98.2);
    expect(fields.membershipType).toBe("pro");
  });

  it("falls back to planUsage shape", () => {
    const fields = extractPeriodUsage({
      planUsage: {
        autoPercentUsed: 12,
        apiPercentUsed: 34,
      },
    });
    expect(fields.autoPercentUsed).toBe(12);
    expect(fields.apiPercentUsed).toBe(34);
  });
});

describe("buildUsageSnapshot", () => {
  it("maps Cursor Models and Other Models bars", () => {
    const snapshot = buildUsageSnapshot({
      period: {
        autoPercentUsed: 100,
        apiPercentUsed: 98,
        billingCycleEnd: "2026-09-22T00:00:00.000Z",
        membershipType: "pro",
        displayMessage: "You've hit your usage limit",
        autoModelSelectedDisplayMessage: null,
        namedModelSelectedDisplayMessage: null,
      },
      plan: {
        planName: "Pro",
        billingCycleEnd: null,
      },
      membershipType: "pro",
      fetchedAt: new Date("2026-09-10T11:00:00.000Z"),
    });

    expect(snapshot.planName).toBe("PRO");
    expect(snapshot.cursorModels.usedPercentLabel).toBe(100);
    expect(snapshot.otherModels.usedPercentLabel).toBe(98);
    expect(snapshot.cursorModels.remainingPercentLabel).toBe(0);
    expect(snapshot.otherModels.remainingPercentLabel).toBe(2);
    expect(snapshot.hitLimit).toBe(true);
  });

  it("uses display-message percents when numeric fields are missing", () => {
    const snapshot = buildUsageSnapshot({
      period: {
        autoPercentUsed: null,
        apiPercentUsed: null,
        billingCycleEnd: null,
        membershipType: null,
        displayMessage: null,
        autoModelSelectedDisplayMessage: "72% used",
        namedModelSelectedDisplayMessage: "You've used 86% of your included usage",
      },
      plan: { planName: null, billingCycleEnd: null },
      membershipType: "pro",
      fetchedAt: new Date(0),
    });
    expect(snapshot.cursorModels.usedPercentLabel).toBe(72);
    expect(snapshot.otherModels.usedPercentLabel).toBe(86);
  });
});

describe("helpers", () => {
  it("formats plan names", () => {
    expect(formatPlanName("pro")).toBe("PRO");
    expect(formatPlanName("pro_plus")).toBe("PRO+");
  });

  it("parses percent from messages", () => {
    expect(percentFromDisplayMessage("You've used 14% of your included usage")).toBe(
      14,
    );
  });
});
