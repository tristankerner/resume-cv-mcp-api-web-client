import type { Session } from "@/lib/auth/session";
import type { User } from "@/lib/auth/scopes";
import type { ApplicationStatus } from "@/lib/config";

export type View =
  | "documents"
  | "create"
  | "edit"
  | "applications"
  | "application"
  | "application-create"
  | "companies"
  | "company"
  | "company-create"
  | "contacts"
  | "contact"
  | "contact-create"
  | "api-keys"
  | "security"
  | "account"
  | "admin-users"
  | "admin-oauth-clients";

export interface DocumentSchemas {
  schemas: Record<string, unknown>;
}

export interface ViewParams {
  type?: string;
  name?: string;
  // The row a detail view is showing.
  id?: number;
  // Prefill for a create form, or a list filter.
  companyId?: number;
}

// List-view filters and pagination, lifted out of component useState into
// the store so opening a row and coming back preserves them — keyed by
// feature rather than by View, since e.g. "applications" and "application"
// share one filter set.
export interface ApplicationsListState {
  query: string;
  jobCode: string;
  statuses: ApplicationStatus[];
  companyFilter: string;
  submittedFrom: string;
  submittedTo: string;
  offset: number;
}

export interface CompaniesListState {
  query: string;
  sort: "name" | "-created_at";
  offset: number;
}

export interface ContactsListState {
  query: string;
  companyFilter: string;
  offset: number;
}

export interface ApiKeysListState {
  showInactive: boolean;
}

export const DEFAULT_APPLICATIONS_LIST_STATE: ApplicationsListState = {
  query: "",
  jobCode: "",
  statuses: [],
  companyFilter: "__all__",
  submittedFrom: "",
  submittedTo: "",
  offset: 0,
};

export const DEFAULT_COMPANIES_LIST_STATE: CompaniesListState = {
  query: "",
  sort: "name",
  offset: 0,
};

export const DEFAULT_CONTACTS_LIST_STATE: ContactsListState = {
  query: "",
  companyFilter: "__all__",
  offset: 0,
};

export const DEFAULT_API_KEYS_LIST_STATE: ApiKeysListState = {
  showInactive: false,
};

export interface StoreState {
  booting: boolean;
  session: Session | null;
  user: User | null;
  schemas: DocumentSchemas | null;
  view: View;
  viewParams: ViewParams | null;
  // The current view's breadcrumb leaf label, e.g. a company name a detail
  // view resolves after its fetch. Reset to null on every navigate() so a
  // stale name never survives into the next view.
  crumb: string | null;
  applicationsList: ApplicationsListState;
  companiesList: CompaniesListState;
  contactsList: ContactsListState;
  apiKeysList: ApiKeysListState;
}

type Listener = () => void;

// A tiny global store. Every subscribed component re-renders on any change —
// fine at this size, and much less code than fine-grained reactivity would
// be for the handful of views and modals this app has.
class Store {
  state: StoreState = {
    booting: true,
    session: null,
    user: null,
    schemas: null,
    view: "documents",
    viewParams: null,
    crumb: null,
    applicationsList: DEFAULT_APPLICATIONS_LIST_STATE,
    companiesList: DEFAULT_COMPANIES_LIST_STATE,
    contactsList: DEFAULT_CONTACTS_LIST_STATE,
    apiKeysList: DEFAULT_API_KEYS_LIST_STATE,
  };

  listeners = new Set<Listener>();

  set(patch: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)): void {
    this.state = { ...this.state, ...(typeof patch === "function" ? patch(this.state) : patch) };
    for (const l of this.listeners) l();
  }

  navigate(view: View, viewParams: ViewParams | null = null): void {
    this.set({ view, viewParams, crumb: null });
  }

  setCrumb(crumb: string | null): void {
    this.set({ crumb });
  }

  setApplicationsList(patch: Partial<ApplicationsListState>): void {
    this.set((s) => ({ applicationsList: { ...s.applicationsList, ...patch } }));
  }

  setCompaniesList(patch: Partial<CompaniesListState>): void {
    this.set((s) => ({ companiesList: { ...s.companiesList, ...patch } }));
  }

  setContactsList(patch: Partial<ContactsListState>): void {
    this.set((s) => ({ contactsList: { ...s.contactsList, ...patch } }));
  }

  setApiKeysList(patch: Partial<ApiKeysListState>): void {
    this.set((s) => ({ apiKeysList: { ...s.apiKeysList, ...patch } }));
  }

  // Called alongside every session clear (manual log out, forced 401) so a
  // new login — possibly as a different user with different scopes — never
  // inherits stale filters.
  clearListState(): void {
    this.set({
      applicationsList: DEFAULT_APPLICATIONS_LIST_STATE,
      companiesList: DEFAULT_COMPANIES_LIST_STATE,
      contactsList: DEFAULT_CONTACTS_LIST_STATE,
      apiKeysList: DEFAULT_API_KEYS_LIST_STATE,
    });
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): StoreState => this.state;
}

export const store = new Store();
