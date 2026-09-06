import { request } from "@/lib/api/client";

export type MfaMethodKind = "totp" | "backup_codes";

export interface AvailableMfaMethod {
  kind: MfaMethodKind;
  label: string;
  allows_multiple: boolean;
}

export interface MfaCredentialStatus {
  id: number;
  kind: MfaMethodKind;
  label: string;
  created_at: string;
  activated_at: string | null;
  last_used_at: string | null;
  remaining: number | null;
}

export interface MfaStatusResponse {
  enrolled: boolean;
  credentials: MfaCredentialStatus[];
  available_methods: AvailableMfaMethod[];
  backup_codes_remaining: number | null;
}

export interface EnrollTotpRequest {
  label: string;
  current_password: string;
}

export interface EnrollTotpResponse {
  credential_id: number;
  kind: MfaMethodKind;
  label: string;
  secret: string;
  otpauth_uri: string;
}

export interface PasswordConfirmRequest {
  current_password: string;
}

export interface BackupCodesResponse {
  credential_id: number;
  kind: MfaMethodKind;
  codes: string[];
}

export function mfaStatus() {
  return request<MfaStatusResponse>("GET", "/users/me/mfa");
}

export function enrollTotp(body: EnrollTotpRequest) {
  return request<EnrollTotpResponse>("POST", "/users/me/mfa/totp", { body });
}

export function activateTotp(id: number, body: { code: string }) {
  return request<null>("POST", `/users/me/mfa/totp/${id}/activate`, { body });
}

export function regenerateBackupCodes(body: PasswordConfirmRequest) {
  return request<BackupCodesResponse>("POST", "/users/me/mfa/backup-codes", { body });
}

export function removeMfa(id: number, body: PasswordConfirmRequest) {
  return request<null>("DELETE", `/users/me/mfa/${id}`, { body });
}

export function mfaKindLabel(kind: MfaMethodKind): string {
  return kind === "totp" ? "Authenticator app" : "Backup codes";
}
