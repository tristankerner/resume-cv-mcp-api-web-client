import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { TableCell } from "@/components/ui/table";
import { DuplicateWarning } from "@/features/tracking/DuplicateWarning";
import type { InlineCommitResult } from "@/components/common/inline/useInlineEdit";
import { cn } from "@/lib/utils";

// A <TableCell> that renders read-only content until clicked (or Enter on
// focus), then swaps in an editor. Enter commits, Escape reverts, and blur
// commits — each editor implements the keyboard/blur behaviour that suits
// its control; this component owns the read/edit toggle, the busy spinner,
// and the duplicate-conflict popover. Not editable at all when `editable`
// is false: renders exactly like a plain TableCell.
export function EditableCell<T>({
  value,
  editable,
  ariaLabel,
  display,
  renderEditor,
  onCommit,
  onOpenCandidate,
  dataLabel,
  className,
}: {
  value: T;
  editable: boolean;
  ariaLabel: string;
  display: ReactNode;
  renderEditor: (props: {
    value: T;
    onCommit: (v: T) => void;
    onCancel: () => void;
    autoFocus: boolean;
  }) => ReactNode;
  onCommit: (value: T, force?: boolean) => Promise<InlineCommitResult>;
  onOpenCandidate?: (id: number) => void;
  dataLabel?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<InlineCommitResult["conflict"] | null>(null);
  const [pendingValue, setPendingValue] = useState<T>(value);
  // TableCell (shadcn-generated) isn't a forwardRef component, so this ref
  // goes on an inner wrapper rather than the <td> itself.
  const editRef = useRef<HTMLDivElement>(null);

  // A click outside the cell while editing (but not saving) exits edit mode
  // without committing — the safety net for editors like CompanyEditor
  // whose picker popover has no blur-to-commit semantics of its own.
  //
  // "Outside" has to account for portals. Radix renders Popover, Select and
  // HoverCard content into <body>, so a click on a company option, a rating
  // option, or this cell's own conflict popover is not a descendant of
  // `editRef` — without the check below, pointerdown would unmount the
  // editor before the click could land, and picking a company, picking a
  // rating and pressing "Save anyway" would all silently do nothing. Every
  // popper-based Radix layer is wrapped in a
  // [data-radix-popper-content-wrapper] div, so one test covers all three.
  useEffect(() => {
    if (!editing || busy) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!editRef.current || editRef.current.contains(target)) return;
      if (target instanceof Element && target.closest("[data-radix-popper-content-wrapper]")) return;
      setEditing(false);
      setConflict(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [editing, busy]);

  // Seeds the draft from the row's current value on every entry into edit
  // mode. Without this, a commit rejected by the server (which reverts the
  // row) would leave `pendingValue` holding the rejected text, and reopening
  // the cell would show it again as though it had been saved.
  function startEditing() {
    setPendingValue(value);
    setConflict(null);
    setEditing(true);
  }

  async function handleCommit(next: T, force = false) {
    setBusy(true);
    setPendingValue(next);
    const result = await onCommit(next, force);
    setBusy(false);
    if (result.ok) {
      setEditing(false);
      setConflict(null);
      return;
    }
    if (result.conflict) {
      setConflict(result.conflict);
      return;
    }
    setConflict(null);
    setEditing(false);
    if (result.error) toast.error(result.error);
  }

  if (!editable) {
    return (
      <TableCell data-label={dataLabel} className={className}>
        {display}
      </TableCell>
    );
  }

  if (!editing) {
    return (
      <TableCell data-label={dataLabel} className={cn("p-0", className)}>
        <button
          type="button"
          aria-label={ariaLabel}
          className="flex h-full min-h-9 w-full items-center rounded-sm px-3 py-1.5 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={startEditing}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              startEditing();
            }
          }}
        >
          {display}
        </button>
      </TableCell>
    );
  }

  return (
    <TableCell data-label={dataLabel} className={cn("p-1.5", className)}>
      <Popover open={!!conflict}>
        <PopoverAnchor asChild>
          <div ref={editRef} className="flex items-center gap-2">
            <div className="flex-1">
              {renderEditor({
                value: pendingValue,
                onCommit: (v) => handleCommit(v),
                onCancel: () => {
                  setEditing(false);
                  setConflict(null);
                },
                autoFocus: true,
              })}
            </div>
            {busy && <Spinner className="size-4 shrink-0" />}
          </div>
        </PopoverAnchor>
        <PopoverContent align="start" className="w-80">
          {conflict && (
            <DuplicateWarning
              conflict={conflict}
              busy={busy}
              onOpen={(id) => onOpenCandidate?.(id)}
              onForce={() => handleCommit(pendingValue, true)}
            />
          )}
        </PopoverContent>
      </Popover>
    </TableCell>
  );
}
