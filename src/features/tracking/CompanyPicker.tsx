import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import * as companiesApi from "@/lib/api/companies";
import { asDuplicateConflict } from "@/lib/api/tracking";
import { canWrite } from "@/lib/auth/scopes";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";

interface CompanyOption {
  id: number | null;
  name: string;
}

const NONE_OPTION: CompanyOption = { id: null, name: "— no company —" };

export function CompanyPicker({
  value,
  valueLabel,
  onChange,
  allowCreate = false,
  allowNone = false,
  placeholder = "Search companies…",
}: {
  value: number | null;
  // The current selection's display name — the caller usually already has
  // it (company_name on the row being edited), so the picker does not need
  // to fetch it just to render the initial state.
  valueLabel?: string | null;
  onChange: (id: number | null, name: string | null) => void;
  allowCreate?: boolean;
  allowNone?: boolean;
  placeholder?: string;
}) {
  const { user } = useStore();
  const [label, setLabel] = useState(valueLabel ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  // Selecting a row sets `label` directly; this effect only needs to react
  // to the value changing out from under the picker (e.g. a parent
  // resetting the form), not to every keystroke that already updated it.
  const lastAppliedValue = useRef(value);

  useEffect(() => {
    if (lastAppliedValue.current === value) return;
    lastAppliedValue.current = value;
    setLabel(value === null ? "" : (valueLabel ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function search(text: string) {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const resp = await companiesApi.listCompanies({ query: text, limit: 10 });
        setOptions(resp.data.map((c) => ({ id: c.id, name: c.name })));
      } catch {
        // A live-search dropdown swallows load errors rather than banner-ing them.
      }
    }, 300);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      setError(null);
      search("");
    }
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    search(next);
  }

  function select(option: CompanyOption) {
    lastAppliedValue.current = option.id;
    setLabel(option.name);
    setOpen(false);
    onChange(option.id, option.id === null ? null : option.name);
  }

  const trimmed = query.trim();
  const exactMatch = options.some((o) => o.name.toLowerCase() === trimmed.toLowerCase());
  const canCreate = allowCreate && canWrite(user, "companies") && trimmed.length > 0 && !exactMatch;

  async function createInline() {
    setBusy(true);
    setError(null);
    try {
      const created = await companiesApi.createCompany({ name: trimmed });
      select({ id: created.id, name: created.name });
    } catch (err) {
      const dup = asDuplicateConflict(err);
      if (dup) {
        const exact = dup.candidates.find((c) => c.match === "exact");
        if (exact) {
          select({ id: exact.id, name: exact.label });
          return;
        }
        setError(dup.message);
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const rows: CompanyOption[] = allowNone ? [NONE_OPTION, ...options] : options;

  return (
    <div>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !label && "text-muted-foreground")}>
              {label || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={placeholder} value={query} onValueChange={handleQueryChange} />
            <CommandList>
              <CommandEmpty>{canCreate ? null : "No companies found."}</CommandEmpty>
              <CommandGroup>
                {rows.map((row) => (
                  <CommandItem key={row.id ?? "none"} value={String(row.id)} onSelect={() => select(row)}>
                    <Check className={cn("size-4", value === row.id ? "opacity-100" : "opacity-0")} />
                    {row.name}
                  </CommandItem>
                ))}
                {canCreate && (
                  <CommandItem value={`__create__${trimmed}`} disabled={busy} onSelect={createInline}>
                    {busy ? <Spinner /> : <Check className="size-4 opacity-0" />}
                    {busy ? "Creating…" : `Create "${trimmed}"`}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
