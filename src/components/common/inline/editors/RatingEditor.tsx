import { SelectEditor } from "@/components/common/inline/editors/SelectEditor";
import type { EditorProps } from "@/components/common/inline/editors/types";
import { CONTACT_RATING_OPTIONS } from "@/lib/config";

const NONE = "__none__";

// Value is "" for no rating, else a numeric string — matching the
// string-only convention Select needs (see ContactFields).
export function RatingEditor({ value, onCommit, onCancel }: EditorProps<string>) {
  return (
    <SelectEditor
      value={value || NONE}
      onCommit={(v) => onCommit(v === NONE ? "" : v)}
      onCancel={onCancel}
      placeholder="— none —"
      options={[{ value: NONE, label: "— none —" }, ...CONTACT_RATING_OPTIONS.map((r) => ({ value: String(r.value), label: r.label }))]}
    />
  );
}
