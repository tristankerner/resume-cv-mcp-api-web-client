import { Button } from "@/components/ui/button";
import { isAdmin } from "@/lib/auth/scopes";
import { store, type View } from "@/store/store";
import { useStore } from "@/store/useStore";

const NAV_ITEMS: { view: View; label: string }[] = [
  { view: "documents", label: "Documents" },
  { view: "api-keys", label: "API keys" },
  { view: "security", label: "Security" },
  { view: "account", label: "Account" },
];

const ADMIN_NAV_ITEMS: { view: View; label: string }[] = [
  { view: "admin-users", label: "Users" },
  { view: "admin-oauth-clients", label: "OAuth clients" },
];

export function Nav() {
  const { view, user } = useStore();
  const items = isAdmin(user) ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Button
          key={item.view}
          variant="ghost"
          size="sm"
          className={
            view === item.view
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
