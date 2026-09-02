import { request } from "@/lib/api/client";

// The single place every admin-only route is spelled — see the risk note in
// the plan this shipped from: the API side of these landed in a separate
// change, so a later rename only has to touch this file.

export type Role = "admin" | "member";

export interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  active: boolean;
  roles: Role[];
  failed_login_count: number;
  locked_until: string | null;
  locked_permanently_at: string | null;
  mfa_enrolled: boolean;
  locked: boolean;
}

export interface ListUsersResponse {
  data: AdminUser[];
}

export interface CreateUserRequest {
  username: string;
  password: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  disabled?: boolean | null;
  roles: Role[];
}

export interface CreateUserResponse {
  id: number;
}

export interface AdminResetPasswordRequest {
  new_password: string;
  new_password_retype: string;
}

export function listUsers() {
  return request<ListUsersResponse>("GET", "/users");
}

export function createUser(body: CreateUserRequest) {
  return request<CreateUserResponse>("POST", "/users", { body });
}

export function resetPassword(userId: number, body: AdminResetPasswordRequest) {
  return request<null>("POST", `/users/${userId}/password`, { body });
}

export function unlockUser(userId: number) {
  return request<null>("DELETE", `/users/${userId}/lock`);
}

export function resetMfa(userId: number) {
  return request<null>("DELETE", `/users/${userId}/mfa`);
}

// --- OAuth clients ------------------------------------------------------

export interface AdminOAuthClient {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string | null;
  created_at: string;
  confidential: boolean;
}

export interface ListClientsResponse {
  data: AdminOAuthClient[];
}

export interface AdminCreateClientRequest {
  client_name: string;
  redirect_uris: string[];
  public: boolean;
  scope?: string | null;
}

export interface AdminCreateClientResponse {
  client: AdminOAuthClient;
  client_secret: string | null;
}

export function listOAuthClients() {
  return request<ListClientsResponse>("GET", "/oauth-clients");
}

export function createOAuthClient(body: AdminCreateClientRequest) {
  return request<AdminCreateClientResponse>("POST", "/oauth-clients", { body });
}

export function deleteOAuthClient(clientId: string) {
  return request<null>("DELETE", `/oauth-clients/${encodeURIComponent(clientId)}`);
}
