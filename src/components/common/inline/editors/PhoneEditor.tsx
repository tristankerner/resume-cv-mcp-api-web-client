import { TextLikeInput } from "@/components/common/inline/editors/TextLikeInput";
import type { EditorProps } from "@/components/common/inline/editors/types";

export function PhoneEditor(props: EditorProps<string>) {
  return <TextLikeInput {...props} type="tel" />;
}
