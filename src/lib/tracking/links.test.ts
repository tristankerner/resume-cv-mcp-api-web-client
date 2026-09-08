import { describe, expect, it } from "vitest";

import { isSafeHref, safeHref } from "@/lib/tracking/links";

describe("safeHref", () => {
  it("passes http and https through unchanged", () => {
    expect(safeHref("https://plaid.com/")).toBe("https://plaid.com/");
    expect(safeHref("http://example.test/jobs?id=1")).toBe("http://example.test/jobs?id=1");
  });

  it("trims surrounding whitespace", () => {
    expect(safeHref("  https://plaid.com/  ")).toBe("https://plaid.com/");
  });

  it("refuses script-bearing schemes however they are spelled", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("JaVaScRiPt:alert(1)")).toBeUndefined();
    expect(safeHref("\njavascript:alert(1)")).toBeUndefined();
    expect(safeHref("\tjavascript:alert(document.cookie)")).toBeUndefined();
    expect(safeHref("data:text/html;base64,PHNjcmlwdD4=")).toBeUndefined();
    expect(safeHref("vbscript:msgbox(1)")).toBeUndefined();
    expect(safeHref("file:///etc/passwd")).toBeUndefined();
  });

  it("refuses anything that is not an absolute URL", () => {
    expect(safeHref("plaid.com")).toBeUndefined();
    expect(safeHref("/relative/path")).toBeUndefined();
    expect(safeHref("")).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });

  it("isSafeHref mirrors safeHref", () => {
    expect(isSafeHref("https://plaid.com/")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
  });
});
