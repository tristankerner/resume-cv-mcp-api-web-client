import { request } from "@/lib/api/client";
import type { ApplicationSummary } from "@/lib/api/applications";
import type { Contact } from "@/lib/api/contacts";
import { buildQuery, type ListEnvelope } from "@/lib/api/tracking";
import type { CompanyRelationshipType, StackItemType } from "@/lib/config";

export interface CompanySummary {
  id: number;
  name: string;
  website: string | null;
  description: string | null;
  personal_note: string | null;
  application_count: number;
  contact_count: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyRelationship {
  id: number;
  from_company_id: number;
  from_company_name: string;
  to_company_id: number;
  to_company_name: string;
  type: CompanyRelationshipType;
  note: string | null;
  created_at: string;
}

export interface CompanyStackItem {
  id: number;
  company_id: number;
  name: string;
  type: StackItemType;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyDetail extends CompanySummary {
  relationships: CompanyRelationship[];
  stack: CompanyStackItem[];
  contacts: Contact[];
  recent_applications: ApplicationSummary[];
}

export interface ListCompaniesParams {
  query?: string;
  limit?: number;
  offset?: number;
  sort?: "name" | "-name" | "created_at" | "-created_at";
}

export interface CreateCompanyRequest {
  name: string;
  website?: string | null;
  description?: string | null;
  personal_note?: string | null;
  confirm_create_duplicate?: boolean;
}

export interface UpdateCompanyRequest {
  name?: string;
  website?: string | null;
  description?: string | null;
  personal_note?: string | null;
  confirm_create_duplicate?: boolean;
}

export interface CreateRelationshipRequest {
  to_company_id: number;
  type: CompanyRelationshipType;
  note?: string | null;
}

export interface UpdateRelationshipRequest {
  type?: CompanyRelationshipType;
  note?: string | null;
}

export interface CreateStackItemRequest {
  name: string;
  type: StackItemType;
  description?: string | null;
  confirm_create_duplicate?: boolean;
}

export interface UpdateStackItemRequest {
  name?: string;
  type?: StackItemType;
  description?: string | null;
}

export function listCompanies(params: ListCompaniesParams = {}) {
  return request<ListEnvelope<CompanySummary>>("GET", `/companies${buildQuery({ ...params })}`);
}

const COMPANIES_PAGE = 200; // the server's hard cap — routers/companies.py:21

/**
 * Every company, paged. `GET /companies` caps `limit` at 200; callers that
 * need a complete set (a filter dropdown, a website lookup) must page it or
 * they silently show a truncated world.
 */
export async function listAllCompanies(): Promise<CompanySummary[]> {
  const companies: CompanySummary[] = [];
  let offset = 0;
  for (;;) {
    const page = await listCompanies({ limit: COMPANIES_PAGE, offset });
    if (page.data.length === 0) break;
    companies.push(...page.data);
    offset += page.data.length;
    if (companies.length >= page.total) break;
  }
  return companies;
}

// POST/PATCH answer with the list-row shape, not the detail shape — no
// relationships, stack, contacts, or recent_applications. Widening this back
// to CompanyDetail without also adding a refetch reintroduces the blank page
// on save (nested collections missing from the response).
export function createCompany(body: CreateCompanyRequest) {
  return request<CompanySummary>("POST", "/companies", { body });
}

export function getCompany(companyId: number) {
  return request<CompanyDetail>("GET", `/companies/${companyId}`);
}

export function updateCompany(companyId: number, body: UpdateCompanyRequest) {
  return request<CompanySummary>("PATCH", `/companies/${companyId}`, { body });
}

export function deleteCompany(companyId: number) {
  return request<null>("DELETE", `/companies/${companyId}`);
}

export function createRelationship(companyId: number, body: CreateRelationshipRequest) {
  return request<CompanyRelationship>("POST", `/companies/${companyId}/relationships`, { body });
}

export function updateRelationship(relationshipId: number, body: UpdateRelationshipRequest) {
  return request<CompanyRelationship>("PATCH", `/company-relationships/${relationshipId}`, { body });
}

export function deleteRelationship(relationshipId: number) {
  return request<null>("DELETE", `/company-relationships/${relationshipId}`);
}

export function listStack(companyId: number) {
  return request<ListEnvelope<CompanyStackItem>>("GET", `/companies/${companyId}/stack`);
}

export function createStackItem(companyId: number, body: CreateStackItemRequest) {
  return request<CompanyStackItem>("POST", `/companies/${companyId}/stack`, { body });
}

export function updateStackItem(itemId: number, body: UpdateStackItemRequest) {
  return request<CompanyStackItem>("PATCH", `/company-stack/${itemId}`, { body });
}

export function deleteStackItem(itemId: number) {
  return request<null>("DELETE", `/company-stack/${itemId}`);
}
