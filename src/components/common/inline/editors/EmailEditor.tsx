import { TextLikeInput } from "@/components/common/inline/editors/TextLikeInput";
import type { EditorProps } from "@/components/common/inline/editors/types";

export function EmailEditor(props: EditorProps<string>) {
  return <TextLikeInput {...props} type="email" />;
}
