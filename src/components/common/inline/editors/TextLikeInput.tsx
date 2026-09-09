import { useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import type { EditorProps } from "@/components/common/inline/editors/types";

// Shared by TextEditor/UrlEditor/EmailEditor/PhoneEditor — they differ only
// in <input type> and placeholder. Escape must win over the blur commit
// that follows it when the input unmounts, hence the ref guard: browsers
// fire blur synchronously when a focused element is removed from the DOM,
// which would otherwise silently resurrect a cancelled edit.
export function TextLikeInput({
  value,
  onCommit,
  onCancel,
  autoFocus,
  type = "text",
  placeholder,
}: EditorProps<string> & { type?: string; placeholder?: string }) {
  const [draft, setDraft] = useState(value);
  const cancelledRef = useRef(false);

  return (
    <Input
      type={type}
      autoFocus={autoFocus}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(draft);
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelledRef.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (cancelledRef.current) return;
        onCommit(draft);
      }}
      className="h-8"
    />
  );
}
