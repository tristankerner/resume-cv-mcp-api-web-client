import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";
import * as companiesApi from "@/lib/api/companies";
import { asDuplicateConflict } from "@/lib/api/tracking";
import { canWrite } from "@/lib/auth/scopes";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";

interface CompanyOption {
  id: number | null;
  name: string;
}

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
  const [text, setText] = useState(valueLabel ?? "");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  // Selecting a row sets `text` directly; the effect below only needs to
  // react to the value changing out from under the picker (e.g. a parent
  // resetting the form), not to every keystroke that already updated it.
  const lastAppliedValue = useRef(value);

  useEffect(() => {
    if (lastAppliedValue.current === value) return;
    lastAppliedValue.current = value;
    setText(value === null ? "" : (valueLabel ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function search(query: string) {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const resp = await companiesApi.listCompanies({ query, limit: 10 });
        setOptions(resp.data.map((c) => ({ id: c.id, name: c.name })));
        setHighlighted(0);
      } catch {
        // A live-search dropdown swallows load errors rather than banner-ing them.
      }
    }, 300);
  }

  function handleTextChange(next: string) {
    setText(next);
    setOpen(true);
    setError(null);
    search(next);
  }

  function select(option: CompanyOption) {
    lastAppliedValue.current = option.id;
    setText(option.name);
    setOpen(false);
    onChange(option.id, option.id === null ? null : option.name);
  }

  const trimmed = text.trim();
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

  const rows: CompanyOption[] = allowNone ? [{ id: null, name: "— no company —" }, ...options] : options;

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    const total = rows.length + (canCreate ? 1 : 0);
    if (total === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted < rows.length) select(rows[highlighted]);
      else if (canCreate) createInline();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        value={text}
        placeholder={placeholder}
        onChange={(e) => handleTextChange(e.currentTarget.value)}
        onFocus={() => {
          setOpen(true);
          search(text);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        onKeyDown={onKeyDown}
      />
      {open && (rows.length > 0 || canCreate) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <ul className="max-h-60 overflow-auto p-1 text-sm">
            {rows.map((row, i) => (
              <li
                key={row.id ?? "none"}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-1.5",
                  i === highlighted && "bg-accent text-accent-foreground",
                )}
                onMouseEnter={() => setHighlighted(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(row)}
              >
                {row.name}
              </li>
            ))}
            {canCreate && (
              <li
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-1.5",
                  highlighted === rows.length && "bg-accent text-accent-foreground",
                )}
                onMouseEnter={() => setHighlighted(rows.length)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={createInline}
              >
                {busy ? "Creating…" : `Create "${trimmed}"`}
              </li>
            )}
          </ul>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
