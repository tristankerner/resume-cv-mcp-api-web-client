import { describe, expect, it } from "vitest";

import { decodeJwtExp } from "@/lib/auth/session";

function fakeJwt(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encoded}.signature`;
}

describe("decodeJwtExp", () => {
  it("reads exp from a well-formed token", () => {
    expect(decodeJwtExp(fakeJwt({ exp: 1_800_000_000, sub: "someone" }))).toBe(1_800_000_000);
  });

  it("handles base64url characters (-, _) that plain base64 does not use", () => {
    // A payload large/varied enough that its base64 encoding is virtually
    // certain to contain a '-' or '_' at least once, not just '+'/'/'.
    const token = fakeJwt({ exp: 1_800_000_000, sub: "ÿþýüû" });
    expect(decodeJwtExp(token)).toBe(1_800_000_000);
  });

  it("returns null when exp is missing", () => {
    expect(decodeJwtExp(fakeJwt({ sub: "someone" }))).toBeNull();
  });

  it("returns null when exp is not a number", () => {
    expect(decodeJwtExp(fakeJwt({ exp: "soon" }))).toBeNull();
  });

  it("returns null for a token with no payload segment", () => {
    expect(decodeJwtExp("not-a-jwt")).toBeNull();
  });

  it("returns null for a payload segment that is not valid base64", () => {
    expect(decodeJwtExp("header.***.signature")).toBeNull();
  });

  it("returns null for a payload segment that decodes to non-JSON", () => {
    const encoded = Buffer.from("not json").toString("base64url");
    expect(decodeJwtExp(`header.${encoded}.signature`)).toBeNull();
  });
});
