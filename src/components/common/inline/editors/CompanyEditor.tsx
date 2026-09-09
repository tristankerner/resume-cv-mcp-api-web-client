import type { EditorProps } from "@/components/common/inline/editors/types";
import { CompanyPicker } from "@/features/tracking/CompanyPicker";

// No inline create here — creating a company from a table cell is a step
// too far; the picker still searches and selects existing companies.
export function CompanyEditor({
  value,
  valueLabel,
  onCommit,
  allowNone,
}: EditorProps<number | null> & { valueLabel?: string | null; allowNone?: boolean }) {
  return <CompanyPicker value={value} valueLabel={valueLabel} onChange={(id) => onCommit(id)} allowNone={allowNone} />;
}
