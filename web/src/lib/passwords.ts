// Password complexity — mirrors validate_password_complexity server-side:
// 8+ characters with upper, lower, digit and punctuation.
//
// Unicode property escapes rather than [A-Z]/[a-z]/[0-9], because the
// server's rules are Python's str.isupper/islower/isdigit, which are
// Unicode-aware. ASCII classes here rejected passwords the server would have
// accepted — "Éxample1!" showed "An uppercase letter" unmet — which fails
// safe but tells the user something untrue about their own password.
//
// A Set rather than a regex class for punctuation, so string.punctuation's
// characters (several of which are regex metacharacters) do not have to be
// re-escaped by hand. That one is exactly ASCII on the server too.

export const PUNCTUATION = new Set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'.split(""));

export interface PasswordCheck {
  label: string;
  met: boolean;
}

export function passwordComplexityChecks(pw: string): PasswordCheck[] {
  return [
    { label: "At least 8 characters", met: pw.length >= 8 },
    { label: "An uppercase letter", met: /\p{Lu}/u.test(pw) },
    { label: "A lowercase letter", met: /\p{Ll}/u.test(pw) },
    { label: "A digit", met: /\p{Nd}/u.test(pw) },
    { label: "A special character", met: [...pw].some((c) => PUNCTUATION.has(c)) },
  ];
}
