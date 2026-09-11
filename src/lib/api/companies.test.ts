import { afterEach, describe, expect, it, vi } from "vitest";

import * as client from "@/lib/api/client";
import { listAllCompanies } from "@/lib/api/companies";
import type { CompanySummary } from "@/lib/api/companies";

function company(id: number): CompanySummary {
  return {
    id,
    name: `Company ${id}`,
    website: null,
    description: null,
    personal_note: null,
    application_count: 0,
    contact_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("listAllCompanies", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pages until every company has been collected", async () => {
    const requestSpy = vi.spyOn(client, "request");
    requestSpy.mockResolvedValueOnce({
      data: [company(1), company(2)],
      total: 5,
      limit: 2,
      offset: 0,
    });
    requestSpy.mockResolvedValueOnce({
      data: [company(3), company(4)],
      total: 5,
      limit: 2,
      offset: 2,
    });
    requestSpy.mockResolvedValueOnce({
      data: [company(5)],
      total: 5,
      limit: 2,
      offset: 4,
    });

    const companies = await listAllCompanies();

    expect(companies.map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
    expect(requestSpy).toHaveBeenCalledTimes(3);
  });

  it("makes a single call when everything fits on one page", async () => {
    const requestSpy = vi.spyOn(client, "request");
    requestSpy.mockResolvedValueOnce({
      data: [company(1), company(2)],
      total: 2,
      limit: 200,
      offset: 0,
    });

    const companies = await listAllCompanies();

    expect(companies).toHaveLength(2);
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it("stops on an empty page even if total disagrees with what was collected", async () => {
    const requestSpy = vi.spyOn(client, "request");
    requestSpy.mockResolvedValueOnce({
      data: [company(1)],
      total: 5,
      limit: 200,
      offset: 0,
    });
    requestSpy.mockResolvedValueOnce({
      data: [],
      total: 5,
      limit: 200,
      offset: 1,
    });

    const companies = await listAllCompanies();

    expect(companies).toHaveLength(1);
    expect(requestSpy).toHaveBeenCalledTimes(2);
  });

  it("returns an empty array when there are no companies", async () => {
    const requestSpy = vi.spyOn(client, "request");
    requestSpy.mockResolvedValueOnce({ data: [], total: 0, limit: 200, offset: 0 });

    const companies = await listAllCompanies();

    expect(companies).toEqual([]);
  });
});
