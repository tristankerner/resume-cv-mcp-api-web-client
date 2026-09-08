import { describe, expect, it } from "vitest";

import { APPLICATION_STATUSES, type CompanyRelationshipType } from "@/lib/config";
import { labelFor, relationshipLabel } from "@/lib/tracking/labels";

describe("labelFor", () => {
  it("returns the label for a known value", () => {
    expect(labelFor(APPLICATION_STATUSES, "job_accepted")).toBe("Job Accepted");
  });

  it("returns the raw value for an unknown one", () => {
    expect(labelFor(APPLICATION_STATUSES, "some_future_status")).toBe("some_future_status");
  });
});

describe("relationshipLabel", () => {
  const cases: [CompanyRelationshipType, string, string][] = [
    ["child_of", "Child of Acme", "Parent of Acme"],
    ["parent_of", "Parent of Acme", "Child of Acme"],
    ["customer_of", "Customer of Acme", "Vendor to Acme"],
    ["vendor_of", "Vendor of Acme", "Customer of Acme"],
    ["staffing_agency_for", "Staffing agency for Acme", "Staffed by Acme"],
    ["acquired_by", "Acquired by Acme", "Acquired Acme"],
    ["partner_of", "Partner of Acme", "Partner of Acme"],
  ];

  it.each(cases)("phrases %s correctly in both directions", (type, fromLabel, toLabel) => {
    expect(relationshipLabel(type, "from", "Acme")).toBe(fromLabel);
    expect(relationshipLabel(type, "to", "Acme")).toBe(toLabel);
  });
});
