import { type FormEvent, useEffect, useRef, useState } from "react";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import * as authApi from "@/lib/api/auth";
import type { Token } from "@/lib/api/auth";
import { schemas } from "@/lib/api/documents";
import { ApiError, errorMessage } from "@/lib/api/client";
import { decodeJwtExp, loadLastApiBase, saveSession, type Session } from "@/lib/auth/session";
import {
  browserCanUsePasskeys,
  browserSupportsAutofill,
  cancelPasskeyCeremony,
  getCredential,
  passkeyErrorMessage,
} from "@/lib/auth/webauthn";
import { REFRESH_TOKEN_ASSUMED_LIFETIME_SECONDS } from "@/lib/config";
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
  const [passkeysAvailable, setPasskeysAvailable] = useState(false);
  const wasLoggedIn = useRef(!!user);

  // The API base is an editable field, so this can't be fetched once.
  // Debounced: `apiBase` changes on every keystroke, and this must not
  // become a request per character typed into the field.
  useEffect(() => {
    if (!browserCanUsePasskeys()) return;
    const base = apiBase.replace(/\/+$/, "");
    if (!base) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const caps = await authApi.capabilities(base);
        if (!cancelled) setPasskeysAvailable(caps.passkeys);
      } catch {
        // A server too old for this route, or unreachable. Either way the
        // button stays hidden and the password form is unaffected — this is
        // a progressive enhancement, never a precondition for logging in.
        if (!cancelled) setPasskeysAvailable(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [apiBase]);

  // Shared by both steps: whichever one ends with an access token finishes
  // the same way — decode the expiry, persist the session, load the user and
  // schemas, and land on the right view.
  async function completeLogin(base: string, forUsername: string, token: Token) {
    const exp = decodeJwtExp(token.access_token);
    if (!exp) throw new ApiError(0, "http", "Server returned a token with no expiry.");
    const session: Session = {
      apiBase: base,
      token: token.access_token,
      exp,
      username: forUsername,
      refreshToken: token.refresh_token,
      refreshExp: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_ASSUMED_LIFETIME_SECONDS,
    };
    // Saved before authApi.me() below: that call reads the token out of the
    // store, so this has to land first regardless of whether it gets
    // re-saved a moment later.
    saveSession(session);
    store.set({ session });
    const [nextUser, nextSchemas] = await Promise.all([authApi.me(), schemas()]);
    // Re-saved with the authoritative username: a passkey login may not have
    // had one to send (the usernameless flow), and the session is what the
    // sidebar and the API-base memory read back.
    if (nextUser.username !== forUsername) {
      const named = { ...session, username: nextUser.username };
      saveSession(named);
      store.set({ session: named });
    }
    store.set({ user: nextUser, schemas: nextSchemas, view: wasLoggedIn.current ? store.state.view : "documents" });
  }

  // A conditional ceremony started on mount and aborted on unmount — the
  // browser's own autofill dropdown offers a saved passkey alongside typed
  // credentials. Keyed on `passkeysAvailable` alone, deliberately not
  // `apiBase`: restarting this on every keystroke in the API base field
  // would be worse than pointing at a stale base for one attempt.
  useEffect(() => {
    if (!passkeysAvailable) return;
    let cancelled = false;
    (async () => {
      if (!(await browserSupportsAutofill()) || cancelled) return;
      try {
        const base = apiBase.replace(/\/+$/, "");
        // Usernameless by construction: the browser matches the credential
        // to whatever the user picks out of the autofill dropdown.
        const { options, login_token } = await authApi.passkeyOptions(base);
        const credential = await getCredential(
          options as unknown as PublicKeyCredentialRequestOptionsJSON,
          true,
        );
        if (cancelled) return;
        const token = await authApi.passkeyLogin(base, login_token, credential);
        await completeLogin(base, "", token);
      } catch (err) {
        // An abort is the normal end of a conditional ceremony — it is how
        // the browser says "the user typed a password instead". Never
        // surface it.
        const message = passkeyErrorMessage(err);
        if (!cancelled && message !== null) setError(message);
      }
    })();
    return () => {
      cancelled = true;
      cancelPasskeyCeremony();
    };
  }, [passkeysAvailable]);

  async function signInWithPasskey() {
    setBusy(true);
    setError(null);
    try {
      const base = apiBase.replace(/\/+$/, "");
      // `username` is passed when the field has something in it and omitted
      // when it does not: with a name the server scopes the ceremony to that
      // account's credentials, and without one the browser offers every
      // passkey it holds for this site. Both are supported; neither is
      // required.
      const { options, login_token } = await authApi.passkeyOptions(base, username || undefined);
      const credential = await getCredential(options as unknown as PublicKeyCredentialRequestOptionsJSON);
      const token = await authApi.passkeyLogin(base, login_token, credential);
      await completeLogin(base, username, token);
    } catch (err) {
      const message = passkeyErrorMessage(err);
      if (message !== null) setError(message);
    } finally {
      setBusy(false);
    }
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
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
        <Card className="w-full max-w-sm">
          <form onSubmit={submitCode}>
            <CardHeader>
              <CardTitle>Enter your code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Banner kind="error">{error}</Banner>
              <Field>
                <FieldLabel htmlFor="mfa-code">Code</FieldLabel>
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
                  <FieldDescription>
                    Lost your authenticator? A backup code works here too.
                  </FieldDescription>
                )}
              </Field>
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
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
            <Field>
              <FieldLabel htmlFor="api-base">API base URL</FieldLabel>
              <Input
                id="api-base"
                type="text"
                value={apiBase}
                onChange={(e) => setApiBase(e.currentTarget.value)}
                autoComplete="url"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                autoComplete="username webauthn"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Logging in…" : "Log in"}
            </Button>
            {passkeysAvailable && (
              // type="button": inside a <form>, the default is submit, and
              // the default would fire the password login instead.
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={signInWithPasskey}
              >
                Sign in with a passkey
              </Button>
            )}
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
