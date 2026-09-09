import { Briefcase, Building2, PlusIcon, Users } from "lucide-react";
import { useEffect, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import * as applicationsApi from "@/lib/api/applications";
import * as companiesApi from "@/lib/api/companies";
import * as contactsApi from "@/lib/api/contacts";
import { canRead, canWrite } from "@/lib/auth/scopes";
import { store } from "@/store/store";
import { visibleNavGroups } from "@/store/navItems";
import { useStore } from "@/store/useStore";

const SEARCH_LIMIT = 8;
const DEBOUNCE_MS = 300;

interface SearchResults {
  applications: applicationsApi.ApplicationSummary[];
  companies: companiesApi.CompanySummary[];
  contacts: contactsApi.Contact[];
}

const EMPTY_RESULTS: SearchResults = { applications: [], companies: [], contacts: [] };

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(EMPTY_RESULTS);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === "") {
      setResults(EMPTY_RESULTS);
      return;
    }
    const handle = setTimeout(async () => {
      const [applications, companies, contacts] = await Promise.all([
        canRead(user, "applications")
          ? applicationsApi.listApplications({ query: trimmed, limit: SEARCH_LIMIT }).catch(() => null)
          : Promise.resolve(null),
        canRead(user, "companies")
          ? companiesApi.listCompanies({ query: trimmed, limit: SEARCH_LIMIT }).catch(() => null)
          : Promise.resolve(null),
        canRead(user, "contacts")
          ? contactsApi.listContacts({ query: trimmed, limit: SEARCH_LIMIT }).catch(() => null)
          : Promise.resolve(null),
      ]);
      setResults({
        applications: applications?.data ?? [],
        companies: companies?.data ?? [],
        contacts: contacts?.data ?? [],
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, user]);

  function go(view: Parameters<typeof store.navigate>[0], params?: Parameters<typeof store.navigate>[1]) {
    store.navigate(view, params ?? null);
    onOpenChange(false);
  }

  const trimmedQuery = query.trim().toLowerCase();
  const navGroups = visibleNavGroups(user)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(trimmedQuery)),
    }))
    .filter((group) => group.items.length > 0);
  const hasSearchResults =
    results.applications.length > 0 || results.companies.length > 0 || results.contacts.length > 0;
  // Not a NavItem — it doesn't navigate to a View — so it isn't sourced from
  // navItems.ts like the groups above; gated the same way the header button is.
  const showNewEvent = canWrite(user, "applications") && "new event".includes(trimmedQuery);
  const hasAnyResults = navGroups.length > 0 || hasSearchResults || showNewEvent;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Jump to a page, or search applications, companies and contacts."
      shouldFilter={false}
    >
      <CommandInput placeholder="Go to a page, or search…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{hasAnyResults ? null : "No results found."}</CommandEmpty>
        {showNewEvent && (
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                store.openEventComposer();
                onOpenChange(false);
              }}
            >
              <PlusIcon />
              New event
            </CommandItem>
          </CommandGroup>
        )}
        {navGroups.map((group) => (
          <CommandGroup key={group.group || "secondary"} heading={group.group || "Go to"}>
            {group.items.map((item) => (
              <CommandItem key={item.view} onSelect={() => go(item.view)}>
                <item.icon />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {hasSearchResults && navGroups.length > 0 && <CommandSeparator />}
        {results.applications.length > 0 && (
          <CommandGroup heading="Applications">
            {results.applications.map((app) => (
              <CommandItem key={app.id} onSelect={() => go("application", { id: app.id })}>
                <Briefcase />
                {app.job_title || "Untitled application"}
                <span className="ml-2 text-muted-foreground">{app.company_name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.companies.length > 0 && (
          <CommandGroup heading="Companies">
            {results.companies.map((company) => (
              <CommandItem key={company.id} onSelect={() => go("company", { id: company.id })}>
                <Building2 />
                {company.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.contacts.length > 0 && (
          <CommandGroup heading="Contacts">
            {results.contacts.map((contact) => {
              const name =
                [contact.last_name, contact.first_name].filter(Boolean).join(", ") ||
                contact.email ||
                "Contact";
              return (
                <CommandItem key={contact.id} onSelect={() => go("contact", { id: contact.id })}>
                  <Users />
                  {name}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
