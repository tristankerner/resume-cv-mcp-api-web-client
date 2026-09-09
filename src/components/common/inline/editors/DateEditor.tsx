import { TextLikeInput } from "@/components/common/inline/editors/TextLikeInput";
import type { EditorProps } from "@/components/common/inline/editors/types";

// A bare calendar date (`date_submitted`) — never zone-converted, unlike an
// instant. See src/lib/datetime.ts.
export function DateEditor(props: EditorProps<string>) {
  return <TextLikeInput {...props} type="date" />;
}
