import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { JsonEditor, JSONSchema } from "vanilla-jsoneditor";
import { toJSONContent } from "vanilla-jsoneditor";

import { Banner } from "@/components/common/Banner";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { DeleteDialog } from "@/features/documents/DeleteDialog";
import { JsonEditorField, type EditorMode } from "@/features/documents/JsonEditorField";
import { ModeToggle } from "@/features/documents/ModeToggle";
import { RenameDialog } from "@/features/documents/RenameDialog";
import { RevisionPanel } from "@/features/documents/RevisionPanel";
import * as documentsApi from "@/lib/api/documents";
import type { DocumentRevision, UpsertDocumentResponse } from "@/lib/api/documents";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { DocType } from "@/lib/config";
import type { JsonValue } from "@/lib/documents/diff";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";

interface LoadState {
  loading: boolean;
  error: string | null;
  revisions: DocumentRevision[] | null;
  truncated: boolean;
  current: DocumentRevision | null;
}

export function EditDocumentView({ type, name }: { type: DocType; name: string }) {
  const { schemas } = useStore();
  const [state, setState] = useState<LoadState>({
    loading: true,
    error: null,
    revisions: null,
    truncated: false,
    current: null,
  });
  const [revisionNote, setRevisionNote] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [restoredFrom, setRestoredFrom] = useState<number | null>(null);
  const [saveResult, setSaveResult] = useState<UpsertDocumentResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasValidationErrors, setHasValidationErrors] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [mode, setMode] = useState<EditorMode>(window.innerWidth < 720 ? "tree" : "text");
  // The editor owns its content, so nothing re-renders when it changes. This
  // counter is the change signal the revision panel needs to keep a diff
  // against "Current" up to date; bump it wherever the content moves.
  const [editorVersion, setEditorVersion] = useState(0);
  const editorApiRef = useRef<JsonEditor | null>(null);

  useEffect(() => {
    store.setCrumb(name);
  }, [name]);

  // Two different refreshes, deliberately kept apart: the initial load (and
  // any switch to a different document, via the `key` CurrentView puts on
  // this component) shows a spinner and resets the whole form. A refresh
  // after Save only needs the revisions list and the current row — reusing
  // the spinner path there would flash the whole view empty (destroying and
  // recreating the JSON editor along with it) and, worse, would wipe the
  // save-outcome banner the instant it appeared, since that banner is part
  // of the state a full reload resets.
  async function fetchRevisions(): Promise<{ revisions: DocumentRevision[]; current: DocumentRevision } | null> {
    try {
      const resp = await documentsApi.getDocument(type, name);
      const revisions = resp.data; // newest first
      return { revisions, current: revisions[0] };
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  }

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: null, revisions: null, truncated: false, current: null });
    setRevisionNote("");
    setSaveResult(null);
    setSaveError(null);
    setRestoredFrom(null);
    fetchRevisions()
      .then((result) => {
        if (cancelled || result === null) return;
        setIsPublic(result.current.public);
        setState({
          loading: false,
          error: null,
          revisions: result.revisions,
          truncated: result.revisions.length === 50,
          current: result.current,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: errorMessage(err),
          revisions: null,
          truncated: false,
          current: null,
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, name]);

  if (state.loading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</p>;
  if (state.error) return <Banner kind="error">{state.error}</Banner>;

  const schema = (schemas?.schemas?.[type] as JSONSchema | undefined) ?? null;
  const current = state.current!;

  function handleRestore(rev: DocumentRevision) {
    editorApiRef.current?.update({ json: rev.data });
    setRestoredFrom(rev.revision_id);
    setSaveResult(null);
    // `update` is a programmatic write and does not fire the editor's
    // onChange, so the panel would otherwise keep diffing the old content.
    setEditorVersion((v) => v + 1);
  }

  // What is in the editor right now, or undefined while it holds text that
  // is not valid JSON. `save` parses separately because it has an error
  // message to report; this one is for the revision panel's "Current" side,
  // where invalid JSON is an ordinary transient state, not an error.
  function currentEditorJson(): JsonValue | undefined {
    if (!editorApiRef.current) return undefined;
    try {
      return toJSONContent(editorApiRef.current.get()).json as JsonValue;
    } catch {
      return undefined;
    }
  }

  async function save() {
    let data: JsonValue;
    try {
      data = toJSONContent(editorApiRef.current!.get()).json as JsonValue;
    } catch (err) {
      setSaveError("The content is not valid JSON: " + String((err as Error).message || err));
      return;
    }
    if (!revisionNote.trim()) {
      setSaveError("A revision note is required.");
      return;
    }
    if (
      hasValidationErrors &&
      !confirm("This document does not validate against its schema. Save anyway?")
    ) {
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      const resp = await documentsApi.upsertDocument(type, {
        name,
        revision_note: revisionNote,
        public: isPublic,
        data,
      });
      if (resp.status === "created") {
        toast.success(`Saved as revision #${resp.revision_id}.`);
        setSaveResult(null);
      } else {
        setSaveResult(resp);
      }
      setRevisionNote("");
      setRestoredFrom(null);
      const result = await fetchRevisions();
      if (result) {
        setState((s) => ({
          ...s,
          revisions: result.revisions,
          truncated: result.revisions.length === 50,
          current: result.current,
        }));
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setSaveError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {name}
            <Badge variant="outline">{type}</Badge>
            {current.public && <Badge variant="success">public</Badge>}
          </span>
        }
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowRename(true)}>
              Rename
            </Button>
            <Button variant="destructive" onClick={() => setShowDelete(true)}>
              Delete
            </Button>
            <Button variant="outline" onClick={() => store.navigate("documents")}>
              Back
            </Button>
          </div>
        }
      />

      {restoredFrom && (
        <Banner kind="warn">
          Loaded content from revision #{restoredFrom}. Nothing is saved yet — review and Save
          to create a new revision from it.
        </Banner>
      )}
      {saveResult && (
        <Banner kind="info">
          No changes — no revision was created. (The revision note was not recorded either.)
        </Banner>
      )}
      <Banner kind="error">{saveError}</Banner>

      <div className="space-y-4">
        <Field>
          <FieldLabel>Type</FieldLabel>
          <FieldDescription>{type} — fixed at creation, cannot be changed.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="revision-note">Revision note</FieldLabel>
          <Input
            id="revision-note"
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
            schema={schema}
            initialContent={{ json: current.data }}
            mode={mode}
            onDirty={(errors) => {
              setHasValidationErrors(!!errors);
              setEditorVersion((v) => v + 1);
            }}
            onEditorReady={(api) => (editorApiRef.current = api)}
          />
        </Field>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>

      <RevisionPanel
        revisions={state.revisions!}
        truncated={state.truncated}
        liveRevisionId={current.revision_id}
        editorVersion={editorVersion}
        getEditorJson={currentEditorJson}
        onRestore={handleRestore}
      />

      {showDelete && (
        <DeleteDialog
          name={name}
          onClose={() => setShowDelete(false)}
          onDeleted={() => store.navigate("documents")}
        />
      )}
      {showRename && (
        <RenameDialog
          name={name}
          isPublic={current.public}
          onClose={() => setShowRename(false)}
          onRenamed={(resp) => store.navigate("edit", { type, name: resp.name })}
        />
      )}
    </div>
  );
}
