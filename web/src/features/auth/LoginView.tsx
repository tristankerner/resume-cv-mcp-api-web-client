import { type FormEvent, useRef, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/lib/api/auth";
import { schemas } from "@/lib/api/documents";
import { ApiError, errorMessage } from "@/lib/api/client";
import { decodeJwtExp, loadLastApiBase, saveSession } from "@/lib/auth/session";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";

interface PendingMfa {
  apiBase: string;
  username: string;
  mfaToken: string;
  methods: string[];
}

export function LoginView() {
  const { user } = useStore();
  const [apiBase, setApiBase] = useState(loadLastApiBase());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  // Set instead of a token, once the password step comes back with
  // mfa_required: {apiBase, username, mfaToken, methods}. Holding the
  // resolved apiBase/username here (not re-reading the fields above) means a
  // change to either while the code screen is up can't send the second step
  // somewhere the first one didn't go.
  const [pending, setPending] = useState<PendingMfa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wasLoggedIn = useRef(!!user);

  // Shared by both steps: whichever one ends with an access token finishes
  // the same way — decode the expiry, persist the session, load the user and
  // schemas, and land on the right view.
  async function completeLogin(base: string, forUsername: string, token: { access_token: string }) {
    const exp = decodeJwtExp(token.access_token);
    if (!exp) throw new ApiError(0, "http", "Server returned a token with no expiry.");
    const session = { apiBase: base, token: token.access_token, exp, username: forUsername };
    saveSession(session);
    store.set({ session });
    const [nextUser, nextSchemas] = await Promise.all([authApi.me(), schemas()]);
    store.set({ user: nextUser, schemas: nextSchemas, view: wasLoggedIn.current ? store.state.view : "documents" });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const base = apiBase.replace(/\/+$/, "");
      const result = await authApi.login(base, username, password);
      if (authApi.isMfaRequired(result)) {
        setPending({ apiBase: base, username, mfaToken: result.mfa_token, methods: result.methods });
        return;
      }
      await completeLogin(base, username, result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const token = await authApi.completeMfa(pending.apiBase, pending.mfaToken, code);
      await completeLogin(pending.apiBase, pending.username, token);
    } catch (err) {
      // A 401 here does not clear the session — completeMfa passes
      // auth: false, same as login — so this only ever re-shows the code
      // screen with the error, never the "session expired" login form.
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <Card className="w-full max-w-sm">
          <form onSubmit={submitCode}>
            <CardHeader>
              <CardTitle>Enter your code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Banner kind="error">{error}</Banner>
              <div className="space-y-1.5">
                <Label htmlFor="mfa-code">Code</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.currentTarget.value)}
                  autoFocus
                  required
                />
                {pending.methods.includes("backup_codes") && (
                  <p className="text-sm text-muted-foreground">
                    Lost your authenticator? A backup code works here too.
                  </p>
                )}
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Verifying…" : "Continue"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setPending(null);
                  setCode("");
                  setError(null);
                }}
              >
                Back
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={submit}>
          <CardHeader>
            <CardTitle>{wasLoggedIn.current ? "Session expired" : "Log in"}</CardTitle>
            {wasLoggedIn.current && (
              <p className="text-sm text-muted-foreground">
                Your work below is still here — log back in to continue.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <Banner kind="error">{error}</Banner>
            <div className="space-y-1.5">
              <Label htmlFor="api-base">API base URL</Label>
              <Input
                id="api-base"
                type="text"
                value={apiBase}
                onChange={(e) => setApiBase(e.currentTarget.value)}
                autoComplete="url"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Logging in…" : "Log in"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
