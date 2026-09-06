// Mirrors reject_unreachable_names server-side, so a bad name is caught
// before the round trip. Not a substitute for it: the server is still the
// authority, and these rules must not drift ahead of what it actually
// enforces.
export function validateDocumentName(name: string): string | null {
  if (!name || !name.trim()) return "Document name cannot be blank.";
  if (name.includes("/") || name.includes("\\")) {
    return "Document name cannot contain a path separator.";
  }
  if ([...name].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) {
    return "Document name cannot contain control characters.";
  }
  if (name.length > 255) return "Document name cannot be longer than 255 characters.";
  return null;
}
