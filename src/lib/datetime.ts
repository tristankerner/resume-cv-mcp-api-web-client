// The single place any datetime is formatted or parsed. A datetime with no
// offset (from the API today, or from any row written before the API's Z-suffix
// fix lands) is treated as UTC — that is correct both before and after that fix.

import { TZDate } from "@date-fns/tz";

import type { User } from "@/lib/auth/scopes";

export type IanaZone = string;
export const UTC: IanaZone = "UTC";

// A bare "YYYY-MM-DDTHH:mm:ss" (no Z, no offset) is ambiguous per ECMAScript
// (parsed as local time), so give it an explicit Z rather than relying on
// TZDate/Date to guess.
function asUtcIso(iso: string): string {
  return /(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
}

export function effectiveZone(user: User | null | undefined): IanaZone {
  return user?.timezone ?? detectZone();
}

export function formatInstant(
  iso: string,
  zone: IanaZone,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(asUtcIso(iso));
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    ...opts,
    timeZone: zone,
  }).format(date);
}

export function formatDateOnly(iso: string, zone: IanaZone): string {
  const date = new Date(asUtcIso(iso));
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: zone,
  }).format(date);
}

// `zone` is part of the signature for symmetry with the other formatters,
// but a relative-time diff is the same duration regardless of zone.
export function formatRelative(iso: string, _zone: IanaZone): string {
  const date = new Date(asUtcIso(iso));
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 3600],
    ["month", 30 * 24 * 3600],
    ["week", 7 * 24 * 3600],
    ["day", 24 * 3600],
    ["hour", 3600],
    ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, secs] of units) {
    if (abs >= secs) return rtf.format(Math.round(diffSec / secs), unit);
  }
  if (abs < 5) return rtf.format(0, "second");
  return rtf.format(diffSec, "second");
}

// <input type="datetime-local"> holds *wall time in `zone`* — neither the
// browser's zone nor UTC — so bridging it requires TZDate.
export function instantToLocalInput(iso: string, zone: IanaZone): string {
  const zoned = new TZDate(asUtcIso(iso), zone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}` +
    `T${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`
  );
}

export function localInputToInstant(value: string, zone: IanaZone): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error(`Invalid datetime-local value: ${value}`);
  const [, y, mo, d, h, mi, s] = match;
  const zoned = new TZDate(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
    zone,
  );
  return new Date(zoned.getTime()).toISOString();
}

// e.g. "CDT", "GMT+5:30" — for the zone hint next to a datetime-local input.
export function zoneAbbreviation(zone: IanaZone, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    timeZoneName: "short",
  }).formatToParts(at);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? zone;
}

export function detectZone(): IanaZone {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone || UTC;
  } catch {
    return UTC;
  }
}

const FALLBACK_ZONES: IanaZone[] = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Jerusalem",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function allZones(): IanaZone[] {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      const zones = Intl.supportedValuesOf("timeZone");
      // Not part of the standard list, but "null timezone means UTC" (Appendix
      // A.2) means users need to be able to pick it explicitly.
      return zones.includes(UTC) ? zones : [UTC, ...zones];
    } catch {
      // fall through to the hardcoded list
    }
  }
  return FALLBACK_ZONES;
}
