import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { browserCanUsePasskeys, passkeyErrorMessage } from "@/lib/auth/webauthn";
import { WebAuthnError } from "@simplewebauthn/browser";

function webAuthnError(name: string) {
  const cause = new DOMException("boom", name);
  return new WebAuthnError({ message: "boom", code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", cause });
}

describe("passkeyErrorMessage", () => {
  it("returns null for NotAllowedError — the user cancelled or the request timed out", () => {
    expect(passkeyErrorMessage(webAuthnError("NotAllowedError"))).toBeNull();
  });

  it("returns null for AbortError", () => {
    expect(passkeyErrorMessage(webAuthnError("AbortError"))).toBeNull();
  });

  it("returns a specific message for InvalidStateError", () => {
    expect(passkeyErrorMessage(webAuthnError("InvalidStateError"))).toBe(
      "That authenticator is already registered on this account.",
    );
  });

  it("returns a specific message for SecurityError", () => {
    expect(passkeyErrorMessage(webAuthnError("SecurityError"))).toBe(
      "This page's address is not one the server allows passkeys from.",
    );
  });

  it("falls through to errorMessage for a plain Error", () => {
    expect(passkeyErrorMessage(new Error("network down"))).toBe("Error: network down");
  });

  it("falls through to errorMessage for an ApiError, so a network failure reads sensibly", () => {
    expect(passkeyErrorMessage(new ApiError(0, "network", "Could not reach the server."))).toBe(
      "Could not reach the server.",
    );
  });
});

describe("browserCanUsePasskeys", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false when window.isSecureContext is false", () => {
    vi.stubGlobal("window", { isSecureContext: false, PublicKeyCredential: function () {} });
    expect(browserCanUsePasskeys()).toBe(false);
  });
});
