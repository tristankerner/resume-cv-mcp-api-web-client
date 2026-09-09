import { EntityPicker } from "@/components/common/EntityPicker";
import * as applicationsApi from "@/lib/api/applications";
import type { ContactOption } from "@/lib/api/applications";
import * as contactsApi from "@/lib/api/contacts";
import type { Contact } from "@/lib/api/contacts";

function contactLabel(c: { first_name: string | null; last_name: string | null; email: string | null }, id: number) {
  return [c.last_name, c.first_name].filter(Boolean).join(", ") || c.email || `Contact #${id}`;
}

export function ContactPicker({
  value,
  valueLabel,
  onChange,
  // When set, searches the application's contact graph (its own company plus
  // related companies up to 3 hops) instead of the flat contact list.
  // Without it, a recruiter at a staffing agency filed under a different
  // company can never be selected.
  applicationId,
  allowNone = false,
  placeholder = "Search contacts…",
  modal,
}: {
  value: number | null;
  valueLabel?: string | null;
  onChange: (id: number | null, label: string | null) => void;
  applicationId?: number;
  allowNone?: boolean;
  placeholder?: string;
  modal?: boolean;
}) {
  if (applicationId != null) {
    return (
      <EntityPicker<ContactOption>
        value={value}
        valueLabel={valueLabel}
        onChange={(id, _item, label) => onChange(id, id === null ? null : label)}
        search={async (query) =>
          (await applicationsApi.listContactOptions(applicationId, { query, limit: 200 })).data
        }
        toOption={(c) => ({
          id: c.id,
          label: contactLabel(c, c.id),
          hint: c.via ? `via ${c.via}` : undefined,
        })}
        // Sort order (depth, then company, then name) comes from the server;
        // grouping here must not re-sort within or across groups.
        groupBy={(c) => (c.depth === 0 ? c.company_name : `${c.company_name} — via ${c.via}`)}
        allowNone={allowNone}
        noneLabel="— none —"
        placeholder={placeholder}
        modal={modal}
      />
    );
  }

  return (
    <EntityPicker<Contact>
      value={value}
      valueLabel={valueLabel}
      onChange={(id, _item, label) => onChange(id, id === null ? null : label)}
      search={async (query) => (await contactsApi.listContacts({ query, limit: 50 })).data}
      toOption={(c) => ({ id: c.id, label: contactLabel(c, c.id), hint: c.company_name ?? undefined })}
      allowNone={allowNone}
      noneLabel="— none —"
      placeholder={placeholder}
      modal={modal}
    />
  );
}
