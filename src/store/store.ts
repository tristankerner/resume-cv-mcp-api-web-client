import type { Session } from "@/lib/auth/session";
import type { User } from "@/lib/auth/scopes";

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

export interface StoreState {
  booting: boolean;
  session: Session | null;
  user: User | null;
  schemas: DocumentSchemas | null;
  view: View;
  viewParams: ViewParams | null;
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
  };

  listeners = new Set<Listener>();

  set(patch: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)): void {
    this.state = { ...this.state, ...(typeof patch === "function" ? patch(this.state) : patch) };
    for (const l of this.listeners) l();
  }

  navigate(view: View, viewParams: ViewParams | null = null): void {
    this.set({ view, viewParams });
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): StoreState => this.state;
}

export const store = new Store();
