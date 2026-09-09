import { describe, expect, it } from "vitest";

import {
  allZones,
  detectZone,
  effectiveZone,
  formatDateOnly,
  formatInstant,
  instantToLocalInput,
  localInputToInstant,
  zoneAbbreviation,
} from "@/lib/datetime";
import type { User } from "@/lib/auth/scopes";

describe("effectiveZone", () => {
  it("prefers the user's timezone", () => {
    const user = { timezone: "Asia/Kolkata" } as User;
    expect(effectiveZone(user)).toBe("Asia/Kolkata");
  });

  it("falls back to the detected zone when unset", () => {
    const user = { timezone: null } as User;
    expect(effectiveZone(user)).toBe(detectZone());
  });

  it("falls back to the detected zone for a null user", () => {
    expect(effectiveZone(null)).toBe(detectZone());
  });
});

describe("instantToLocalInput / localInputToInstant", () => {
  it("round-trips a UTC instant through America/Chicago", () => {
    const iso = "2026-06-15T18:30:00Z";
    const local = instantToLocalInput(iso, "America/Chicago");
    expect(local).toBe("2026-06-15T13:30");
    expect(localInputToInstant(local, "America/Chicago")).toBe("2026-06-15T18:30:00.000Z");
  });

  it("treats a naive (offset-less) string as UTC", () => {
    const local = instantToLocalInput("2026-06-15T18:30:00", "America/Chicago");
    expect(local).toBe("2026-06-15T13:30");
  });

  it("handles the US spring-forward transition (2026-03-08, America/Chicago)", () => {
    // 07:00Z is 01:00 CST (still standard time); 08:00Z is 03:00 CDT (clocks
    // jumped from 02:00 to 03:00, so the hour moves by two, not one).
    expect(instantToLocalInput("2026-03-08T07:00:00Z", "America/Chicago")).toBe(
      "2026-03-08T01:00",
    );
    expect(instantToLocalInput("2026-03-08T08:00:00Z", "America/Chicago")).toBe(
      "2026-03-08T03:00",
    );
    expect(localInputToInstant("2026-03-08T01:00", "America/Chicago")).toBe(
      "2026-03-08T07:00:00.000Z",
    );
  });

  it("handles the US fall-back transition (2026-11-01, America/Chicago)", () => {
    // 06:00Z is 01:00 CDT; 07:00Z is 01:00 CST — the wall clock hour repeats.
    expect(instantToLocalInput("2026-11-01T06:00:00Z", "America/Chicago")).toBe(
      "2026-11-01T01:00",
    );
    expect(instantToLocalInput("2026-11-01T07:00:00Z", "America/Chicago")).toBe(
      "2026-11-01T01:00",
    );
  });

  it("handles a positive half-hour offset zone (Asia/Kolkata, +05:30)", () => {
    const iso = "2026-01-15T00:00:00Z";
    expect(instantToLocalInput(iso, "Asia/Kolkata")).toBe("2026-01-15T05:30");
    expect(localInputToInstant("2026-01-15T05:30", "Asia/Kolkata")).toBe(
      "2026-01-15T00:00:00.000Z",
    );
  });
});

describe("formatInstant / formatDateOnly", () => {
  it("formats using the given zone, not the host zone", () => {
    const iso = "2026-01-15T00:00:00Z";
    const chicago = formatInstant(iso, "America/Chicago");
    const kolkata = formatInstant(iso, "Asia/Kolkata");
    expect(chicago).not.toBe(kolkata);
  });

  it("tolerates a naive string by treating it as UTC", () => {
    expect(() => formatInstant("2026-01-15T00:00:00", "UTC")).not.toThrow();
    expect(() => formatDateOnly("2026-01-15T00:00:00", "UTC")).not.toThrow();
  });
});

describe("zoneAbbreviation", () => {
  it("returns a short zone name distinguishing two zones", () => {
    const at = new Date("2026-01-15T00:00:00Z");
    expect(zoneAbbreviation("America/Chicago", at)).not.toBe(
      zoneAbbreviation("Asia/Kolkata", at),
    );
  });
});

describe("allZones", () => {
  it("returns a non-empty list including UTC", () => {
    const zones = allZones();
    expect(zones.length).toBeGreaterThan(0);
    expect(zones).toContain("UTC");
  });
});
