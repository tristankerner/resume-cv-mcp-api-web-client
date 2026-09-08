import { Button } from "@/components/ui/button";
import { canRead, isAdmin, type TrackingEntity } from "@/lib/auth/scopes";
import { store, type View } from "@/store/store";
import { useStore } from "@/store/useStore";

const NAV_ITEMS: { view: View; label: string }[] = [{ view: "documents", label: "Documents" }];

const TRACKING_NAV_ITEMS: { view: View; label: string; entity: TrackingEntity }[] = [
  { view: "applications", label: "Applications", entity: "applications" },
  { view: "companies", label: "Companies", entity: "companies" },
  { view: "contacts", label: "Contacts", entity: "contacts" },
];

const TAIL_NAV_ITEMS: { view: View; label: string }[] = [
  { view: "api-keys", label: "API keys" },
  { view: "security", label: "Security" },
  { view: "account", label: "Account" },
];

const ADMIN_NAV_ITEMS: { view: View; label: string }[] = [
  { view: "admin-users", label: "Users" },
  { view: "admin-oauth-clients", label: "OAuth clients" },
];

// A detail or create view must highlight its list item in the nav rather
// than nothing at all; this also fixes the pre-existing gap where the
// Documents item unhighlighted on the edit screen.
const NAV_GROUP: Partial<Record<View, View>> = {
  application: "applications",
  "application-create": "applications",
  company: "companies",
  "company-create": "companies",
  contact: "contacts",
  "contact-create": "contacts",
  create: "documents",
  edit: "documents",
};

export function Nav() {
  const { view, user } = useStore();
  const items = [
    ...NAV_ITEMS,
    ...TRACKING_NAV_ITEMS.filter((item) => canRead(user, item.entity)),
    ...TAIL_NAV_ITEMS,
    ...(isAdmin(user) ? ADMIN_NAV_ITEMS : []),
  ];
  const activeGroup = NAV_GROUP[view] ?? view;

  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Button
          key={item.view}
          variant="ghost"
          size="sm"
          className={
            activeGroup === item.view
              ? "bg-secondary text-secondary-foreground font-semibold"
              : "text-muted-foreground"
          }
          onClick={() => store.navigate(item.view)}
        >
          {item.label}
        </Button>
      ))}
    </nav>
  );
}
