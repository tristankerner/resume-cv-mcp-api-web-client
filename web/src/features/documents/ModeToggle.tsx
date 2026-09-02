import { Button } from "@/components/ui/button";
import type { EditorMode } from "@/features/documents/JsonEditorField";

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onChange(mode === "tree" ? "text" : "tree")}
    >
      {mode === "tree" ? "Switch to text" : "Switch to tree"}
    </Button>
  );
}
