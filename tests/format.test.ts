import { describe, expect, it } from "vitest";
import {
  formatResetsIn,
  formatUpdatedAgo,
  remainingLabel,
} from "../src/shared/format";

describe("formatResetsIn", () => {
  it("formats multi-day resets", () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    const resetsAt = new Date("2026-09-22T00:00:00.000Z").toISOString();
    expect(formatResetsIn(resetsAt, now)).toBe("Resets in 12d");
  });
});

describe("formatUpdatedAgo", () => {
  it("formats seconds", () => {
    const now = new Date("2026-09-10T00:00:30.000Z");
    const fetched = new Date("2026-09-10T00:00:12.000Z").toISOString();
    expect(formatUpdatedAgo(fetched, now)).toBe("Updated 18s");
  });
});

describe("remainingLabel", () => {
  it("returns remaining copy", () => {
    expect(remainingLabel(14)).toBe("14% remaining");
  });
});
