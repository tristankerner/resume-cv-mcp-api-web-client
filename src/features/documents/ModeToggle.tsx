import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { EditorMode } from "@/features/documents/JsonEditorField";

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={mode}
      onValueChange={(value) => value && onChange(value as EditorMode)}
    >
      <ToggleGroupItem value="tree" aria-label="Tree mode">
        Tree
      </ToggleGroupItem>
      <ToggleGroupItem value="text" aria-label="Text mode">
        Text
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
