import { DateTimeInput } from "@/components/common/DateTimeInput";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ContactPicker } from "@/features/tracking/pickers/ContactPicker";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/config";

// A Select can't hold a real `null`, so an unpicked status/rating/contact is
// this sentinel instead — translated back to `null` at submit time.
export const NO_SELECTION = "__none__";

export interface EventDraft {
  status: string;
  occurred_at: string;
  contact_id: number | null;
  contact_label: string;
  // "" would collide with a real Select value, so this uses NO_SELECTION too.
  rating: string;
  description: string;
}

export function emptyEventDraft(contactId?: number | null, contactLabel?: string | null): EventDraft {
  return {
    status: NO_SELECTION,
    occurred_at: new Date().toISOString(),
    contact_id: contactId ?? null,
    contact_label: contactLabel ?? "",
    rating: NO_SELECTION,
    description: "",
  };
}

export function eventDraftValid(value: EventDraft): boolean {
  return value.status !== NO_SELECTION || value.description.trim() !== "" || value.rating !== NO_SELECTION;
}

export type EventFieldName = "status" | "occurred_at" | "contact" | "rating" | "description";

export function EventFields({
  value,
  onChange,
  disabled,
  hide,
  applicationId,
  idPrefix = "event",
  modal,
}: {
  value: EventDraft;
  onChange: (next: EventDraft) => void;
  disabled?: boolean;
  hide?: EventFieldName[];
  // Scopes the contact picker to the application's contact graph (its own
  // company plus related companies) rather than the flat contact list.
  applicationId?: number;
  idPrefix?: string;
  modal?: boolean;
}) {
  function set<K extends keyof EventDraft>(key: K, v: EventDraft[K]) {
    onChange({ ...value, [key]: v });
  }
  const isHidden = (f: EventFieldName) => hide?.includes(f);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <>
      {!isHidden("status") && (
        <Field>
          <FieldLabel htmlFor={id("status")}>Status</FieldLabel>
          <Select value={value.status} onValueChange={(v) => set("status", v)} disabled={disabled}>
            <SelectTrigger id={id("status")} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SELECTION}>— no status change —</SelectItem>
              {APPLICATION_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {!isHidden("occurred_at") && (
        <DateTimeInput
          id={id("occurred")}
          label="Occurred at"
          value={value.occurred_at}
          onChange={(iso) => set("occurred_at", iso)}
          disabled={disabled}
        />
      )}
      {!isHidden("contact") && (
        <Field>
          <FieldLabel>Contact</FieldLabel>
          <ContactPicker
            value={value.contact_id}
            valueLabel={value.contact_label}
            onChange={(contactId, label) =>
              onChange({ ...value, contact_id: contactId, contact_label: label ?? "" })
            }
            applicationId={applicationId}
            allowNone
            modal={modal}
          />
        </Field>
      )}
      {!isHidden("rating") && (
        <Field>
          <FieldLabel htmlFor={id("rating")}>Rating</FieldLabel>
          <Select value={value.rating} onValueChange={(v) => set("rating", v)} disabled={disabled}>
            <SelectTrigger id={id("rating")} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SELECTION}>— none —</SelectItem>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
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
    </>
  );
}

export function eventDraftToStatus(value: string): ApplicationStatus | null {
  return value === NO_SELECTION ? null : (value as ApplicationStatus);
}
