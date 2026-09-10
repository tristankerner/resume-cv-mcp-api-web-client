import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  WebAuthnError,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

import { errorMessage } from "@/lib/api/client";

// Whether this *page* could run a ceremony at all, independent of what the
// server supports. `isSecureContext` is the check people forget: WebAuthn is
// unavailable over plain http and from file://, and the single-file build is
// routinely opened both ways — see lib/auth/session.ts on why file:// is a
// supported way to run this client.
export function browserCanUsePasskeys(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && browserSupportsWebAuthn();
}

export function browserSupportsAutofill(): Promise<boolean> {
  return browserSupportsWebAuthnAutofill();
}

// Both take the server's `options` blob straight through and return the
// credential blob to post back — this module never inspects either, because
// the shape is the W3C's and re-declaring it here would be a second copy to
// maintain against the server's.
export async function createCredential(optionsJSON: PublicKeyCredentialCreationOptionsJSON) {
  return startRegistration({ optionsJSON });
}

export async function getCredential(
  optionsJSON: PublicKeyCredentialRequestOptionsJSON,
  useBrowserAutofill = false,
) {
  return startAuthentication({ optionsJSON, useBrowserAutofill });
}

// The DOMException names a ceremony can fail with, in the words a user can act
// on. `NotAllowedError` covers both "cancelled" and "timed out" — the browser
// deliberately does not distinguish them, because doing so would tell a page
// whether a credential existed.
//
// `null` means "say nothing". A user who pressed Escape does not need an
// error banner telling them they pressed Escape. Every call site must treat
// `null` as "clear the error and stop", not as "show an empty banner".
export function passkeyErrorMessage(err: unknown): string | null {
  if (!(err instanceof WebAuthnError) && !(err instanceof DOMException)) {
    return errorMessage(err);
  }
  switch (err.name) {
    case "NotAllowedError":
    case "AbortError":
      return null;
    case "InvalidStateError":
      return "That authenticator is already registered on this account.";
    case "SecurityError":
      return "This page's address is not one the server allows passkeys from.";
    case "NotSupportedError":
      return "This device cannot create the kind of passkey the server asked for.";
    default:
      return "Your device could not complete the passkey request.";
  }
}
