import { DOC_TYPES, type DocType } from "@/lib/config";

export interface User {
  id: number;
  username: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  active: boolean | null;
  roles: string[];
  scopes: string[];
  mfa_enrolled: boolean;
  timezone: string | null;
}

// Scope gating — UserDto.scopes drives what the UI offers, rather than
// discovering permissions by failing.
export function hasScope(user: User | null | undefined, scope: string): boolean {
  return !!user && Array.isArray(user.scopes) && user.scopes.includes(scope);
}

export function scopesForType(type: DocType) {
  return {
    read: `${type}:read`,
    write: `${type}:write`,
    delete: `${type}:delete`,
  };
}

export function readableTypes(user: User | null | undefined): DocType[] {
  return DOC_TYPES.filter((t) => hasScope(user, scopesForType(t).read));
}

export function writableTypes(user: User | null | undefined): DocType[] {
  return DOC_TYPES.filter((t) => hasScope(user, scopesForType(t).write));
}

export function isAdmin(user: User | null | undefined): boolean {
  return hasScope(user, "users:admin");
}

export type TrackingEntity = "applications" | "companies" | "contacts";

export function canRead(user: User | null | undefined, entity: TrackingEntity): boolean {
  return hasScope(user, `${entity}:read`);
}

export function canWrite(user: User | null | undefined, entity: TrackingEntity): boolean {
  return hasScope(user, `${entity}:write`);
}

export function canDelete(user: User | null | undefined, entity: TrackingEntity): boolean {
  return hasScope(user, `${entity}:delete`);
}

export function canReadAudit(user: User | null | undefined): boolean {
  return hasScope(user, "audit:read");
}

export function canReadAnyTracking(user: User | null | undefined): boolean {
  return canRead(user, "applications") || canRead(user, "companies") || canRead(user, "contacts");
}
