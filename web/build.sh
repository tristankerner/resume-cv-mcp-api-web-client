#!/usr/bin/env bash
# Bundles client/index.html into a single self-contained file at
# client/dist/index.html: the three CDN imports (htm/preact,
# vanilla-jsoneditor, and qrcode-generator) are fetched, verified against
# the same integrity hashes the browser checks, and inlined by esbuild — so
# the result works offline and from file:// with no network access at all.
#
# Optional. client/index.html is always runnable as-is, straight off the
# pinned CDN — nobody has to install node to change a label. Run this only
# when a fully offline / single-file artifact is actually wanted.
#
# Usage:
#   web/build.sh
#
# Requires: node + npm, curl, and openssl on PATH. Installs esbuild locally
# on first run (client/node_modules/, gitignored) rather than requiring a
# global install.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if ! command -v npm >/dev/null 2>&1; then
  echo "build.sh needs node/npm on PATH. Install Node.js and re-run." >&2
  exit 1
fi

if [ ! -x node_modules/.bin/esbuild ]; then
  echo "Installing esbuild locally (client/node_modules/, gitignored)..."
  npm install --no-save --silent esbuild
fi

mkdir -p dist
WORKDIR=$(mktemp -d -t resume-api-client-build-XXXXXX)
trap 'rm -rf "$WORKDIR"' EXIT

# esbuild has no built-in fetcher for http(s) import specifiers — left
# alone, --bundle passes a `https://...` import straight through unresolved
# rather than inlining it, which would silently produce a "self-contained"
# file that still phones the CDN on every load. So each module is fetched
# and verified here, against the exact hash the <link rel="modulepreload">
# tags in index.html carry — one source of truth, so the build can't drift
# from what the browser itself checks.
declare -a URLS=()
declare -a PATHS=()
i=0
while IFS= read -r tag; do
  url=$(printf '%s' "$tag" | grep -o 'href="[^"]*"' | sed 's/^href="//;s/"$//')
  hash=$(printf '%s' "$tag" | grep -o 'integrity="sha384-[^"]*"' | sed 's/^integrity="sha384-//;s/"$//')
  out="$WORKDIR/vendor-$i.js"
  echo "Fetching $url ..."
  curl -fsSL "$url" -o "$out"
  actual=$(openssl dgst -sha384 -binary "$out" | openssl base64 -A)
  if [ "$actual" != "$hash" ]; then
    echo "Integrity check failed for $url:" >&2
    echo "  expected sha384-$hash" >&2
    echo "  got      sha384-$actual" >&2
    exit 1
  fi
  URLS+=("$url")
  PATHS+=("$out")
  i=$((i + 1))
done < <(grep -o '<link rel="modulepreload"[^>]*/>' index.html)

if [ "${#URLS[@]}" -eq 0 ]; then
  echo "No <link rel=\"modulepreload\"> tags found in index.html — nothing to vendor." >&2
  exit 1
fi

SCRIPT_START=$(grep -n '^<script type="module">$' index.html | head -1 | cut -d: -f1)
SCRIPT_END=$(grep -n '^</script>$' index.html | tail -1 | cut -d: -f1)
if [ -z "$SCRIPT_START" ] || [ -z "$SCRIPT_END" ]; then
  echo "Could not find the <script type=\"module\"> block in index.html." >&2
  exit 1
fi

ENTRY="$WORKDIR/entry.js"
sed -n "$((SCRIPT_START + 1)),$((SCRIPT_END - 1))p" index.html > "$ENTRY"

# Point the three remote imports at the verified local copies just fetched,
# so esbuild's bundler can actually inline them.
for idx in "${!URLS[@]}"; do
  esc_url=$(printf '%s\n' "${URLS[$idx]}" | sed 's/[&/\]/\\&/g')
  esc_path=$(printf '%s\n' "${PATHS[$idx]}" | sed 's/[&/\]/\\&/g')
  sed -i.bak "s/${esc_url}/${esc_path}/g" "$ENTRY" && rm -f "$ENTRY.bak"
done

BUNDLE="$WORKDIR/bundle.js"
node_modules/.bin/esbuild "$ENTRY" --bundle --format=esm --minify --outfile="$BUNDLE"

# Reassemble: everything before the module script, minus the two
# <link rel="modulepreload"> tags (dead weight once their imports are
# inlined — a stray fetch against a build that claims to work offline), the
# bundled script inline, then everything after.
{
  sed -n "1,${SCRIPT_START}p" index.html | grep -v '<link rel="modulepreload"'
  cat "$BUNDLE"
  sed -n "${SCRIPT_END},\$p" index.html
} > dist/index.html

SIZE=$(du -h dist/index.html | cut -f1)
echo "Built dist/index.html ($SIZE)."
