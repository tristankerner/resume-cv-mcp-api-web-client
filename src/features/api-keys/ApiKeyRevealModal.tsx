import { SecretReveal } from "@/components/common/SecretReveal";
import type { ApiKey } from "@/lib/api/apiKeys";

export function ApiKeyRevealModal({
  apiKey,
  secretKey,
  onClose,
}: {
  apiKey: ApiKey;
  secretKey: string;
  onClose: () => void;
}) {
  return (
    <SecretReveal
      title="Save this key now"
      description="This is the only time the secret is shown. It cannot be retrieved again."
      label={apiKey.name}
      secretValue={secretKey}
      onClose={onClose}
    />
  );
}
