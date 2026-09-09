import { UTC, effectiveZone, formatDateOnly, formatInstant, formatRelative } from "@/lib/datetime";
import { useStore } from "@/store/useStore";

// `DateTimeText` and `DateText` are deliberately separate components: an
// instant (`occurred_at`, `created_at`) needs zone conversion, a calendar
// date (`date_submitted`) never does. Keeping them distinct in the JSX makes
// that distinction hard to get wrong at a call site.

export function DateTimeText({
  value,
  format = "default",
  fallback = "—",
}: {
  value: string | null | undefined;
  // "date" renders only the calendar-date portion of an instant, converted
  // to the viewer's zone first — unlike DateText, which never converts
  // because it has no instant to convert from.
  format?: "default" | "short" | "relative" | "date";
  fallback?: React.ReactNode;
}) {
  const { user } = useStore();
  if (!value) return <>{fallback}</>;
  const zone = effectiveZone(user);
  if (format === "relative") return <>{formatRelative(value, zone)}</>;
  if (format === "date") return <>{formatDateOnly(value, zone)}</>;
  if (format === "short") {
    return <>{formatInstant(value, zone, { dateStyle: "short", timeStyle: "short" })}</>;
  }
  return <>{formatInstant(value, zone)}</>;
}

export function DateText({
  value,
  fallback = "—",
}: {
  value: string | null | undefined;
  fallback?: React.ReactNode;
}) {
  // A bare calendar date has no timezone of its own, so this is always
  // anchored to UTC rather than the viewer's zone — converting it would
  // shift the date across a midnight boundary, which is the bug this
  // component exists to prevent.
  if (!value) return <>{fallback}</>;
  return <>{formatDateOnly(value, UTC)}</>;
}
