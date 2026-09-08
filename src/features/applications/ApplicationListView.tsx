import { useEffect, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { DataTableFooter } from "@/components/common/DataTableFooter";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as applicationsApi from "@/lib/api/applications";
import type { ApplicationSummary } from "@/lib/api/applications";
import { ApiError, errorMessage } from "@/lib/api/client";
import * as companiesApi from "@/lib/api/companies";
import type { CompanySummary } from "@/lib/api/companies";
import type { ListEnvelope } from "@/lib/api/tracking";
import { canWrite } from "@/lib/auth/scopes";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/config";
import { applicationStatusVariant } from "@/lib/tracking/labels";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";

const LIMIT = 50;
const ALL_COMPANIES = "__all__";

export function ApplicationListView() {
  const { user } = useStore();
  const [query, setQuery] = useState("");
  const [jobCode, setJobCode] = useState("");
  const [statuses, setStatuses] = useState<Set<ApplicationStatus>>(new Set());
  const [companyFilter, setCompanyFilter] = useState(ALL_COMPANIES);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [submittedFrom, setSubmittedFrom] = useState("");
  const [submittedTo, setSubmittedTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<ListEnvelope<ApplicationSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    companiesApi.listCompanies({ limit: 200 }).then(
      (resp) => setCompanies(resp.data),
      () => {},
    );
  }, []);

  useEffect(() => {
    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, jobCode, statuses, companyFilter, submittedFrom, submittedTo, offset]);

  async function load() {
    setError(null);
    try {
      const resp = await applicationsApi.listApplications({
        query,
        job_code: jobCode || undefined,
        status: statuses.size > 0 ? [...statuses] : undefined,
        company_id: companyFilter !== ALL_COMPANIES ? Number(companyFilter) : undefined,
        submitted_from: submittedFrom || undefined,
        submitted_to: submittedTo || undefined,
        limit: LIMIT,
        offset,
      });
      setResult(resp);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  function toggleStatus(status: ApplicationStatus) {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
    setOffset(0);
  }

  const filtersActive =
    query !== "" ||
    jobCode !== "" ||
    statuses.size > 0 ||
    companyFilter !== ALL_COMPANIES ||
    submittedFrom !== "" ||
    submittedTo !== "";

  function clearFilters() {
    setQuery("");
    setStatuses(new Set());
    setCompanyFilter(ALL_COMPANIES);
    setSubmittedFrom("");
    setSubmittedTo("");
    setOffset(0);
  }

  return (
    <div>
      <PageHeader
        title="Applications"
        actions={
          canWrite(user, "applications") && (
            <Button onClick={() => store.navigate("application-create")}>New application</Button>
          )
        }
      />

      <Card className="mb-4">
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Input
              className="max-w-xs"
              placeholder="Job title or company…"
              value={query}
              onChange={(e) => {
                setQuery(e.currentTarget.value);
                setOffset(0);
              }}
            />
            <Input
              className="max-w-[12rem]"
              placeholder="Job code…"
              aria-label="Job code"
              value={jobCode}
              onChange={(e) => {
                setJobCode(e.currentTarget.value);
                setOffset(0);
              }}
            />
            <Select
              value={companyFilter}
              onValueChange={(v) => {
                setCompanyFilter(v);
                setOffset(0);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COMPANIES}>All companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="Submitted from"
                value={submittedFrom}
                onChange={(e) => {
                  setSubmittedFrom(e.currentTarget.value);
                  setOffset(0);
                }}
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="Submitted to"
                value={submittedTo}
                onChange={(e) => {
                  setSubmittedTo(e.currentTarget.value);
                  setOffset(0);
                }}
              />
            </div>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {APPLICATION_STATUSES.map((s) => {
              const active = statuses.has(s.value);
              return (
                <button key={s.value} type="button" onClick={() => toggleStatus(s.value)}>
                  <Badge variant={active ? "default" : s.terminal ? "secondary" : "outline"}>{s.label}</Badge>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {error && <Banner kind="error">{error}</Banner>}
      {result === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : result.data.length === 0 ? (
        <EmptyState>No applications yet.</EmptyState>
      ) : (
        <>
          <Table className="table-reflow">
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Job code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Attachments</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((app) => (
                <TableRow key={app.id}>
                  <TableCell data-label="Company">{app.company_name}</TableCell>
                  <TableCell data-label="Job title" className="whitespace-normal">
                    {app.job_title || "—"}
                  </TableCell>
                  <TableCell data-label="Job code">
                    {app.job_code ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">{app.job_code}</code>
                        {app.job_code_match_count > 0 && (
                          <Badge
                            variant="warning"
                            title={
                              "This job code is on " +
                              (app.job_code_match_count + 1) +
                              " applications — the same job has reached you more than once."
                            }
                          >
                            +{app.job_code_match_count}
                          </Badge>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell data-label="Status">
                    <Badge variant={applicationStatusVariant(app.status)}>{app.status_label}</Badge>
                  </TableCell>
                  <TableCell data-label="Submitted">{app.date_submitted || "—"}</TableCell>
                  <TableCell data-label="Source">{app.source || "—"}</TableCell>
                  <TableCell data-label="System">{app.system || "—"}</TableCell>
                  <TableCell data-label="Events">{app.event_count}</TableCell>
                  <TableCell data-label="Attachments">{app.attachment_count}</TableCell>
                  <TableCell data-label="">
                    <Button size="sm" variant="outline" onClick={() => store.navigate("application", { id: app.id })}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataTableFooter total={result.total} limit={LIMIT} offset={offset} onOffsetChange={setOffset} />
        </>
      )}
    </div>
  );
}
