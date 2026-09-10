import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  listPasskeys,
  passkeyRegistrationOptions,
  passkeyStorageLabel,
  registerPasskey,
  removePasskey,
  renamePasskey,
} from "@/lib/api/passkeys";
import { store } from "@/store/store";

// None of these functions take an apiBase, so `request` falls back to the
// session in the store — same reason useSessionKeepAlive.test.ts seeds one.
function seedSession() {
  const now = Math.floor(Date.now() / 1000);
  store.set({
    session: {
      apiBase: "http://api.example.com",
      token: "access-token",
      exp: now + 3600,
      username: "alex",
      refreshToken: "refresh-token",
      refreshExp: now + 3600,
    },
  });
}

function mockFetch(body: unknown = null) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: body === null ? 204 : 200,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init };
}

describe("lib/api/passkeys", () => {
  beforeEach(() => {
    seedSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    store.set({ session: null });
  });

  it("listPasskeys hits GET /users/me/passkeys", async () => {
    const fetchMock = mockFetch({ enabled: true, credentials: [] });
    await listPasskeys();
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain("/users/me/passkeys");
    expect(init.method).toBe("GET");
  });

  it("passkeyRegistrationOptions POSTs to /users/me/passkeys/options", async () => {
    const fetchMock = mockFetch({ options: {}, registration_token: "t", expires_in: 300 });
    await passkeyRegistrationOptions({ current_password: "hunter2" });
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain("/users/me/passkeys/options");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ current_password: "hunter2" });
  });

  it("registerPasskey sends Content-Type: application/json and a nested credential", async () => {
    const fetchMock = mockFetch({ id: 1, label: "YubiKey", created_at: "", last_used_at: null, device_type: "multi_device", backed_up: true });
    await registerPasskey({
      registration_token: "t",
      label: "YubiKey",
      credential: { id: "abc", response: { clientDataJSON: "x" } },
    });
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain("/users/me/passkeys");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body.credential).toEqual({ id: "abc", response: { clientDataJSON: "x" } });
    expect(body.registration_token).toBe("t");
    expect(body.label).toBe("YubiKey");
  });

  it("renamePasskey PATCHes /users/me/passkeys/{id}", async () => {
    const fetchMock = mockFetch({ id: 5, label: "New name", created_at: "", last_used_at: null, device_type: "single_device", backed_up: false });
    await renamePasskey(5, { label: "New name" });
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain("/users/me/passkeys/5");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ label: "New name" });
  });

  it("removePasskey sends the password in a body on a DELETE", async () => {
    const fetchMock = mockFetch(null);
    await removePasskey(5, { current_password: "hunter2" });
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain("/users/me/passkeys/5");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ current_password: "hunter2" });
  });
});

describe("passkeyStorageLabel", () => {
  it("reads multi_device as Synced", () => {
    expect(
      passkeyStorageLabel({
        id: 1,
        label: "x",
        created_at: "",
        last_used_at: null,
        device_type: "multi_device",
        backed_up: true,
      }),
    ).toBe("Synced");
  });

  it("reads anything else as this device only", () => {
    expect(
      passkeyStorageLabel({
        id: 1,
        label: "x",
        created_at: "",
        last_used_at: null,
        device_type: "single_device",
        backed_up: false,
      }),
    ).toBe("This device only");
  });
});
