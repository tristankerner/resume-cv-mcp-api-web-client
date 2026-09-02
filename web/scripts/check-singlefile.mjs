// Fails the build if dist/index.html is not actually self-contained. This is
// the property the deploy repo depends on — GET /client serves this file
// with no script-src CSP, so nothing external can be fetched, and it must
// work from file:// with no network at all. A plugin upgrade (vite,
// vite-plugin-singlefile, @tailwindcss/vite) could silently stop inlining
// something; this is what would catch it.
//
// Only the HTML shell is checked, not the inlined <script>/<style> bodies:
// those are minified JS/CSS source text and may legitimately contain the
// substring "https://" (a help link rendered in the UI, a comment, a data:
// URI builder) without the page ever fetching it. What matters is that no
// *tag* in the shell points off-page — a stray <script src="https://...">
// or <link rel="stylesheet" href="https://...">.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const distIndex = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist/index.html",
);

const html = readFileSync(distIndex, "utf8");

const problems = [];

// Every opening tag in the document, in order, with its content up to the
// next tag — good enough for this file's flat, generated structure (no
// nested <script>/<style>). Attributes on the tag itself are always
// checked; the tag's text content is skipped for script/style, since that
// content is opaque JS/CSS source, not markup.
const tagPattern = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
let match;
while ((match = tagPattern.exec(html))) {
  const [tag, name, attrs] = match;
  for (const attrMatch of attrs.matchAll(/\b(?:src|href)\s*=\s*"([^"]*)"/gi)) {
    const value = attrMatch[1];
    if (value === "" || value.startsWith("#") || value.startsWith("data:")) continue;
    problems.push(`<${name}> has an external reference: ${attrMatch[0]}`);
  }

  const lowerName = name.toLowerCase();
  if (lowerName === "script" || lowerName === "style") {
    const closeTag = `</${lowerName}>`;
    const closeIndex = html.indexOf(closeTag, tagPattern.lastIndex);
    if (closeIndex === -1) {
      problems.push(`<${name}> is never closed`);
      break;
    }
    tagPattern.lastIndex = closeIndex + closeTag.length;
  }
}

if (problems.length > 0) {
  console.error(`dist/index.html is not self-contained:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}

console.log("dist/index.html is self-contained (no external src/href in the HTML shell).");
