export const RESOURCES = ["applications", "companies", "contacts", "events", "attachments", "audit"] as const;
export type Resource = (typeof RESOURCES)[number];
export type Revisions = Record<Resource, number>;

export const INITIAL_REVISIONS: Revisions = {
  applications: 0,
  companies: 0,
  contacts: 0,
  events: 0,
  attachments: 0,
  audit: 0,
};

/** A new Revisions with each named key incremented. Pure — unit-testable. */
export function bump(current: Revisions, resources: readonly Resource[]): Revisions {
  if (resources.length === 0) return current;
  const next = { ...current };
  for (const resource of resources) next[resource] += 1;
  return next;
}

/** Whether any of `resources` differs between two snapshots. */
export function changed(a: Revisions, b: Revisions, resources: readonly Resource[]): boolean {
  return resources.some((resource) => a[resource] !== b[resource]);
}
