import { describe, expect, it } from "vitest";

import { passwordComplexityChecks } from "@/lib/passwords";

function metLabels(pw: string): string[] {
  return passwordComplexityChecks(pw)
    .filter((c) => c.met)
    .map((c) => c.label);
}

describe("passwordComplexityChecks", () => {
  it("fails everything for an empty password", () => {
    expect(metLabels("")).toEqual([]);
  });

  it("passes every check for a password meeting all rules", () => {
    const checks = passwordComplexityChecks("Abcdefg1!");
    expect(checks.every((c) => c.met)).toBe(true);
  });

  it("requires at least 8 characters", () => {
    expect(metLabels("Ab1!")).not.toContain("At least 8 characters");
    expect(metLabels("Ab1!Ab1!")).toContain("At least 8 characters");
  });

  it("is Unicode-aware for upper/lowercase, matching the server's str.isupper/islower", () => {
    // "Éxample1!" has an uppercase É, a lowercase x, a digit and punctuation —
    // an ASCII-only [A-Z] check would miss the É and wrongly fail this.
    const checks = passwordComplexityChecks("Éxample1!");
    expect(checks.every((c) => c.met)).toBe(true);
  });

  it("recognizes punctuation from the server's string.punctuation set", () => {
    expect(metLabels("Abcdefg1~")).toContain("A special character");
    expect(metLabels("Abcdefg1")).not.toContain("A special character");
  });
});
