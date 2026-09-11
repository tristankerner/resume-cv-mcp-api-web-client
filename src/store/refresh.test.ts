import { describe, expect, it } from "vitest";

import { bump, changed, INITIAL_REVISIONS } from "@/store/refresh";

describe("bump", () => {
  it("increments only the named keys", () => {
    const next = bump(INITIAL_REVISIONS, ["applications", "events"]);
    expect(next.applications).toBe(1);
    expect(next.events).toBe(1);
    expect(next.companies).toBe(0);
    expect(next.contacts).toBe(0);
    expect(next.attachments).toBe(0);
    expect(next.audit).toBe(0);
  });

  it("returns a new object", () => {
    const next = bump(INITIAL_REVISIONS, ["applications"]);
    expect(next).not.toBe(INITIAL_REVISIONS);
  });

  it("is a no-op with an empty list", () => {
    const next = bump(INITIAL_REVISIONS, []);
    expect(next).toEqual(INITIAL_REVISIONS);
  });
});

describe("changed", () => {
  it("is false for identical snapshots", () => {
    const a = { ...INITIAL_REVISIONS };
    const b = { ...INITIAL_REVISIONS };
    expect(changed(a, b, ["applications", "companies"])).toBe(false);
  });

  it("is true for a single differing key", () => {
    const a = { ...INITIAL_REVISIONS };
    const b = bump(INITIAL_REVISIONS, ["applications"]);
    expect(changed(a, b, ["applications"])).toBe(true);
  });

  it("is false when the differing key is not in resources", () => {
    const a = { ...INITIAL_REVISIONS };
    const b = bump(INITIAL_REVISIONS, ["applications"]);
    expect(changed(a, b, ["companies", "contacts"])).toBe(false);
  });
});
