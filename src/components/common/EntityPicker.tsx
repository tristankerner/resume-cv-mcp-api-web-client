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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { asDuplicateConflict } from "@/lib/api/tracking";
import { cn } from "@/lib/utils";

export interface EntityOption {
  id: number;
  label: string;
  hint?: string;
}

export interface EntityPickerProps<T> {
  value: number | null;
  // The current selection's display name — the caller usually already has
  // it, so the picker does not need to fetch it just to render the initial
  // state.
  valueLabel?: string | null;
  // `label` is always the resolved display label, even when `item` is null
  // (the silent-dedupe-select path below only has a DuplicateCandidate, not
  // a full T, so callers that need a name must read the third argument).
  onChange: (id: number | null, item: T | null, label: string) => void;
  search: (query: string) => Promise<T[]>;
  toOption: (item: T) => EntityOption;
  onCreate?: (name: string) => Promise<T>;
  groupBy?: (item: T) => string;
  allowNone?: boolean;
  noneLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  // REQUIRED when this picker is rendered inside a Dialog or AlertDialog.
  // A modal Dialog sets pointer-events:none on <body> and re-enables it only
  // inside its own content subtree; this picker's Popover portals to
  // document.body, which is a *sibling* of that subtree, not a descendant.
  // Without `modal`, the popover still renders — options are visible — but
  // they receive no pointer events and CommandInput never takes focus, so
  // search and selection silently do nothing. `modal` on the Popover gives
  // it its own dismissable layer with pointer events restored, fixing it.
  // (No jsdom/@testing-library/react in this project to regression-test
  // this with — see the project's dependency policy — so this comment is
  // the guardrail: if a picker goes into a dialog and stops responding to
  // clicks, this is why, and `modal` is the fix.)
  //
  // `modal` alone is not enough: Radix layers dialog-over-popover through
  // module-level state in @radix-ui/react-focus-scope, so the popover and
  // the dialog must resolve to the *same* copy of it. Let react-popover
  // drift to an older version than react-dialog and npm nests a second
  // copy, each scope gets its own stack, and the dialog's focus trap yanks
  // focus straight back out of this picker's input — visible, clickable,
  // impossible to type in. Keep the @radix-ui/* versions in package.json in
  // step; `npm ls @radix-ui/react-focus-scope` must show exactly one.
  modal?: boolean;
}

export function EntityPicker<T>({
  value,
  valueLabel,
  onChange,
  search,
  toOption,
  onCreate,
  groupBy,
  allowNone = false,
  noneLabel = "— none —",
  placeholder = "Search…",
  disabled = false,
  modal = false,
}: EntityPickerProps<T>) {
  const [label, setLabel] = useState(valueLabel ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // cmdk's highlighted row, controlled. Left to cmdk it highlights the first
  // row once and then loses the highlight for good as soon as that row drops
  // out of the results — which is every keystroke that narrows the list — so
  // Enter stops selecting anything. Owning it lets us re-point the highlight
  // at the first row each time the results change.
  const [highlight, setHighlight] = useState("");
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

  function runSearch(text: string) {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        setItems(await search(text));
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
      runSearch("");
    }
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    runSearch(next);
  }

  function select(id: number | null, item: T | null, optLabel: string) {
    lastAppliedValue.current = id;
    setLabel(optLabel);
    setOpen(false);
    onChange(id, item, optLabel);
  }

  const options = items.map((item) => ({ item, opt: toOption(item) }));
  const trimmed = query.trim();
  const exactMatch = options.some((o) => o.opt.label.toLowerCase() === trimmed.toLowerCase());
  const canCreate = !!onCreate && !disabled && trimmed.length > 0 && !exactMatch;

  // The row Enter should land on: the first result, else the "none" row, else
  // the inline-create row. Only changes when the result set does, so arrowing
  // around does not fight this.
  const firstValue = options.length
    ? String(options[0].opt.id)
    : allowNone
      ? "__none__"
      : canCreate
        ? `__create__${trimmed}`
        : "";

  useEffect(() => {
    setHighlight(firstValue);
  }, [firstValue]);

  async function createInline() {
    if (!onCreate) return;
    setBusy(true);
    setError(null);
    try {
      const created = await onCreate(trimmed);
      const opt = toOption(created);
      select(opt.id, created, opt.label);
    } catch (err) {
      const dup = asDuplicateConflict(err);
      if (dup) {
        const exact = dup.candidates.find((c) => c.match === "exact");
        if (exact) {
          // The user asked for an entity by this name and one exists —
          // adopt it silently rather than surfacing an error. We don't have
          // the full T for it, so callers relying on the second onChange
          // argument should treat null as "selected an existing row".
          select(exact.id, null, exact.label);
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

  const groups: [string | null, typeof options][] = [];
  if (groupBy) {
    const byKey = new Map<string, typeof options>();
    for (const o of options) {
      const key = groupBy(o.item);
      const arr = byKey.get(key);
      if (arr) arr.push(o);
      else byKey.set(key, [o]);
    }
    groups.push(...byKey.entries());
  } else {
    groups.push([null, options]);
  }

  function renderOption({ item, opt }: (typeof options)[number]) {
    const row = (
      <CommandItem key={opt.id} value={String(opt.id)} onSelect={() => select(opt.id, item, opt.label)}>
        <Check className={cn("size-4", value === opt.id ? "opacity-100" : "opacity-0")} />
        {opt.label}
      </CommandItem>
    );
    if (!opt.hint) return row;
    return (
      <HoverCard key={opt.id} openDelay={300}>
        <HoverCardTrigger asChild>{row}</HoverCardTrigger>
        <HoverCardContent side="right" className="w-auto max-w-xs text-sm">
          {opt.hint}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return (
    <div>
      <Popover open={open} onOpenChange={handleOpenChange} modal={modal}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !label && "text-muted-foreground")}>{label || placeholder}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false} value={highlight} onValueChange={setHighlight}>
            <CommandInput placeholder={placeholder} value={query} onValueChange={handleQueryChange} />
            <CommandList>
              <CommandEmpty>{canCreate ? null : "No results found."}</CommandEmpty>
              {allowNone && (
                <CommandGroup>
                  <CommandItem value="__none__" onSelect={() => select(null, null, "")}>
                    <Check className={cn("size-4", value === null ? "opacity-100" : "opacity-0")} />
                    {noneLabel}
                  </CommandItem>
                </CommandGroup>
              )}
              {groups.map(([key, rows]) =>
                rows.length === 0 ? null : (
                  <CommandGroup key={key ?? "__ungrouped__"} heading={key ?? undefined}>
                    {rows.map(renderOption)}
                  </CommandGroup>
                ),
              )}
              {canCreate && (
                <CommandGroup>
                  <CommandItem value={`__create__${trimmed}`} disabled={busy} onSelect={createInline}>
                    {busy ? <Spinner /> : <Check className="size-4 opacity-0" />}
                    {busy ? "Creating…" : `Create "${trimmed}"`}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
