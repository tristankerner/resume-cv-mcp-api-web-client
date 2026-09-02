import { describe, expect, it } from "vitest";

import { validateDocumentName } from "@/lib/documents/names";

describe("validateDocumentName", () => {
  it("accepts an ordinary name", () => {
    expect(validateDocumentName("resume-2026")).toBeNull();
  });

  it("rejects a blank name", () => {
    expect(validateDocumentName("")).toMatch(/blank/);
    expect(validateDocumentName("   ")).toMatch(/blank/);
  });

  it("rejects a forward slash", () => {
    expect(validateDocumentName("a/b")).toMatch(/path separator/);
  });

  it("rejects a backslash", () => {
    expect(validateDocumentName("a\\b")).toMatch(/path separator/);
  });

  it("rejects control characters", () => {
    expect(validateDocumentName("a\nb")).toMatch(/control characters/);
    expect(validateDocumentName("a\x7fb")).toMatch(/control characters/);
  });

  it("rejects a name over 255 characters", () => {
    expect(validateDocumentName("a".repeat(256))).toMatch(/255 characters/);
  });

  it("accepts a name at exactly 255 characters", () => {
    expect(validateDocumentName("a".repeat(255))).toBeNull();
  });
});
