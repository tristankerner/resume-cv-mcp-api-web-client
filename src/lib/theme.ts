export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function resolveTheme(pref: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (pref === "system") return prefersDark ? "dark" : "light";
  return pref;
}
