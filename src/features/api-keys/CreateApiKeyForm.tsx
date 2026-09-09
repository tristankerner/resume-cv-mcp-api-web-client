import { type FormEvent, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as apiKeysApi from "@/lib/api/apiKeys";
import type { CreateApiKeyResponse } from "@/lib/api/apiKeys";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { User } from "@/lib/auth/scopes";

const EXPIRATION_OPTIONS = [
  { label: "30 days", days: "30" },
  { label: "90 days", days: "90" },
  { label: "365 days", days: "365" },
  { label: "Never expires", days: "null" },
];

export function CreateApiKeyForm({
  user,
  onCreated,
}: {
  user: User;
  onCreated: (resp: CreateApiKeyResponse) => void;
}) {
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [scopes, setScopes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleScope(scope: string) {
    setScopes((s) => (s.includes(scope) ? s.filter((x) => x !== scope) : [...s, scope]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (scopes.length === 0) {
      setError("Select at least one scope.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const resp = await apiKeysApi.createApiKey({
        name,
        scopes,
        expires_in_days: expiresInDays === "null" ? null : Number(expiresInDays),
      });
      setName("");
      setScopes([]);
      onCreated(resp);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>New API key</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Banner kind="error">{error}</Banner>
          <Field>
            <FieldLabel htmlFor="key-name">Name</FieldLabel>
            <Input
              id="key-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="key-expires">Expiration</FieldLabel>
            <Select value={expiresInDays} onValueChange={setExpiresInDays}>
              <SelectTrigger id="key-expires" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.days} value={opt.days}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="space-y-2">
            <Label>Scopes</Label>
            <div className="flex flex-wrap gap-3">
              {(user.scopes || []).map((scope) => (
                <Label key={scope} className="font-normal">
                  <Checkbox checked={scopes.includes(scope)} onCheckedChange={() => toggleScope(scope)} />
                  {scope}
                </Label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={busy || scopes.length === 0}>
            {busy ? "Creating…" : "Create key"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
