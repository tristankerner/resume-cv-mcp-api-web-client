import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionKeepAlive } from "@/hooks/useSessionKeepAlive";
import type { Session } from "@/lib/auth/session";
import { KEEP_ALIVE_PROMPT_MS } from "@/lib/config";
import { store } from "@/store/store";

// vitest's node environment has no localStorage — clearSession() (called by
// signOut) touches it, so a minimal in-memory Storage stands in for it, same
// as src/lib/auth/session.test.ts.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function baseSession(overrides: Partial<Session> = {}): Session {
  const now = Math.floor(Date.now() / 1000);
  return {
    apiBase: "http://localhost:8000",
    token: "access-token",
    exp: now + 3600,
    username: "alex",
    refreshToken: "refresh-token-1",
    refreshExp: now + 14 * 24 * 60 * 60,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeAccessToken(exp: number): string {
  const encode = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ exp })}.sig`;
}

describe("SessionKeepAlive", () => {
  let keepAlive: SessionKeepAlive;

  beforeEach(() => {
    vi.useFakeTimers();
    // Pinned to a whole second: exp/refreshExp are computed in whole
    // seconds (Math.floor(Date.now() / 1000)), and a real wall-clock start
    // time almost never lands exactly on one. Without this, every
    // millisecond-precision boundary below is off by whatever fractional
    // second the test happened to start at.
    vi.setSystemTime(0);
    vi.stubGlobal("localStorage", new MemoryStorage());
    vi.stubGlobal("fetch", vi.fn());
    store.state = { ...store.state, session: null, user: null };
  });

  afterEach(() => {
    keepAlive.dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("defers the prompt while another dialog is open, then opens once it closes", () => {
    let anotherDialogOpen = true;
    vi.stubGlobal("document", {
      querySelector: () => (anotherDialogOpen ? {} : null),
    });

    keepAlive = new SessionKeepAlive();
    const session = baseSession({ exp: Math.floor(Date.now() / 1000) + 600 });
    store.set({ session });
    vi.advanceTimersByTime(600_000 - KEEP_ALIVE_PROMPT_MS);
    // The prompt would otherwise fire here, but EventComposer (or a
    // Dialog-based create/edit form) is open — stacking an AlertDialog over
    // an open Dialog is a focus-trap conflict, so it defers instead.
    expect(keepAlive.getSnapshot().open).toBe(false);

    // Still deferring on the next retry, since nothing has changed yet.
    vi.advanceTimersByTime(5_000);
    expect(keepAlive.getSnapshot().open).toBe(false);

    anotherDialogOpen = false;
    vi.advanceTimersByTime(5_000);
    expect(keepAlive.getSnapshot().open).toBe(true);
  });

  it("does not prompt when there is no session", () => {
    keepAlive = new SessionKeepAlive();
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(keepAlive.getSnapshot().open).toBe(false);
  });

  it("prompts at exp - KEEP_ALIVE_PROMPT_MS", () => {
    keepAlive = new SessionKeepAlive();
    const session = baseSession({ exp: Math.floor(Date.now() / 1000) + 600 }); // 10 min out
    store.set({ session });

    // Just before the fire point: still closed.
    vi.advanceTimersByTime(600_000 - KEEP_ALIVE_PROMPT_MS - 1_000);
    expect(keepAlive.getSnapshot().open).toBe(false);

    // At the fire point: open.
    vi.advanceTimersByTime(1_000);
    expect(keepAlive.getSnapshot().open).toBe(true);
  });

  it("does not prompt when refreshExp has already passed", () => {
    keepAlive = new SessionKeepAlive();
    const now = Math.floor(Date.now() / 1000);
    const session = baseSession({ exp: now + 600, refreshExp: now - 1 });
    store.set({ session });
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(keepAlive.getSnapshot().open).toBe(false);
  });

  it("does not prompt for a legacy session with no refresh token", () => {
    keepAlive = new SessionKeepAlive();
    const now = Math.floor(Date.now() / 1000);
    store.set({
      session: {
        apiBase: "http://localhost:8000",
        token: "t",
        exp: now + 600,
        username: "alex",
        refreshToken: null,
        refreshExp: null,
      },
    });
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(keepAlive.getSnapshot().open).toBe(false);
  });

  it("declining (doing nothing) does not refresh and does not clear the session early", async () => {
    keepAlive = new SessionKeepAlive();
    const session = baseSession({ exp: Math.floor(Date.now() / 1000) + 600 });
    store.set({ session });
    vi.advanceTimersByTime(600_000 - KEEP_ALIVE_PROMPT_MS);
    expect(keepAlive.getSnapshot().open).toBe(true);

    expect(fetch).not.toHaveBeenCalled();
    expect(store.state.session).toEqual(session);
  });

  it("confirming replaces the stored session, including a new refresh token", async () => {
    keepAlive = new SessionKeepAlive();
    const session = baseSession({ exp: Math.floor(Date.now() / 1000) + 600 });
    store.set({ session });
    vi.advanceTimersByTime(600_000 - KEEP_ALIVE_PROMPT_MS);
    expect(keepAlive.getSnapshot().open).toBe(true);

    const newExp = Math.floor(Date.now() / 1000) + 1800;
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        access_token: fakeAccessToken(newExp),
        token_type: "bearer",
        refresh_token: "refresh-token-2",
      }),
    );

    await keepAlive.confirm();

    expect(store.state.session?.refreshToken).toBe("refresh-token-2");
    expect(store.state.session?.refreshToken).not.toBe(session.refreshToken);
    expect(store.state.session?.exp).toBe(newExp);
    expect(keepAlive.getSnapshot().open).toBe(false);
    expect(keepAlive.getSnapshot().busy).toBe(false);
  });

  it("a failed refresh surfaces the error and does not leave a half-updated session", async () => {
    keepAlive = new SessionKeepAlive();
    const session = baseSession({ exp: Math.floor(Date.now() / 1000) + 600 });
    store.set({ session });
    vi.advanceTimersByTime(600_000 - KEEP_ALIVE_PROMPT_MS);
    expect(keepAlive.getSnapshot().open).toBe(true);

    // refresh() passes auth: false (same as login/completeMfa), so a 401
    // here does not go through client.ts's global session-clearing path —
    // it is just an error this dialog needs to show.
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ detail: "Could not validate credentials" }, 401));

    await keepAlive.confirm();

    // Untouched, not partially overwritten with fields from a request that
    // never actually succeeded.
    expect(store.state.session).toEqual(session);
    expect(keepAlive.getSnapshot().busy).toBe(false);
    expect(keepAlive.getSnapshot().error).toBeTruthy();
    // Stays open so the user can see the error and choose to retry or sign
    // out, rather than silently closing on failure.
    expect(keepAlive.getSnapshot().open).toBe(true);
  });

  it("reschedules after a successful refresh and does not double-fire", async () => {
    keepAlive = new SessionKeepAlive();
    const firstExp = Math.floor(Date.now() / 1000) + 600;
    store.set({ session: baseSession({ exp: firstExp }) });
    vi.advanceTimersByTime(600_000 - KEEP_ALIVE_PROMPT_MS);
    expect(keepAlive.getSnapshot().open).toBe(true);

    const secondExp = firstExp + 1800;
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        access_token: fakeAccessToken(secondExp),
        token_type: "bearer",
        refresh_token: "refresh-token-2",
      }),
    );
    await keepAlive.confirm();
    expect(keepAlive.getSnapshot().open).toBe(false);

    // secondExp is 1800s after firstExp, and confirm() resolved without
    // advancing the clock, so the rescheduled timer is exactly 1,800,000ms
    // out from here — not still the old one relative to firstExp, which
    // would already have re-fired well before this point.
    vi.advanceTimersByTime(1_800_000 - 1);
    expect(keepAlive.getSnapshot().open).toBe(false);
    vi.advanceTimersByTime(1);
    expect(keepAlive.getSnapshot().open).toBe(true);
  });
});
