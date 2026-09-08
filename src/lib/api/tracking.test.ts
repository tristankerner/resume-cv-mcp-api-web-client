import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import { asDuplicateConflict, buildQuery } from "@/lib/api/tracking";

describe("buildQuery", () => {
  it("skips null, undefined and empty values", () => {
    expect(buildQuery({ a: null, b: undefined, c: "", d: "x" })).toBe("?d=x");
  });

  it("encodes special characters", () => {
    expect(buildQuery({ query: "a b&c" })).toBe("?query=a%20b%26c");
  });

  it("repeats a key once per element for array values", () => {
    expect(buildQuery({ status: ["rejected", "ghosted"] })).toBe("?status=rejected&status=ghosted");
  });

  it("returns an empty string when nothing is set", () => {
    expect(buildQuery({ a: null, b: undefined })).toBe("");
  });
});

describe("asDuplicateConflict", () => {
  it("returns the payload for a real 409 duplicate body", () => {
    const payload = {
      code: "duplicate_company",
      message: "3 companies already look like this.",
      candidates: [{ id: 1, label: "Plaid", match: "exact" as const, score: 1, hint: null }],
    };
    const err = new ApiError(409, "conflict", payload.message, null, payload);
    expect(asDuplicateConflict(err)).toEqual(payload);
  });

  it("returns null for a 409 with a plain string detail", () => {
    const err = new ApiError(409, "conflict", "applications reference this company");
    expect(asDuplicateConflict(err)).toBeNull();
  });

  it("returns null for a 422", () => {
    const err = new ApiError(422, "validation", "bad request", { field: ["required"] });
    expect(asDuplicateConflict(err)).toBeNull();
  });

  it("returns null for a non-ApiError", () => {
    expect(asDuplicateConflict(new Error("boom"))).toBeNull();
  });
});
