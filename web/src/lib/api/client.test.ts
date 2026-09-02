import { describe, expect, it } from "vitest";

import { parseValidationErrors } from "@/lib/api/client";

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
