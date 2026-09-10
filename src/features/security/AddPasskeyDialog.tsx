import { useEffect, useState } from "react";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";

import { ConfirmPasswordDialog } from "@/components/common/ConfirmPasswordDialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import * as passkeysApi from "@/lib/api/passkeys";
import { createCredential, passkeyErrorMessage } from "@/lib/auth/webauthn";

// The order here is not the obvious one. Step 1 collects the password *and*
// the label through ConfirmPasswordDialog, then fetches registration
// options — both while the dialog is still on screen. Only once that
// resolves do we unmount it (by clearing `password` phase and storing
// `pending`), and only in the effect that follows — which runs after React
// has committed that unmount — do we hand off to the browser's own modal.
// Leaving a Radix Dialog mounted underneath the platform authenticator
// prompt is what produces the "fingerprint sheet behind a dimmed overlay"
// bug, and its focus trap can also swallow the ceremony on some platforms.
export function AddPasskeyDialog({
  onCancel,
  onAdded,
  onFailed,
}: {
  onCancel: () => void;
  onAdded: () => void;
  onFailed: (message: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState<{
    options: PublicKeyCredentialCreationOptionsJSON;
    registrationToken: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    (async () => {
      try {
        const credential = await createCredential(pending.options);
        if (cancelled) return;
        await passkeysApi.registerPasskey({
          registration_token: pending.registrationToken,
          label: pending.label,
          credential,
        });
        if (!cancelled) onAdded();
      } catch (err) {
        if (cancelled) return;
        // Nothing to clean up either way: unlike TOTP enrolment, which
        // inserts a pending row that SecurityView deletes on cancel, the
        // server writes nothing here until registerPasskey above succeeds.
        // There is also nothing to retry in place — the registration token
        // is spent-shaped, so any failure sends the user back to step 1.
        const message = passkeyErrorMessage(err);
        if (message === null) onCancel();
        else onFailed(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pending]);

  if (pending) return null;

  return (
    <ConfirmPasswordDialog
      title="Add a passkey"
      confirmLabel="Continue"
      onCancel={onCancel}
      extra={
        <Field>
          <FieldLabel htmlFor="passkey-label">Label</FieldLabel>
          <Input
            id="passkey-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
            required
          />
          <FieldDescription>
            A name to tell this passkey apart from any others — e.g. "Phone" or "YubiKey".
          </FieldDescription>
        </Field>
      }
      onConfirm={async (password) => {
        const { options, registration_token } = await passkeysApi.passkeyRegistrationOptions({
          current_password: password,
        });
        setPending({
          options: options as unknown as PublicKeyCredentialCreationOptionsJSON,
          registrationToken: registration_token,
          label,
        });
      }}
    />
  );
}
