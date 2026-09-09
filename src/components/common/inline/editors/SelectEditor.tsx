import { useRef } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EditorProps } from "@/components/common/inline/editors/types";

// Radix's Select fires onValueChange *then* closes, so onOpenChange(false)
// follows every successful pick too — the ref distinguishes "closed because
// something was picked" (already committed, ignore) from "closed by Escape
// or an outside click" (nothing was picked, so this is the cancel).
export function SelectEditor({
  value,
  onCommit,
  onCancel,
  options,
  placeholder,
}: EditorProps<string> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const pickedRef = useRef(false);

  return (
    <Select
      value={value}
      defaultOpen
      onValueChange={(v) => {
        pickedRef.current = true;
        onCommit(v);
      }}
      onOpenChange={(open) => {
        if (!open && !pickedRef.current) onCancel();
      }}
    >
      <SelectTrigger className="h-8 w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
