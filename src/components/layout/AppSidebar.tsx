import { NavUser } from "@/components/layout/NavUser";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { canRead, canReadAnyTracking, isAdmin } from "@/lib/auth/scopes";
import { store, type View } from "@/store/store";
import { ADMIN_ITEMS, RESUME_ITEMS, SECONDARY_ITEMS, TRACKING_ITEMS, type NavItem } from "@/store/navItems";
import { navItemForView } from "@/store/views";
import { useStore } from "@/store/useStore";

function NavGroup({
  label,
  items,
  activeGroup,
  className,
}: {
  label?: string;
  items: NavItem[];
  activeGroup: View;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <SidebarGroup className={className}>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.view}>
              <SidebarMenuButton
                isActive={activeGroup === item.view}
                tooltip={item.label}
                onClick={() => store.navigate(item.view)}
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { view, user, session } = useStore();
  const activeGroup = navItemForView(view);
  const trackingItems = TRACKING_ITEMS.filter((item) => canRead(user, item.entity!));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:px-0">
          <span className="truncate text-sm font-bold">resume-api</span>
        </div>
        {session && (
          <div className="truncate px-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            {session.apiBase}
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Resume Fine-Tuning" items={RESUME_ITEMS} activeGroup={activeGroup} />
        {canReadAnyTracking(user) && (
          <NavGroup label="Application Tracking" items={trackingItems} activeGroup={activeGroup} />
        )}
        {isAdmin(user) && (
          <NavGroup label="Administration" items={ADMIN_ITEMS} activeGroup={activeGroup} />
        )}
        <NavGroup items={SECONDARY_ITEMS} activeGroup={activeGroup} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
