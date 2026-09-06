import { type FormEvent, useMemo, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { passwordComplexityChecks } from "@/lib/passwords";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";

export function AccountView() {
  const { user } = useStore();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [retype, setRetype] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const checks = useMemo(() => passwordComplexityChecks(next), [next]);
  const allMet = checks.every((c) => c.met);
  const retypeMatches = retype.length > 0 && next === retype;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!allMet) {
      setError("The new password does not meet the requirements below.");
      return;
    }
    if (!retypeMatches) {
      setError("New passwords must match.");
      return;
    }
    if (next === current) {
      setError("New password must be different from the current password.");
      return;
    }
    setBusy(true);
    try {
      await authApi.changePassword({
        current_password: current,
        new_password: next,
        new_password_retype: retype,
      });
      setSuccess(true);
      setCurrent("");
      setNext("");
      setRetype("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Account</h2>
      <Card className="mb-5">
        <CardContent className="space-y-1">
          <p className="font-semibold">{user!.username}</p>
          <p className="text-sm text-muted-foreground">Roles: {(user!.roles || []).join(", ") || "none"}</p>
          <p className="text-sm text-muted-foreground">Scopes: {(user!.scopes || []).join(", ") || "none"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Banner kind="error">{error}</Banner>
            <Banner kind="success">{success ? "Password changed." : null}</Banner>

            {/* Off-screen rather than absent: this is what lets a password
                manager associate the new password with this account and
                offer to save it. */}
            <input
              type="text"
              className="visually-hidden"
              name="username"
              value={user!.username}
              autoComplete="username"
              readOnly
              tabIndex={-1}
            />

            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.currentTarget.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={next}
                onChange={(e) => setNext(e.currentTarget.value)}
                autoComplete="new-password"
                required
              />
              <ul className="space-y-0.5 pl-4 text-sm">
                {checks.map((c) => (
                  <li key={c.label} className={c.met ? "text-success" : "text-muted-foreground"}>
                    {c.met ? "✓" : "—"} {c.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retype-password">Retype new password</Label>
              <Input
                id="retype-password"
                type="password"
                value={retype}
                onChange={(e) => setRetype(e.currentTarget.value)}
                autoComplete="new-password"
                required
              />
              {retype.length > 0 && !retypeMatches && (
                <p className="text-sm text-destructive">Passwords do not match.</p>
              )}
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Changing…" : "Change password"}
            </Button>
            <p className="text-sm text-muted-foreground">
              This does not sign out other sessions or revoke API keys — outstanding credentials
              stay valid until they expire or are revoked on their own. If you changed this
              because something may have leaked, also review your{" "}
              <a
                href="#"
                className="text-primary underline underline-offset-4"
                onClick={(e) => {
                  e.preventDefault();
                  store.navigate("api-keys");
                }}
              >
                API keys
              </a>
              .
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
