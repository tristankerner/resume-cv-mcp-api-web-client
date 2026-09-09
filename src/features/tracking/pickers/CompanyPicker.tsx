import { EntityPicker } from "@/components/common/EntityPicker";
import * as companiesApi from "@/lib/api/companies";
import type { CompanySummary } from "@/lib/api/companies";
import { canWrite } from "@/lib/auth/scopes";
import { useStore } from "@/store/useStore";

export function CompanyPicker({
  value,
  valueLabel,
  onChange,
  allowCreate = false,
  allowNone = false,
  placeholder = "Search companies…",
  modal,
  excludeIds,
  hintFor,
}: {
  value: number | null;
  valueLabel?: string | null;
  onChange: (id: number | null, name: string | null) => void;
  allowCreate?: boolean;
  allowNone?: boolean;
  placeholder?: string;
  modal?: boolean;
  // Companies to drop from the results — e.g. the current company itself,
  // which the API rejects as a self-relationship with a 400.
  excludeIds?: number[];
  // Annotates an option with extra context, e.g. an existing relationship —
  // rendered in the hint slot so the user doesn't walk into a 409.
  hintFor?: (company: CompanySummary) => string | undefined;
}) {
  const { user } = useStore();
  const canCreate = allowCreate && canWrite(user, "companies");

  return (
    <EntityPicker<CompanySummary>
      value={value}
      valueLabel={valueLabel}
      onChange={(id, _item, label) => onChange(id, id === null ? null : label)}
      search={async (query) => {
        const data = (await companiesApi.listCompanies({ query, limit: 10 })).data;
        return excludeIds ? data.filter((c) => !excludeIds.includes(c.id)) : data;
      }}
      toOption={(c) => ({ id: c.id, label: c.name, hint: hintFor?.(c) })}
      onCreate={canCreate ? (name) => companiesApi.createCompany({ name }) : undefined}
      allowNone={allowNone}
      noneLabel="— no company —"
      placeholder={placeholder}
      modal={modal}
    />
  );
}
