import { useSyncExternalStore } from "react";

import * as authApi from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { clearSession, decodeJwtExp, saveSession, type Session } from "@/lib/auth/session";
import { KEEP_ALIVE_PROMPT_MS, REFRESH_TOKEN_ASSUMED_LIFETIME_SECONDS } from "@/lib/config";
import { store } from "@/store/store";

// A few seconds, not a poll loop — only reached when some other modal
// (EventComposer, a Dialog-based create/edit form) happens to be open at the
// moment the prompt would otherwise fire. Stacking an AlertDialog over an
// open Dialog is a focus-trap conflict, so this defers and checks again
// rather than opening on top of it or giving up.
const REOPEN_RETRY_MS = 5_000;

function anotherDialogIsOpen(): boolean {
  // No DOM in the unit test environment (vitest runs these under "node",
  // not jsdom) — nothing to conflict with there, so treat it as clear.
  if (typeof document === "undefined") return false;
  return (
    document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]') !==
    null
  );
}

interface KeepAliveSnapshot {
  open: boolean;
  busy: boolean;
  error: string | null;
}

// The scheduling/refresh/sign-out logic, framework-free so it can be driven
// directly with fake timers in tests without a DOM or a React renderer (this
// project has neither jsdom nor @testing-library/react installed, and Part B
// adds no new dependency — see THEMING_AND_SESSION_PLAN.md rule 6).
// useSessionKeepAlive below is a thin useSyncExternalStore wrapper around a
// single instance of this class, the same relationship src/store/useStore.ts
// has with the main Store.
export class SessionKeepAlive {
  private state: KeepAliveSnapshot = { open: false, busy: false, error: null };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  // Only the fields the schedule actually depends on — an unrelated store
  // update carrying an otherwise-identical session must not restart the
  // timer, and comparing the whole object would treat every store.set as a
  // new session because callers spread `...session` into their patches.
  private scheduledFor: string | null = null;
  private unsubscribeStore: () => void;

  constructor() {
    this.unsubscribeStore = store.subscribe(() => this.onStoreChange());
    this.onStoreChange();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): KeepAliveSnapshot => this.state;

  private setState(patch: Partial<KeepAliveSnapshot>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private onStoreChange(): void {
    const session = store.state.session;
    const key = session ? `${session.exp}:${session.refreshToken}:${session.refreshExp}` : null;
    if (key === this.scheduledFor) return;
    this.scheduledFor = key;

    this.clearTimer();
    this.setState({ open: false, error: null });
    if (!session?.refreshToken || !session.refreshExp) return; // nothing to refresh into
    if (session.refreshExp * 1000 <= Date.now()) return; // past the point of no return
    const delay = session.exp * 1000 - KEEP_ALIVE_PROMPT_MS - Date.now();
    this.timer = setTimeout(() => this.tryOpen(), Math.max(0, delay));
  }

  private tryOpen(): void {
    if (anotherDialogIsOpen()) {
      this.timer = setTimeout(() => this.tryOpen(), REOPEN_RETRY_MS);
      return;
    }
    this.setState({ open: true });
  }

  // A user who notices SessionCountdown's passive warning can jump straight
  // to this dialog instead of waiting for KEEP_ALIVE_PROMPT_MS to elapse.
  requestOpen = (): void => {
    this.clearTimer();
    this.tryOpen();
  };

  confirm = async (): Promise<void> => {
    const session = store.state.session;
    if (!session?.refreshToken) return;
    this.setState({ busy: true, error: null });
    try {
      const token = await authApi.refresh(session.apiBase, session.refreshToken);
      const exp = decodeJwtExp(token.access_token);
      if (!exp) throw new ApiError(0, "http", "Server returned a token with no expiry.");
      const next: Session = {
        ...session,
        token: token.access_token,
        exp,
        refreshToken: token.refresh_token,
        refreshExp: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_ASSUMED_LIFETIME_SECONDS,
      };
      saveSession(next);
      store.set({ session: next });
      this.setState({ busy: false, open: false });
    } catch (err) {
      this.setState({ busy: false, error: errorMessage(err) });
    }
  };

  // Signs out immediately rather than merely closing the dialog — someone
  // who wants to leave should not have to wait out the countdown.
  signOut = (): void => {
    clearSession();
    store.set({ session: null, user: null });
    store.clearListState();
  };

  // Not called by the app — the shared instance lives for the app's
  // lifetime, same as the Store singleton it subscribes to. Exists so tests
  // can tear an instance down between cases instead of accumulating store
  // listeners across a whole test file.
  dispose(): void {
    this.clearTimer();
    this.unsubscribeStore();
  }
}

let sharedInstance: SessionKeepAlive | null = null;

function getSharedInstance(): SessionKeepAlive {
  if (!sharedInstance) sharedInstance = new SessionKeepAlive();
  return sharedInstance;
}

export interface KeepAliveState extends KeepAliveSnapshot {
  requestOpen: () => void;
  confirm: () => void;
  signOut: () => void;
}

// Mounted once in AppShell. Owns the timer that decides when the "Still
// there?" prompt should appear, the prompt's own open state, and the
// refresh call that a confirmed prompt makes.
export function useSessionKeepAlive(): KeepAliveState {
  const instance = getSharedInstance();
  const snapshot = useSyncExternalStore(instance.subscribe, instance.getSnapshot);
  return {
    ...snapshot,
    requestOpen: instance.requestOpen,
    confirm: instance.confirm,
    signOut: instance.signOut,
  };
}
