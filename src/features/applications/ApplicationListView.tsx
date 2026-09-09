import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { Banner } from "@/components/common/Banner";
import { DataTableFooter } from "@/components/common/DataTableFooter";
import { DateText } from "@/components/common/DateTime";
import { EmptyState } from "@/components/common/EmptyState";
import { EditableCell } from "@/components/common/inline/EditableCell";
import { CompanyEditor } from "@/components/common/inline/editors/CompanyEditor";
import { DateEditor } from "@/components/common/inline/editors/DateEditor";
import { TextEditor } from "@/components/common/inline/editors/TextEditor";
import { useInlineEdit } from "@/components/common/inline/useInlineEdit";
import { PageHeader } from "@/components/common/PageHeader";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  const { user, applicationsList } = useStore();
  const { query, jobCode, companyFilter, submittedFrom, submittedTo, offset } = applicationsList;
  const statuses = useMemo(() => new Set(applicationsList.statuses), [applicationsList.statuses]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [result, setResult] = useState<ListEnvelope<ApplicationSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { commit } = useInlineEdit<ApplicationSummary>();
  const writable = canWrite(user, "applications");

  const setRows: Dispatch<SetStateAction<ApplicationSummary[]>> = (update) => {
    setResult((prev) => {
      if (!prev) return prev;
      const nextData =
        typeof update === "function" ? (update as (p: ApplicationSummary[]) => ApplicationSummary[])(prev.data) : update;
      return { ...prev, data: nextData };
    });
  };

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
  }, [query, jobCode, applicationsList.statuses, companyFilter, submittedFrom, submittedTo, offset]);

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

  const filtersActive =
    query !== "" ||
    jobCode !== "" ||
    statuses.size > 0 ||
    companyFilter !== ALL_COMPANIES ||
    submittedFrom !== "" ||
    submittedTo !== "";

  function clearFilters() {
    store.setApplicationsList({
      query: "",
      statuses: [],
      companyFilter: ALL_COMPANIES,
      submittedFrom: "",
      submittedTo: "",
      offset: 0,
    });
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
            <InputGroup className="max-w-xs">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Job title or company…"
                value={query}
                onChange={(e) => {
                  store.setApplicationsList({ query: e.currentTarget.value, offset: 0 });
                }}
              />
            </InputGroup>
            <Input
              className="max-w-[12rem]"
              placeholder="Job code…"
              aria-label="Job code"
              value={jobCode}
              onChange={(e) => {
                store.setApplicationsList({ jobCode: e.currentTarget.value, offset: 0 });
              }}
            />
            <Select
              value={companyFilter}
              onValueChange={(v) => {
                store.setApplicationsList({ companyFilter: v, offset: 0 });
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
            <InputGroup className="w-auto flex-wrap">
              <InputGroupInput
                type="date"
                aria-label="Submitted from"
                className="w-auto flex-none"
                value={submittedFrom}
                onChange={(e) => {
                  store.setApplicationsList({ submittedFrom: e.currentTarget.value, offset: 0 });
                }}
              />
              <InputGroupAddon>to</InputGroupAddon>
              <InputGroupInput
                type="date"
                aria-label="Submitted to"
                className="w-auto flex-none"
                value={submittedTo}
                onChange={(e) => {
                  store.setApplicationsList({ submittedTo: e.currentTarget.value, offset: 0 });
                }}
              />
            </InputGroup>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
          <ToggleGroup
            type="multiple"
            variant="outline"
            className="flex-wrap gap-1.5"
            value={applicationsList.statuses}
            onValueChange={(values) => store.setApplicationsList({ statuses: values as ApplicationStatus[], offset: 0 })}
          >
            {APPLICATION_STATUSES.map((s) => {
              const active = statuses.has(s.value);
              return (
                <ToggleGroupItem
                  key={s.value}
                  value={s.value}
                  aria-label={s.label}
                  className="h-auto border-0 bg-transparent p-0 hover:bg-transparent data-[state=on]:bg-transparent"
                >
                  <Badge variant={active ? "default" : s.terminal ? "secondary" : "outline"}>{s.label}</Badge>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </CardContent>
      </Card>

      {error && <Banner kind="error">{error}</Banner>}
      {result === null ? (
        <TableSkeleton />
      ) : result.data.length === 0 ? (
        <EmptyState
          action={
            canWrite(user, "applications") && (
              <Button size="sm" onClick={() => store.navigate("application-create")}>
                New application
              </Button>
            )
          }
        >
          No applications yet.
        </EmptyState>
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
                  <EditableCell<number | null>
                    value={app.company_id}
                    editable={writable}
                    ariaLabel={`Edit company for ${app.job_title || "application"}`}
                    dataLabel="Company"
                    display={app.company_name}
                    renderEditor={(props) => <CompanyEditor {...props} valueLabel={app.company_name} />}
                    onCommit={(value) =>
                      commit({
                        rowId: app.id,
                        getId: (r) => r.id,
                        setRows,
                        previousValues: { company_id: app.company_id, company_name: app.company_name },
                        optimisticValues: value != null ? { company_id: value } : {},
                        patch: (id, body) => applicationsApi.updateApplication(id, body),
                        body: { company_id: value ?? undefined },
                      })
                    }
                    onOpenCandidate={(id) => store.navigate("company", { id })}
                  />
                  <EditableCell<string>
                    value={app.job_title ?? ""}
                    editable={writable}
                    ariaLabel={`Edit job title for ${app.job_title || "application"}`}
                    dataLabel="Job title"
                    className="whitespace-normal"
                    display={app.job_title || "—"}
                    renderEditor={(props) => <TextEditor {...props} />}
                    onCommit={(value) =>
                      commit({
                        rowId: app.id,
                        getId: (r) => r.id,
                        setRows,
                        previousValues: { job_title: app.job_title },
                        optimisticValues: { job_title: value.trim() || null },
                        patch: (id, body) => applicationsApi.updateApplication(id, body),
                        body: { job_title: value.trim() || null },
                      })
                    }
                  />
                  <EditableCell<string>
                    value={app.job_code ?? ""}
                    editable={writable}
                    ariaLabel={`Edit job code for ${app.job_title || "application"}`}
                    dataLabel="Job code"
                    display={
                      app.job_code ? (
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
                      )
                    }
                    renderEditor={(props) => <TextEditor {...props} />}
                    onCommit={(value, force) =>
                      commit({
                        rowId: app.id,
                        getId: (r) => r.id,
                        setRows,
                        previousValues: { job_code: app.job_code },
                        optimisticValues: { job_code: value.trim() || null },
                        patch: (id, body) => applicationsApi.updateApplication(id, body),
                        body: { job_code: value.trim() || null, confirm_create_duplicate: !!force },
                      })
                    }
                    onOpenCandidate={(id) => store.navigate("application", { id })}
                  />
                  <TableCell data-label="Status">
                    <Badge variant={applicationStatusVariant(app.status)}>{app.status_label}</Badge>
                  </TableCell>
                  <EditableCell<string>
                    value={app.date_submitted ?? ""}
                    editable={writable}
                    ariaLabel={`Edit date submitted for ${app.job_title || "application"}`}
                    dataLabel="Submitted"
                    display={<DateText value={app.date_submitted} />}
                    renderEditor={(props) => <DateEditor {...props} />}
                    onCommit={(value) =>
                      commit({
                        rowId: app.id,
                        getId: (r) => r.id,
                        setRows,
                        previousValues: { date_submitted: app.date_submitted },
                        optimisticValues: { date_submitted: value || null },
                        patch: (id, body) => applicationsApi.updateApplication(id, body),
                        body: { date_submitted: value || null },
                      })
                    }
                  />
                  <EditableCell<string>
                    value={app.source ?? ""}
                    editable={writable}
                    ariaLabel={`Edit source for ${app.job_title || "application"}`}
                    dataLabel="Source"
                    display={app.source || "—"}
                    renderEditor={(props) => <TextEditor {...props} />}
                    onCommit={(value) =>
                      commit({
                        rowId: app.id,
                        getId: (r) => r.id,
                        setRows,
                        previousValues: { source: app.source },
                        optimisticValues: { source: value.trim() || null },
                        patch: (id, body) => applicationsApi.updateApplication(id, body),
                        body: { source: value.trim() || null },
                      })
                    }
                  />
                  <EditableCell<string>
                    value={app.system ?? ""}
                    editable={writable}
                    ariaLabel={`Edit system for ${app.job_title || "application"}`}
                    dataLabel="System"
                    display={app.system || "—"}
                    renderEditor={(props) => <TextEditor {...props} />}
                    onCommit={(value) =>
                      commit({
                        rowId: app.id,
                        getId: (r) => r.id,
                        setRows,
                        previousValues: { system: app.system },
                        optimisticValues: { system: value.trim() || null },
                        patch: (id, body) => applicationsApi.updateApplication(id, body),
                        body: { system: value.trim() || null },
                      })
                    }
                  />
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
          <DataTableFooter
            total={result.total}
            limit={LIMIT}
            offset={offset}
            onOffsetChange={(next) => store.setApplicationsList({ offset: next })}
          />
        </>
      )}
    </div>
  );
}
