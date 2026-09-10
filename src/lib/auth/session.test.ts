import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearSession, decodeJwtExp, loadSession, saveSession, type Session } from "@/lib/auth/session";
import { SESSION_STORAGE_KEY } from "@/lib/config";

// vitest's node environment has no localStorage (Node's own is opt-in via a
// flag) — a minimal in-memory Storage stands in for it.
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
    refreshToken: "refresh-token",
    refreshExp: now + 14 * 24 * 60 * 60,
    ...overrides,
  };
}

function fakeJwt(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encoded}.signature`;
}

describe("decodeJwtExp", () => {
  it("reads exp from a well-formed token", () => {
    expect(decodeJwtExp(fakeJwt({ exp: 1_800_000_000, sub: "someone" }))).toBe(1_800_000_000);
  });

  it("handles base64url characters (-, _) that plain base64 does not use", () => {
    // A payload large/varied enough that its base64 encoding is virtually
    // certain to contain a '-' or '_' at least once, not just '+'/'/'.
    const token = fakeJwt({ exp: 1_800_000_000, sub: "ÿþýüû" });
    expect(decodeJwtExp(token)).toBe(1_800_000_000);
  });

  it("returns null when exp is missing", () => {
    expect(decodeJwtExp(fakeJwt({ sub: "someone" }))).toBeNull();
  });

  it("returns null when exp is not a number", () => {
    expect(decodeJwtExp(fakeJwt({ exp: "soon" }))).toBeNull();
  });

  it("returns null for a token with no payload segment", () => {
    expect(decodeJwtExp("not-a-jwt")).toBeNull();
  });

  it("returns null for a payload segment that is not valid base64", () => {
    expect(decodeJwtExp("header.***.signature")).toBeNull();
  });

  it("returns null for a payload segment that decodes to non-JSON", () => {
    const encoded = Buffer.from("not json").toString("base64url");
    expect(decodeJwtExp(`header.${encoded}.signature`)).toBeNull();
  });
});

describe("loadSession", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads a session with a live access token", () => {
    const session = baseSession();
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    expect(loadSession()).toEqual(session);
  });

  it("loads a session whose access token has expired but whose refresh token has not", () => {
    const session = baseSession({ exp: Math.floor(Date.now() / 1000) - 3600 });
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    expect(loadSession()).toEqual(session);
  });

  it("does not load a session whose refresh token has also expired", () => {
    const session = baseSession({
      exp: Math.floor(Date.now() / 1000) - 3600,
      refreshExp: Math.floor(Date.now() / 1000) - 60,
    });
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    expect(loadSession()).toBeNull();
  });

  it("loads a legacy session with no refreshToken, marked unrefreshable", () => {
    const legacy = {
      apiBase: "http://localhost:8000",
      token: "access-token",
      exp: Math.floor(Date.now() / 1000) + 3600,
      username: "alex",
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(legacy));
    expect(loadSession()).toEqual({ ...legacy, refreshToken: null, refreshExp: null });
  });

  it("does not load a legacy session whose access token has expired", () => {
    const legacy = {
      apiBase: "http://localhost:8000",
      token: "access-token",
      exp: Math.floor(Date.now() / 1000) - 3600,
      username: "alex",
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(legacy));
    expect(loadSession()).toBeNull();
  });
});

describe("clearSession", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls logout when a refresh token is present", () => {
    const session = baseSession();
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    clearSession();
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/token/logout",
      expect.objectContaining({ method: "POST" }),
    );
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("does not call logout for a legacy session with no refresh token", () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ apiBase: "http://localhost:8000", token: "t", exp: 1, username: "alex" }),
    );
    clearSession();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not throw when the logout call fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const session = baseSession();
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    expect(() => clearSession()).not.toThrow();
    // Let the rejected fire-and-forget promise settle so it doesn't surface
    // as an unhandled rejection in a later test.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("is silent when there is nothing stored", () => {
    expect(() => clearSession()).not.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("saveSession", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips through loadSession", () => {
    const session = baseSession();
    saveSession(session);
    expect(loadSession()).toEqual(session);
  });
});
