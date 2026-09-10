import { request } from "@/lib/api/client";

export interface PasskeyStatus {
  id: number;
  label: string;
  created_at: string;
  last_used_at: string | null;
  // "single_device" | "multi_device", straight off the authenticator's BE/BS
  // flags. Rendered as the difference between "this device only" and "synced".
  device_type: string;
  backed_up: boolean;
}

export interface PasskeyListResponse {
  enabled: boolean;
  credentials: PasskeyStatus[];
}

// `options` is passed to the browser untouched — the W3C's schema, not this
// client's, so it is deliberately not modelled here.
export interface PasskeyOptionsResponse {
  options: Record<string, unknown>;
  expires_in: number;
}

export interface PasskeyRegistrationOptionsResponse extends PasskeyOptionsResponse {
  registration_token: string;
}

export interface PasskeyAuthenticationOptionsResponse extends PasskeyOptionsResponse {
  login_token: string;
}

export function listPasskeys() {
  return request<PasskeyListResponse>("GET", "/users/me/passkeys");
}

export function passkeyRegistrationOptions(body: { current_password: string }) {
  return request<PasskeyRegistrationOptionsResponse>("POST", "/users/me/passkeys/options", { body });
}

export function registerPasskey(body: {
  registration_token: string;
  label: string;
  credential: unknown;
}) {
  return request<PasskeyStatus>("POST", "/users/me/passkeys", { body });
}

export function renamePasskey(id: number, body: { label: string }) {
  return request<PasskeyStatus>("PATCH", `/users/me/passkeys/${id}`, { body });
}

export function removePasskey(id: number, body: { current_password: string }) {
  return request<null>("DELETE", `/users/me/passkeys/${id}`, { body });
}

// Human wording for `device_type`. Kept beside the type it describes, the way
// mfaKindLabel sits in lib/api/mfa.ts.
export function passkeyStorageLabel(status: PasskeyStatus): string {
  return status.device_type === "multi_device" ? "Synced" : "This device only";
}
