import { afterEach, describe, expect, it, vi } from "vitest";

import { capabilities, passkeyLogin, passkeyOptions } from "@/lib/api/auth";

function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init };
}

describe("capabilities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends no Authorization header", async () => {
    const fetchMock = mockFetch({ passkeys: true });
    await capabilities("http://api.example.com");
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe("http://api.example.com/auth/capabilities");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

describe("passkeyOptions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends {username: null}, not an absent key, when no username is given", async () => {
    const fetchMock = mockFetch({ options: {}, login_token: "t", expires_in: 300 });
    await passkeyOptions("http://api.example.com");
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe("http://api.example.com/token/passkey/options");
    expect(JSON.parse(init.body as string)).toEqual({ username: null });
  });

  it("sends the username when given", async () => {
    const fetchMock = mockFetch({ options: {}, login_token: "t", expires_in: 300 });
    await passkeyOptions("http://api.example.com", "alice");
    const { init } = lastCall(fetchMock);
    expect(JSON.parse(init.body as string)).toEqual({ username: "alice" });
  });
});

describe("passkeyLogin", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the login_token and credential as JSON", async () => {
    const fetchMock = mockFetch({ access_token: "a", token_type: "bearer", refresh_token: "r" });
    await passkeyLogin("http://api.example.com", "lt", { id: "abc" });
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe("http://api.example.com/token/passkey");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ login_token: "lt", credential: { id: "abc" } });
  });
});
