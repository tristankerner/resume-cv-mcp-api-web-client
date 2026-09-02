import { type FormEvent, useState } from "react";
import { Trash2 } from "lucide-react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import * as adminApi from "@/lib/api/admin";
import type { AdminCreateClientResponse } from "@/lib/api/admin";
import { ApiError, errorMessage } from "@/lib/api/client";

export function RegisterClientDialog({
  onClose,
  onRegistered,
}: {
  onClose: () => void;
  onRegistered: (resp: AdminCreateClientResponse) => void;
}) {
  const [name, setName] = useState("");
  const [redirectUris, setRedirectUris] = useState<string[]>([""]);
  const [isPublic, setIsPublic] = useState(true);
  const [scope, setScope] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setUri(index: number, value: string) {
    setRedirectUris((uris) => uris.map((u, i) => (i === index ? value : u)));
  }

  function removeUri(index: number) {
    setRedirectUris((uris) => uris.filter((_, i) => i !== index));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const uris = redirectUris.map((u) => u.trim()).filter(Boolean);
    if (uris.length === 0) {
      setError("At least one redirect URI is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const resp = await adminApi.createOAuthClient({
        client_name: name,
        redirect_uris: uris,
        public: isPublic,
        scope: scope.trim() || null,
      });
      onRegistered(resp);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Register OAuth client</DialogTitle>
          </DialogHeader>
          <Banner kind="error">{error}</Banner>
          <div className="space-y-1.5">
            <Label htmlFor="client-name">Name</Label>
            <Input id="client-name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Redirect URIs</Label>
            {redirectUris.map((uri, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={uri}
                  onChange={(e) => setUri(i, e.currentTarget.value)}
                  placeholder="https://example.com/callback"
                  required
                />
                {redirectUris.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => removeUri(i)}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setRedirectUris((u) => [...u, ""])}>
              Add another URI
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="client-public" className="mb-0">
                Public client
              </Label>
              <p className="text-sm text-muted-foreground">
                No client secret — PKCE binds the exchange. Turn off for a confidential client
                that can keep a secret.
              </p>
            </div>
            <Switch id="client-public" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-scope">Default scope (optional)</Label>
            <Input
              id="client-scope"
              value={scope}
              onChange={(e) => setScope(e.currentTarget.value)}
              placeholder="resume:read resume:write"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Registering…" : "Register"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
