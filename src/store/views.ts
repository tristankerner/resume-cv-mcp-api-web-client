import type { View } from "@/store/store";

export type NavGroupId = "resume-fine-tuning" | "application-tracking" | "administration" | "secondary";

export interface ViewMeta {
  label: string;
  group: NavGroupId;
  // Breadcrumb ancestor; absent means top level.
  parent?: View;
  // Sidebar item to highlight; defaults to parent ?? the view itself.
  navItem?: View;
}

export const VIEW_META: Record<View, ViewMeta> = {
  documents: { label: "Documents", group: "resume-fine-tuning" },
  create: { label: "New document", group: "resume-fine-tuning", parent: "documents" },
  edit: { label: "Edit document", group: "resume-fine-tuning", parent: "documents" },

  applications: { label: "Applications", group: "application-tracking" },
  application: { label: "Application", group: "application-tracking", parent: "applications" },
  "application-create": {
    label: "New application",
    group: "application-tracking",
    parent: "applications",
  },

  companies: { label: "Companies", group: "application-tracking" },
  company: { label: "Company", group: "application-tracking", parent: "companies" },
  "company-create": { label: "New company", group: "application-tracking", parent: "companies" },

  contacts: { label: "Contacts", group: "application-tracking" },
  contact: { label: "Contact", group: "application-tracking", parent: "contacts" },
  "contact-create": { label: "New contact", group: "application-tracking", parent: "contacts" },

  "api-keys": { label: "API keys", group: "secondary" },
  security: { label: "Security", group: "secondary" },
  account: { label: "Account", group: "secondary" },

  "admin-users": { label: "Users", group: "administration" },
  "admin-oauth-clients": { label: "OAuth clients", group: "administration" },
};

// Which sidebar item a view should highlight — a detail or create view
// highlights its list item rather than nothing.
export function navItemForView(view: View): View {
  const meta = VIEW_META[view];
  return meta.navItem ?? meta.parent ?? view;
}

// Breadcrumb ancestor chain, root first, current view last.
export function breadcrumbTrail(view: View): View[] {
  const trail: View[] = [];
  let current: View | undefined = view;
  const seen = new Set<View>();
  while (current && !seen.has(current)) {
    seen.add(current);
    trail.unshift(current);
    current = VIEW_META[current].parent;
  }
  return trail;
}
