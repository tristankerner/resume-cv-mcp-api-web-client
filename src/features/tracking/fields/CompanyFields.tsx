import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface CompanyDraft {
  name: string;
  website: string;
  description: string;
  personal_note: string;
}

export const EMPTY_COMPANY_DRAFT: CompanyDraft = {
  name: "",
  website: "",
  description: "",
  personal_note: "",
};

export type CompanyFieldName = "name" | "website" | "description" | "personal_note";

export function CompanyFields({
  value,
  onChange,
  disabled,
  hide,
  idPrefix = "company",
}: {
  value: CompanyDraft;
  onChange: (next: CompanyDraft) => void;
  disabled?: boolean;
  hide?: CompanyFieldName[];
  idPrefix?: string;
}) {
  function set<K extends keyof CompanyDraft>(key: K, v: CompanyDraft[K]) {
    onChange({ ...value, [key]: v });
  }
  const isHidden = (f: CompanyFieldName) => hide?.includes(f);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <>
      {!isHidden("name") && (
        <Field>
          <FieldLabel htmlFor={id("name")}>Name</FieldLabel>
          <Input
            id={id("name")}
            value={value.name}
            disabled={disabled}
            onChange={(e) => set("name", e.currentTarget.value)}
            required
          />
        </Field>
      )}
      {!isHidden("website") && (
        <Field>
          <FieldLabel htmlFor={id("website")}>Website</FieldLabel>
          <Input
            id={id("website")}
            type="url"
            placeholder="https://…"
            value={value.website}
            disabled={disabled}
            onChange={(e) => set("website", e.currentTarget.value)}
          />
        </Field>
      )}
      {!isHidden("description") && (
        <Field>
          <FieldLabel htmlFor={id("description")}>Description</FieldLabel>
          <Textarea
            id={id("description")}
            value={value.description}
            disabled={disabled}
            onChange={(e) => set("description", e.currentTarget.value)}
          />
        </Field>
      )}
      {!isHidden("personal_note") && (
        <Field>
          <FieldLabel htmlFor={id("note")}>Personal note</FieldLabel>
          <Textarea
            id={id("note")}
            value={value.personal_note}
            disabled={disabled}
            onChange={(e) => set("personal_note", e.currentTarget.value)}
          />
        </Field>
      )}
    </>
  );
}
