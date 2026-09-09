import { useEffect, useRef } from "react";
import {
  createAjvValidator,
  createJSONEditor,
  type Content,
  type ContentErrors,
  type JsonEditor,
  type JSONSchema,
  type Mode,
  type OnChangeStatus,
} from "vanilla-jsoneditor";
import "vanilla-jsoneditor/themes/jse-theme-dark.css";

import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

export type EditorMode = "tree" | "text";

// A function rather than a shared constant: the editor takes ownership of
// whatever object it is handed, so every new document needs its own.
export function newDocumentContent(): Content {
  return { json: {} };
}

// One instance per mount, created imperatively because vanilla-jsoneditor
// owns its own DOM subtree — schema and initial content are fixed for the
// life of an edit session (a caller that needs a different schema mounts a
// fresh instance via `key`); only `mode` is pushed to the live instance via
// updateProps.
export function JsonEditorField({
  schema,
  initialContent,
  mode,
  onDirty,
  onEditorReady,
}: {
  schema: JSONSchema | null;
  initialContent: Content;
  mode: EditorMode;
  onDirty?: (errors: ContentErrors | null) => void;
  onEditorReady?: (editor: JsonEditor) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<JsonEditor | null>(null);
  const { resolved } = useTheme();

  useEffect(() => {
    const validator = schema ? createAjvValidator({ schema }) : undefined;
    const editor = createJSONEditor({
      target: containerRef.current!,
      props: {
        content: initialContent,
        mode: mode as unknown as Mode,
        validator,
        onChange: (_updated: Content, _previous: Content, status: OnChangeStatus) => {
          onDirty?.(status?.contentErrors ?? null);
        },
      },
    });
    editorRef.current = editor;
    onEditorReady?.(editor);
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    editorRef.current?.updateProps({ mode: mode as unknown as Mode });
  }, [mode]);

  return (
    <div
      ref={containerRef}
      className={cn("json-editor-host", resolved === "dark" && "jse-theme-dark")}
    />
  );
}
