import { describe, expect, it } from "vitest";

import { resolveTheme } from "@/lib/theme";

describe("resolveTheme", () => {
  it("passes through an explicit light preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
  });

  it("passes through an explicit dark preference", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS preference when system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
