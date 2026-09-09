import { EntityPicker } from "@/components/common/EntityPicker";
import * as applicationsApi from "@/lib/api/applications";
import type { ApplicationSummary } from "@/lib/api/applications";

export function ApplicationPicker({
  value,
  valueLabel,
  onChange,
  allowNone = false,
  placeholder = "Search applications…",
  modal,
}: {
  value: number | null;
  valueLabel?: string | null;
  // `item` is the full picked row — e.g. the composer reads its company_id
  // to default a new contact's company without a second fetch.
  onChange: (id: number | null, label: string | null, item: ApplicationSummary | null) => void;
  allowNone?: boolean;
  placeholder?: string;
  modal?: boolean;
}) {
  return (
    <EntityPicker<ApplicationSummary>
      value={value}
      valueLabel={valueLabel}
      onChange={(id, item, label) => onChange(id, id === null ? null : label, item)}
      search={async (query) => (await applicationsApi.listApplications({ query, limit: 10 })).data}
      toOption={(a) => ({
        id: a.id,
        label: a.job_title || "Untitled",
        hint: [a.company_name, a.date_submitted].filter(Boolean).join(" · ") || undefined,
      })}
      allowNone={allowNone}
      placeholder={placeholder}
      modal={modal}
    />
  );
}
