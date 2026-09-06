import { request } from "@/lib/api/client";
import type { User } from "@/lib/auth/scopes";

export interface Token {
  access_token: string;
  token_type: string;
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

export function me() {
  return request<User>("GET", "/users/me");
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  new_password_retype: string;
}

export function changePassword(body: ChangePasswordRequest) {
  return request<null>("POST", "/users/me/password", { body });
}
