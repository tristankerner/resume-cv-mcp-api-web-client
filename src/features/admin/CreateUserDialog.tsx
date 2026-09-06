import { type FormEvent, useMemo, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as adminApi from "@/lib/api/admin";
import type { Role } from "@/lib/api/admin";
import { ApiError, errorMessage } from "@/lib/api/client";
import { passwordComplexityChecks } from "@/lib/passwords";

const ALL_ROLES: Role[] = ["member", "admin"];

export function CreateUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [retype, setRetype] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roles, setRoles] = useState<Role[]>(["member"]);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checks = useMemo(() => passwordComplexityChecks(password), [password]);
  const allMet = checks.every((c) => c.met);
  const retypeMatches = retype.length > 0 && password === retype;

  function toggleRole(role: Role) {
    setRoles((r) => (r.includes(role) ? r.filter((x) => x !== role) : [...r, role]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allMet) {
      setError("The password does not meet the requirements below.");
      return;
    }
    if (!retypeMatches) {
      setError("Passwords must match.");
      return;
    }
    setBusy(true);
    try {
      await adminApi.createUser({
        username,
        password,
        email: email || null,
        first_name: firstName || null,
        last_name: lastName || null,
        disabled,
        roles,
      });
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
          </DialogHeader>
          <Banner kind="error">{error}</Banner>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-username">Username</Label>
            <Input
              id="new-user-username"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              autoComplete="off"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-user-first-name">First name</Label>
              <Input id="new-user-first-name" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-user-last-name">Last name</Label>
              <Input id="new-user-last-name" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-email">Email</Label>
            <Input id="new-user-email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-password">Password</Label>
            <Input
              id="new-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
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
            <Label htmlFor="new-user-retype">Retype password</Label>
            <Input
              id="new-user-retype"
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
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex gap-4">
              {ALL_ROLES.map((role) => (
                <Label key={role} className="font-normal capitalize">
                  <Checkbox checked={roles.includes(role)} onCheckedChange={() => toggleRole(role)} />
                  {role}
                </Label>
              ))}
            </div>
          </div>
          <Label className="font-normal">
            <Checkbox checked={disabled} onCheckedChange={(v) => setDisabled(v === true)} />
            Disabled
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
