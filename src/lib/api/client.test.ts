import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, parseValidationErrors, request } from "@/lib/api/client";

describe("parseValidationErrors", () => {
  it("drops the leading body/query/path segment from loc", () => {
    const fields = parseValidationErrors([
      { loc: ["body", "username"], msg: "field required" },
    ]);
    expect(fields).toEqual({ username: ["field required"] });
  });

  it("joins nested loc segments with a dot, matching the document path notation", () => {
    const fields = parseValidationErrors([
      { loc: ["body", "roles", 0], msg: "value is not a valid enumeration member" },
    ]);
    expect(fields).toEqual({ "roles.0": ["value is not a valid enumeration member"] });
  });

  it("groups multiple messages for the same field", () => {
    const fields = parseValidationErrors([
      { loc: ["body", "password"], msg: "too short" },
      { loc: ["body", "password"], msg: "missing a digit" },
    ]);
    expect(fields).toEqual({ password: ["too short", "missing a digit"] });
  });

  it("keeps separate fields separate", () => {
    const fields = parseValidationErrors([
      { loc: ["body", "username"], msg: "field required" },
      { loc: ["body", "email"], msg: "not a valid email" },
    ]);
    expect(fields).toEqual({
      username: ["field required"],
      email: ["not a valid email"],
    });
  });
});

describe("request", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(status: number, body: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status,
        statusText: "Conflict",
        json: () => Promise.resolve(body),
      }),
    );
  }

  it("sets detail and payload from an object detail with a message", async () => {
    const conflict = {
      code: "duplicate_company",
      message: '3 companies already look like "Plaid".',
      candidates: [{ id: 12, label: "Plaid", match: "exact", score: 1.0, hint: null }],
    };
    mockFetch(409, { detail: conflict });

    await expect(request("POST", "/companies", { apiBase: "http://x", auth: false })).rejects.toSatisfy(
      (err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.detail).toBe(conflict.message);
        expect(apiErr.payload).toEqual(conflict);
        return true;
      },
    );
  });

  it("falls back to statusText for an object detail without a message", async () => {
    mockFetch(409, { detail: { code: "duplicate_company", candidates: [] } });

    await expect(request("POST", "/companies", { apiBase: "http://x", auth: false })).rejects.toSatisfy(
      (err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.detail).toBe("Conflict");
        expect(apiErr.payload).toEqual({ code: "duplicate_company", candidates: [] });
        return true;
      },
    );
  });
});
