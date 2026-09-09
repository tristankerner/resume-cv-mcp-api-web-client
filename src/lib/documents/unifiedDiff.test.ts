import { parseDiff } from "react-diff-view";
import { describe, expect, it } from "vitest";

import { toUnifiedDiff } from "@/lib/documents/unifiedDiff";

function hunkCount(patch: string): number {
  const files = parseDiff(patch);
  return files[0]?.hunks?.length ?? 0;
}

describe("toUnifiedDiff", () => {
  it("produces a patch with no hunks for identical inputs", () => {
    const value = { a: 1, b: "two" };
    const patch = toUnifiedDiff(value, value, "left", "right");
    expect(hunkCount(patch)).toBe(0);
  });

  it("produces one hunk for a one-field change", () => {
    const left = { a: 1, b: "two" };
    const right = { a: 1, b: "three" };
    const patch = toUnifiedDiff(left, right, "left", "right");
    expect(hunkCount(patch)).toBe(1);
  });

  it("produces no hunks for key reordering — sortKeysDeep is doing its job", () => {
    const left = { a: 1, b: 2, c: 3 };
    const right = { c: 3, a: 1, b: 2 };
    const patch = toUnifiedDiff(left, right, "left", "right");
    expect(hunkCount(patch)).toBe(0);
  });

  it("carries the given file labels into the patch headers", () => {
    const patch = toUnifiedDiff({ a: 1 }, { a: 2 }, "revision 3", "revision 4");
    expect(patch).toContain("--- revision 3");
    expect(patch).toContain("+++ revision 4");
  });
});
