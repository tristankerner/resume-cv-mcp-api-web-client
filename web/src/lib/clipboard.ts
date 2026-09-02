// The clipboard capability helper (§3.5). Feature-detected once at call
// time, never probed: calling writeText() to test it would consume the
// transient user activation a real click needs, and could overwrite
// whatever the user already had on their clipboard.

export type ClipboardMode = "async" | "exec" | "none";

export function clipboardMode(): ClipboardMode {
  if (window.isSecureContext && typeof navigator.clipboard?.writeText === "function") {
    return "async";
  }
  if (document.queryCommandSupported?.("copy")) {
    return "exec";
  }
  return "none";
}

export async function copyText(text: string): Promise<boolean> {
  const mode = clipboardMode();
  if (mode === "async") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Falls through to the exec attempt below — permission denied or
      // activation lost to an intervening dialog is still possible even
      // though the capability check passed.
    }
  }
  if (mode === "async" || mode === "exec") {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(el);
    if (ok) return true;
  }
  return false;
}
