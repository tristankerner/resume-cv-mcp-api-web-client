import { SearchIcon } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { SessionCountdown } from "@/components/layout/SessionCountdown";
import { store, type View } from "@/store/store";
import { breadcrumbTrail, VIEW_META } from "@/store/views";
import { useStore } from "@/store/useStore";

export function SiteHeader() {
  const { view, session, crumb } = useStore();
  const trail = breadcrumbTrail(view);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {trail.map((v, i) => {
            const isLast = i === trail.length - 1;
            const label = isLast && crumb ? crumb : VIEW_META[v].label;
            return (
              <Fragment key={v}>
                <BreadcrumbItem className={isLast ? undefined : "hidden md:block"}>
                  {isLast ? (
                    <BreadcrumbPage className="truncate">{label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        store.navigate(v as View);
                      }}
                    >
                      {label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
        {session && <SessionCountdown session={session} />}
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setPaletteOpen(true)}
        >
          <SearchIcon />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
            ⌘K
          </kbd>
        </Button>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
