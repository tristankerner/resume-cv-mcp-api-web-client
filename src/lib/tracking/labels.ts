import type { ApplicationStatus, CompanyRelationshipType } from "@/lib/config";

// The server is the source of truth for these enums; a value the client has
// not heard of must render as itself rather than as blank or a crash.
export function labelFor(table: readonly { value: string; label: string }[], value: string): string {
  return table.find((entry) => entry.value === value)?.label ?? value;
}

const SECONDARY_STATUSES = new Set<ApplicationStatus>([
  "rejected",
  "offer_declined",
  "withdrawn",
  "position_closed",
  "ghosted",
]);

export function applicationStatusVariant(status: ApplicationStatus): "success" | "secondary" | "outline" {
  if (status === "job_accepted") return "success";
  if (SECONDARY_STATUSES.has(status)) return "secondary";
  return "outline";
}

// How a company_relationships edge reads from each end — see section 5.5 of
// the plan. `from` is the phrasing shown on the company the edge points
// from; `to` is the inverse, shown on the company it points to.
const RELATIONSHIP_PHRASING: Record<CompanyRelationshipType, { from: string; to: string }> = {
  child_of: { from: "Child of", to: "Parent of" },
  parent_of: { from: "Parent of", to: "Child of" },
  customer_of: { from: "Customer of", to: "Vendor to" },
  vendor_of: { from: "Vendor of", to: "Customer of" },
  staffing_agency_for: { from: "Staffing agency for", to: "Staffed by" },
  acquired_by: { from: "Acquired by", to: "Acquired" },
  partner_of: { from: "Partner of", to: "Partner of" },
};

export function relationshipLabel(
  type: CompanyRelationshipType,
  direction: "from" | "to",
  otherCompanyName: string,
): string {
  return `${RELATIONSHIP_PHRASING[type][direction]} ${otherCompanyName}`;
}
