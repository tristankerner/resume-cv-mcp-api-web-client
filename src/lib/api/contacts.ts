import { request } from "@/lib/api/client";
import { buildQuery, type ListEnvelope } from "@/lib/api/tracking";

export interface Contact {
  id: number;
  company_id: number | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  personal_note: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface ListContactsParams {
  company_id?: number;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface CreateContactRequest {
  company_id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
  personal_note?: string | null;
  rating?: number | null;
  confirm_create_duplicate?: boolean;
}

export interface UpdateContactRequest {
  company_id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
  personal_note?: string | null;
  rating?: number | null;
}

export function listContacts(params: ListContactsParams = {}) {
  return request<ListEnvelope<Contact>>("GET", `/contacts${buildQuery({ ...params })}`);
}

export function createContact(body: CreateContactRequest) {
  return request<Contact>("POST", "/contacts", { body });
}

export function getContact(contactId: number) {
  return request<Contact>("GET", `/contacts/${contactId}`);
}

export function updateContact(contactId: number, body: UpdateContactRequest) {
  return request<Contact>("PATCH", `/contacts/${contactId}`, { body });
}

export function deleteContact(contactId: number) {
  return request<null>("DELETE", `/contacts/${contactId}`);
}
