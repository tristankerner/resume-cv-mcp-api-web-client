import {
  AppWindow,
  Briefcase,
  Building2,
  CircleUserRound,
  FileText,
  KeyRound,
  Shield,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { User } from "@/lib/auth/scopes";
import { canRead, canReadAnyTracking, isAdmin, type TrackingEntity } from "@/lib/auth/scopes";
import type { View } from "@/store/store";

export interface NavItem {
  view: View;
  label: string;
  icon: LucideIcon;
  entity?: TrackingEntity;
}

export const RESUME_ITEMS: NavItem[] = [{ view: "documents", label: "Documents", icon: FileText }];

export const TRACKING_ITEMS: NavItem[] = [
  { view: "applications", label: "Applications", icon: Briefcase, entity: "applications" },
  { view: "companies", label: "Companies", icon: Building2, entity: "companies" },
  { view: "contacts", label: "Contacts", icon: Users, entity: "contacts" },
];

export const ADMIN_ITEMS: NavItem[] = [
  { view: "admin-users", label: "Users", icon: UserCog },
  { view: "admin-oauth-clients", label: "OAuth clients", icon: AppWindow },
];

export const SECONDARY_ITEMS: NavItem[] = [
  { view: "api-keys", label: "API keys", icon: KeyRound },
  { view: "security", label: "Security", icon: Shield },
  { view: "account", label: "Account", icon: CircleUserRound },
];

export interface NavGroupItems {
  group: string;
  items: NavItem[];
}

// The single source of truth for "which nav-reachable views can this user
// see" — the sidebar and the command palette's Go to section both read
// this, so a view hidden from one is hidden from the other.
export function visibleNavGroups(user: User | null | undefined): NavGroupItems[] {
  const groups: NavGroupItems[] = [{ group: "Resume Fine-Tuning", items: RESUME_ITEMS }];

  if (canReadAnyTracking(user)) {
    groups.push({
      group: "Application Tracking",
      items: TRACKING_ITEMS.filter((item) => canRead(user, item.entity!)),
    });
  }
  if (isAdmin(user)) {
    groups.push({ group: "Administration", items: ADMIN_ITEMS });
  }
  groups.push({ group: "", items: SECONDARY_ITEMS });

  return groups;
}

export function visibleNavItems(user: User | null | undefined): NavItem[] {
  return visibleNavGroups(user).flatMap((g) => g.items);
}
