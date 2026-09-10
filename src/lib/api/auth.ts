import { request } from "@/lib/api/client";
import type { PasskeyAuthenticationOptionsResponse } from "@/lib/api/passkeys";
import type { User } from "@/lib/auth/scopes";

export interface Token {
  access_token: string;
  token_type: string;
  refresh_token: string;
}

export interface MfaRequiredResponse {
  mfa_required: true;
  mfa_token: string;
  methods: string[];
  expires_in: number;
}

export type LoginResult = Token | MfaRequiredResponse;

export function isMfaRequired(result: LoginResult): result is MfaRequiredResponse {
  return "mfa_required" in result && result.mfa_required === true;
}

export function login(apiBase: string, username: string, password: string) {
  return request<LoginResult>("POST", "/token", {
    form: { username, password },
    auth: false,
    apiBase,
  });
}

export function completeMfa(apiBase: string, mfaToken: string, code: string) {
  return request<Token>("POST", "/token/mfa", {
    form: { mfa_token: mfaToken, code },
    auth: false,
    apiBase,
  });
}

// Both authenticate with the refresh token in the body, not the (possibly
// expired) bearer header — same reasoning as login/completeMfa above.
export function refresh(apiBase: string, refreshToken: string) {
  return request<Token>("POST", "/token/refresh", {
    form: { refresh_token: refreshToken },
    auth: false,
    apiBase,
  });
}

export function logout(apiBase: string, refreshToken: string) {
  return request<null>("POST", "/token/logout", {
    form: { refresh_token: refreshToken },
    auth: false,
    apiBase,
  });
}

export function me() {
  return request<User>("GET", "/users/me");
}

export interface UpdateUserRequest {
  timezone?: string | null;
}

// A user may set their own timezone without `users:admin` — see Appendix
// A.2 of the feature plan.
export function updateUser(userId: number, body: UpdateUserRequest) {
  return request<User>("PATCH", `/users/${userId}`, { body });
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  new_password_retype: string;
}

export function changePassword(body: ChangePasswordRequest) {
  return request<null>("POST", "/users/me/password", { body });
}

export interface AuthCapabilities {
  passkeys: boolean;
}

// Anonymous, and called before login: the login screen has to know whether to
// offer a passkey button, and only the server knows whether WEBAUTHN_RP_ID is
// configured.
export function capabilities(apiBase: string) {
  return request<AuthCapabilities>("GET", "/auth/capabilities", { auth: false, apiBase });
}

// JSON, not form-encoded, unlike login/completeMfa above: a WebAuthn credential
// is a nested object with base64url leaves, and flattening it into form fields
// would mean inventing an encoding on both sides of the wire.
export function passkeyOptions(apiBase: string, username?: string) {
  return request<PasskeyAuthenticationOptionsResponse>("POST", "/token/passkey/options", {
    body: { username: username || null },
    auth: false,
    apiBase,
  });
}

export function passkeyLogin(apiBase: string, loginToken: string, credential: unknown) {
  return request<Token>("POST", "/token/passkey", {
    body: { login_token: loginToken, credential },
    auth: false,
    apiBase,
  });
}
