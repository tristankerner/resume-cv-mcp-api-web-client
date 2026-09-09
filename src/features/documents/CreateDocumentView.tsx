import { type FormEvent, useMemo, useRef, useState } from "react";
import type { JsonEditor, JSONSchema } from "vanilla-jsoneditor";
import { toJSONContent } from "vanilla-jsoneditor";

import { Banner } from "@/components/common/Banner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JsonEditorField, newDocumentContent, type EditorMode } from "@/features/documents/JsonEditorField";
import { ModeToggle } from "@/features/documents/ModeToggle";
import * as documentsApi from "@/lib/api/documents";
import { ApiError, errorMessage } from "@/lib/api/client";
import { writableTypes } from "@/lib/auth/scopes";
import type { DocType } from "@/lib/config";
import { validateDocumentName } from "@/lib/documents/names";
import type { JsonValue } from "@/lib/documents/diff";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";

export function CreateDocumentView() {
  const { user, schemas } = useStore();
  const writable = useMemo(() => writableTypes(user), [user]);
  const [type, setType] = useState<DocType | "">(writable[0] || "");
  const [name, setName] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasValidationErrors, setHasValidationErrors] = useState(false);
  const [mode, setMode] = useState<EditorMode>(window.innerWidth < 720 ? "tree" : "text");
  const editorApiRef = useRef<JsonEditor | null>(null);

  if (writable.length === 0) {
    return <Banner kind="error">You do not hold write access to any document type.</Banner>;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const nameErr = validateDocumentName(name);
    setNameError(nameErr);
    if (nameErr) return;
    if (!revisionNote.trim()) {
      setSubmitError("A revision note is required.");
      return;
    }

    let data: JsonValue;
    try {
      data = toJSONContent(editorApiRef.current!.get()).json as JsonValue;
    } catch (err) {
      setSubmitError("The content is not valid JSON: " + String((err as Error).message || err));
      return;
    }

    if (
      hasValidationErrors &&
      !confirm("This document does not validate against its schema. Save anyway?")
    ) {
      return;
    }

    setBusy(true);
    setSubmitError(null);
    try {
      const resp = await documentsApi.upsertDocument(type as DocType, {
        name,
        revision_note: revisionNote,
        public: isPublic,
        data,
      });
      store.navigate("edit", { type, name: resp.name });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setSubmitError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const schema = (schemas?.schemas?.[type] as JSONSchema | undefined) ?? null;

  return (
    <div className="max-w-3xl">
      <PageHeader title="New document" />
      <Banner kind="error">{submitError}</Banner>
      <form onSubmit={submit} className="space-y-4">
        <Field>
          <FieldLabel htmlFor="doc-type">Type</FieldLabel>
          <Select value={type} onValueChange={(v) => setType(v as DocType)}>
            <SelectTrigger id="doc-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {writable.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Chosen here only — a document&rsquo;s type cannot be changed later.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="doc-name">Name</FieldLabel>
          <Input
            id="doc-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.currentTarget.value);
              setNameError(null);
            }}
            required
          />
          <FieldError>{nameError}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="doc-note">Revision note</FieldLabel>
          <Input
            id="doc-note"
            type="text"
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.currentTarget.value)}
            required
          />
        </Field>
        <Label className="font-normal">
          <Checkbox checked={isPublic} onCheckedChange={(v) => setIsPublic(v === true)} />
          Public
        </Label>
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel className="mb-0">Content</FieldLabel>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
          <JsonEditorField
            key={type}
            schema={schema}
            initialContent={newDocumentContent()}
            mode={mode}
            onDirty={(errors) => setHasValidationErrors(!!errors)}
            onEditorReady={(api) => (editorApiRef.current = api)}
          />
        </Field>
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
          <Button type="button" variant="outline" onClick={() => store.navigate("documents")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
