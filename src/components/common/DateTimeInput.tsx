import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  effectiveZone,
  instantToLocalInput,
  localInputToInstant,
  zoneAbbreviation,
} from "@/lib/datetime";
import { useStore } from "@/store/useStore";

// `<input type="datetime-local">` bound to the user's effective zone. The
// input always holds wall time in that zone, never the browser's zone and
// never UTC — see src/lib/datetime.ts.
export function DateTimeInput({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}) {
  const { user } = useStore();
  const zone = effectiveZone(user);
  const localValue = value ? instantToLocalInput(value, zone) : "";

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="datetime-local"
        value={localValue}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          if (raw) onChange(localInputToInstant(raw, zone));
        }}
      />
      <FieldDescription>Times shown in {zoneAbbreviation(zone)}.</FieldDescription>
    </Field>
  );
}
