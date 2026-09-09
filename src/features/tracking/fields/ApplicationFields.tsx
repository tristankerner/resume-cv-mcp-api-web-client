import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CompanyPicker } from "@/features/tracking/CompanyPicker";

export interface ApplicationDraft {
  company_id: number | null;
  // The current selection's display name, for the picker's initial label —
  // not sent to the API directly.
  company_name: string;
  job_title: string;
  job_code: string;
  url: string;
  source: string;
  system: string;
  date_submitted: string;
  resume_label: string;
  initial_prompt_text: string;
  job_description: string;
  manually_modified: boolean;
  modification_note: string;
}

export const EMPTY_APPLICATION_DRAFT: ApplicationDraft = {
  company_id: null,
  company_name: "",
  job_title: "",
  job_code: "",
  url: "",
  source: "",
  system: "",
  date_submitted: "",
  resume_label: "",
  initial_prompt_text: "",
  job_description: "",
  manually_modified: false,
  modification_note: "",
};

export type ApplicationFieldName =
  | "company"
  | "job_title"
  | "job_code"
  | "url"
  | "source"
  | "system"
  | "date_submitted"
  | "resume_label"
  | "prompt"
  | "description"
  | "manually_modified";

export function ApplicationFields({
  value,
  onChange,
  disabled,
  hide,
  allowCreateCompany = false,
  idPrefix = "app",
  modal,
}: {
  value: ApplicationDraft;
  onChange: (next: ApplicationDraft) => void;
  disabled?: boolean;
  hide?: ApplicationFieldName[];
  allowCreateCompany?: boolean;
  idPrefix?: string;
  // Passed straight through to CompanyPicker — required when these fields
  // render inside a Dialog. See EntityPicker's `modal` prop.
  modal?: boolean;
}) {
  function set<K extends keyof ApplicationDraft>(key: K, v: ApplicationDraft[K]) {
    onChange({ ...value, [key]: v });
  }
  const isHidden = (f: ApplicationFieldName) => hide?.includes(f);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <>
      {!isHidden("company") && (
        <Field>
          <FieldLabel>Company</FieldLabel>
          <CompanyPicker
            value={value.company_id}
            valueLabel={value.company_name}
            onChange={(companyId, name) => onChange({ ...value, company_id: companyId, company_name: name ?? "" })}
            allowCreate={allowCreateCompany}
            modal={modal}
          />
        </Field>
      )}
      {!isHidden("job_title") && (
        <Field>
          <FieldLabel htmlFor={id("title")}>Job title</FieldLabel>
          <Input
            id={id("title")}
            value={value.job_title}
            disabled={disabled}
            onChange={(e) => set("job_title", e.currentTarget.value)}
          />
        </Field>
      )}
      {!isHidden("job_code") && (
        <Field>
          <FieldLabel htmlFor={id("code")}>Job code</FieldLabel>
          <Input
            id={id("code")}
            value={value.job_code}
            disabled={disabled}
            onChange={(e) => set("job_code", e.currentTarget.value)}
            placeholder="REQ-12345"
          />
          <FieldDescription>
            Optional. The requisition code from the posting or the recruiter — it is what
            identifies the same job if it reaches you again through someone else. Matching
            ignores case and separators, so there is no need to tidy it up.
          </FieldDescription>
        </Field>
      )}
      {!isHidden("url") && (
        <Field>
          <FieldLabel htmlFor={id("url")}>URL</FieldLabel>
          <Input
            id={id("url")}
            type="url"
            value={value.url}
            disabled={disabled}
            onChange={(e) => set("url", e.currentTarget.value)}
          />
        </Field>
      )}
      {(!isHidden("source") || !isHidden("system")) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {!isHidden("source") && (
            <Field>
              <FieldLabel htmlFor={id("source")}>Source</FieldLabel>
              <Input
                id={id("source")}
                value={value.source}
                disabled={disabled}
                onChange={(e) => set("source", e.currentTarget.value)}
              />
            </Field>
          )}
          {!isHidden("system") && (
            <Field>
              <FieldLabel htmlFor={id("system")}>System</FieldLabel>
              <Input
                id={id("system")}
                value={value.system}
                disabled={disabled}
                onChange={(e) => set("system", e.currentTarget.value)}
              />
            </Field>
          )}
        </div>
      )}
      {!isHidden("date_submitted") && (
        <Field>
          <FieldLabel htmlFor={id("date")}>Date submitted</FieldLabel>
          <Input
            id={id("date")}
            type="date"
            value={value.date_submitted}
            disabled={disabled}
            onChange={(e) => set("date_submitted", e.currentTarget.value)}
          />
        </Field>
      )}
      {!isHidden("resume_label") && (
        <Field>
          <FieldLabel htmlFor={id("resume-label")}>Resume label</FieldLabel>
          <Input
            id={id("resume-label")}
            value={value.resume_label}
            disabled={disabled}
            onChange={(e) => set("resume_label", e.currentTarget.value)}
          />
        </Field>
      )}
      {!isHidden("prompt") && (
        <Field>
          <FieldLabel htmlFor={id("prompt")}>Initial prompt text</FieldLabel>
          <Textarea
            id={id("prompt")}
            value={value.initial_prompt_text}
            disabled={disabled}
            onChange={(e) => set("initial_prompt_text", e.currentTarget.value)}
          />
        </Field>
      )}
      {!isHidden("description") && (
        <Field>
          <FieldLabel htmlFor={id("description")}>Job description</FieldLabel>
          <Textarea
            id={id("description")}
            className="min-h-40"
            value={value.job_description}
            disabled={disabled}
            onChange={(e) => set("job_description", e.currentTarget.value)}
          />
        </Field>
      )}
      {!isHidden("manually_modified") && (
        <>
          <div className="flex items-center justify-between">
            <Label htmlFor={id("manual")} className="mb-0">
              Manually modified
            </Label>
            <Switch
              id={id("manual")}
              checked={value.manually_modified}
              disabled={disabled}
              onCheckedChange={(v) => set("manually_modified", v)}
            />
          </div>
          {value.manually_modified && (
            <Field>
              <FieldLabel htmlFor={id("mod-note")}>Modification note</FieldLabel>
              <Textarea
                id={id("mod-note")}
                value={value.modification_note}
                disabled={disabled}
                onChange={(e) => set("modification_note", e.currentTarget.value)}
              />
            </Field>
          )}
        </>
      )}
    </>
  );
}
