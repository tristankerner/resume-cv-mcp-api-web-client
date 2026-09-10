import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// WCAG 2.1 relative luminance / contrast ratio, computed straight from
// OKLCH so the tokens in src/index.css never need a round-trip through any
// other color space. No dependency — see THEMING_AND_SESSION_PLAN.md §4.4/§6.
type Oklch = readonly [l: number, c: number, h: number];

function oklchToLinearSrgb([l, c, hDeg]: Oklch): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

function relativeLuminance(color: Oklch): number {
  // The linear-RGB channels from the OKLab matrices are already
  // linear-light sRGB, so WCAG luminance is a direct weighted sum — no
  // separate gamma-linearization step needed.
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const [r, g, b] = oklchToLinearSrgb(color).map(clamp);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: Oklch, b: Oklch): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

type TokenMap = Map<string, Oklch>;

function parseBlock(css: string, selector: string): TokenMap {
  const blockMatch = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  if (!blockMatch) throw new Error(`Could not find ${selector} block in index.css`);
  const map: TokenMap = new Map();
  const re = /--([\w-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blockMatch[1]))) {
    map.set(m[1], [Number(m[2]), Number(m[3]), Number(m[4])]);
  }
  return map;
}

function token(map: TokenMap, name: string): Oklch {
  const value = map.get(name);
  if (!value) throw new Error(`Token --${name} not found — check the selector's block`);
  return value;
}

const css = readFileSync(path.resolve(import.meta.dirname, "..", "index.css"), "utf-8");
const root = parseBlock(css, ":root");
const dark = parseBlock(css, "\\.dark");

const pairs: Array<[fg: string, bg: string, min: number, max?: number]> = [
  ["foreground", "background", 12, 16],
  ["foreground", "card", 12],
  ["foreground", "popover", 12],
  ["muted-foreground", "background", 4.5],
  ["muted-foreground", "card", 4.5],
  ["card-foreground", "card", 12],
  ["primary-foreground", "primary", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["destructive-foreground", "destructive", 4.5],
  ["success-foreground", "success", 4.5],
  ["warning-foreground", "warning", 4.5],
  ["sidebar-foreground", "sidebar", 12],
  ["sidebar-accent-foreground", "sidebar-accent", 4.5],
  ["destructive", "background", 4.5], // destructive used bare as text color
];

describe.each([
  ["light", root],
  ["dark", dark],
])("%s theme contrast", (_mode, map) => {
  it.each(pairs)("%s on %s clears its WCAG floor", (fg, bg, min, max) => {
    const ratio = contrastRatio(token(map, fg), token(map, bg));
    expect(ratio).toBeGreaterThanOrEqual(min);
    if (max) expect(ratio).toBeLessThanOrEqual(max);
  });

  it("--card is distinct from --background", () => {
    expect(token(map, "card")).not.toEqual(token(map, "background"));
  });

  it("--popover is distinct from --card", () => {
    expect(token(map, "popover")).not.toEqual(token(map, "card"));
  });

  it("--input is distinct from --border", () => {
    expect(token(map, "input")).not.toEqual(token(map, "border"));
  });

  it("--secondary, --muted and --accent are three distinct values", () => {
    const [secondary, muted, accent] = [
      token(map, "secondary"),
      token(map, "muted"),
      token(map, "accent"),
    ];
    expect(secondary).not.toEqual(muted);
    expect(muted).not.toEqual(accent);
    expect(secondary).not.toEqual(accent);
  });
});
