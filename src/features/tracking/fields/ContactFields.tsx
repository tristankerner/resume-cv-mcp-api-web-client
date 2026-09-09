import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CompanyPicker } from "@/features/tracking/CompanyPicker";
import { CONTACT_RATING_OPTIONS } from "@/lib/config";

export interface ContactDraft {
  company_id: number | null;
  // The current selection's display name, for the picker's initial label —
  // not sent to the API directly.
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  // "" means no rating; otherwise a numeric string, matching the Select's
  // string-only value convention.
  rating: string;
  description: string;
  personal_note: string;
}

export function emptyContactDraft(companyId?: number | null): ContactDraft {
  return {
    company_id: companyId ?? null,
    company_name: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    rating: "",
    description: "",
    personal_note: "",
  };
}

export type ContactFieldName =
  | "company"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "rating"
  | "description"
  | "personal_note";

export function contactDraftValid(value: ContactDraft): boolean {
  return !!(value.first_name.trim() || value.last_name.trim() || value.email.trim());
}

export function ContactFields({
  value,
  onChange,
  disabled,
  hide,
  allowCreateCompany = false,
  idPrefix = "contact",
  modal,
}: {
  value: ContactDraft;
  onChange: (next: ContactDraft) => void;
  disabled?: boolean;
  hide?: ContactFieldName[];
  allowCreateCompany?: boolean;
  idPrefix?: string;
  // Passed straight through to CompanyPicker — required when these fields
  // render inside a Dialog. See EntityPicker's `modal` prop.
  modal?: boolean;
}) {
  function set<K extends keyof ContactDraft>(key: K, v: ContactDraft[K]) {
    onChange({ ...value, [key]: v });
  }
  const isHidden = (f: ContactFieldName) => hide?.includes(f);
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
            allowNone
            modal={modal}
          />
        </Field>
      )}
      {(!isHidden("first_name") || !isHidden("last_name")) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {!isHidden("first_name") && (
            <Field>
              <FieldLabel htmlFor={id("first")}>First name</FieldLabel>
              <Input
                id={id("first")}
                value={value.first_name}
                disabled={disabled}
                onChange={(e) => set("first_name", e.currentTarget.value)}
              />
            </Field>
          )}
          {!isHidden("last_name") && (
            <Field>
              <FieldLabel htmlFor={id("last")}>Last name</FieldLabel>
              <Input
                id={id("last")}
                value={value.last_name}
                disabled={disabled}
                onChange={(e) => set("last_name", e.currentTarget.value)}
              />
            </Field>
          )}
        </div>
      )}
      {(!isHidden("email") || !isHidden("phone")) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {!isHidden("email") && (
            <Field>
              <FieldLabel htmlFor={id("email")}>Email</FieldLabel>
              <Input
                id={id("email")}
                type="email"
                value={value.email}
                disabled={disabled}
                onChange={(e) => set("email", e.currentTarget.value)}
              />
            </Field>
          )}
          {!isHidden("phone") && (
            <Field>
              <FieldLabel htmlFor={id("phone")}>Phone</FieldLabel>
              <Input
                id={id("phone")}
                value={value.phone}
                disabled={disabled}
                onChange={(e) => set("phone", e.currentTarget.value)}
              />
            </Field>
          )}
        </div>
      )}
      {!contactDraftValid(value) && (
        <p className="text-sm text-muted-foreground">
          At least one of first name, last name or email is required.
        </p>
      )}
      {!isHidden("rating") && (
        <Field>
          <FieldLabel htmlFor={id("rating")}>Rating</FieldLabel>
          <Select value={value.rating} onValueChange={(v) => set("rating", v)} disabled={disabled}>
            <SelectTrigger id={id("rating")} className="w-full">
              <SelectValue placeholder="— none —" />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_RATING_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={String(r.value)}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
