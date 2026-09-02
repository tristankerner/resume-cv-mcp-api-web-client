import { describe, expect, it } from "vitest";

import { diffDocuments, sectionOf } from "@/lib/documents/diff";

describe("diffDocuments", () => {
  it("reports an added path when a key only exists on the right", () => {
    const rows = diffDocuments({ a: 1 }, { a: 1, b: 2 });
    expect(rows).toEqual([{ path: "b", kind: "added", left: undefined, right: 2 }]);
  });

  it("reports a removed path when a key only exists on the left", () => {
    const rows = diffDocuments({ a: 1, b: 2 }, { a: 1 });
    expect(rows).toEqual([{ path: "b", kind: "removed", left: 2, right: undefined }]);
  });

  it("reports a changed path when the value differs", () => {
    const rows = diffDocuments({ a: 1 }, { a: 2 });
    expect(rows).toEqual([{ path: "a", kind: "changed", left: 1, right: 2 }]);
  });

  it("does not report a path whose value is unchanged", () => {
    const rows = diffDocuments({ a: 1 }, { a: 1 });
    expect(rows).toEqual([]);
  });

  it("walks arrays with an index in the path", () => {
    const rows = diffDocuments({ jobs: [{ title: "a" }] }, { jobs: [{ title: "b" }] });
    expect(rows).toEqual([{ path: "jobs[0].title", kind: "changed", left: "a", right: "b" }]);
  });

  it("treats an empty array as a leaf, so growing it from empty is a remove-plus-add rather than a single change", () => {
    // "a" itself disappears (its empty-array leaf has no counterpart once
    // the right side recurses into elements) and "a[0]" appears — not a
    // single "changed" row. Documented here because it is the one place
    // this flattening scheme produces a less-than-obvious diff.
    const rows = diffDocuments({ a: [] }, { a: [1] });
    expect(rows).toEqual([
      { path: "a", kind: "removed", left: [], right: undefined },
      { path: "a[0]", kind: "added", left: undefined, right: 1 },
    ]);
  });

  it("sorts rows by path", () => {
    const rows = diffDocuments({ b: 1, a: 1 }, { b: 2, a: 2 });
    expect(rows.map((r) => r.path)).toEqual(["a", "b"]);
  });
});

describe("sectionOf", () => {
  it("returns the leading key of a dotted path", () => {
    expect(sectionOf("jobs[0].title")).toBe("jobs");
  });

  it("returns the whole path when there is no separator", () => {
    expect(sectionOf("summary")).toBe("summary");
  });
});
