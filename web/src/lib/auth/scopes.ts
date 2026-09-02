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
