// Structural revision diff — walks both JSON trees to a flat map of
// path -> value and emits added/removed/changed paths, in the
// `section.field[index].field` notation the metadata and skill documents
// already use for paths. No diff library: this is deliberately small.

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type DiffRow =
  | { path: string; kind: "added"; left: undefined; right: JsonValue }
  | { path: string; kind: "removed"; left: JsonValue; right: undefined }
  | { path: string; kind: "changed"; left: JsonValue; right: JsonValue };

function flattenForDiff(value: JsonValue, path: string, out: Record<string, JsonValue>): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out[path] = [];
      return;
    }
    value.forEach((item, i) => flattenForDiff(item, `${path}[${i}]`, out));
  } else if (value !== null && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      out[path] = {};
      return;
    }
    for (const key of keys) flattenForDiff(value[key], path ? `${path}.${key}` : key, out);
  } else {
    out[path] = value;
  }
}

export function diffDocuments(left: JsonValue, right: JsonValue): DiffRow[] {
  const leftFlat: Record<string, JsonValue> = {};
  flattenForDiff(left, "", leftFlat);
  const rightFlat: Record<string, JsonValue> = {};
  flattenForDiff(right, "", rightFlat);
  const paths = new Set([...Object.keys(leftFlat), ...Object.keys(rightFlat)]);
  const rows: DiffRow[] = [];
  for (const path of paths) {
    const hasLeft = Object.hasOwn(leftFlat, path);
    const hasRight = Object.hasOwn(rightFlat, path);
    const lv = leftFlat[path];
    const rv = rightFlat[path];
    if (!hasLeft) rows.push({ path, kind: "added", left: undefined, right: rv });
    else if (!hasRight) rows.push({ path, kind: "removed", left: lv, right: undefined });
    else if (JSON.stringify(lv) !== JSON.stringify(rv)) {
      rows.push({ path, kind: "changed", left: lv, right: rv });
    }
  }
  rows.sort((a, b) => a.path.localeCompare(b.path));
  return rows;
}

export function sectionOf(path: string): string {
  const match = path.match(/^[^.[]+/);
  return match ? match[0] : path;
}

export function sortKeysDeep(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeysDeep(value[k])]),
    );
  }
  return value;
}

export function prettyJson(value: JsonValue | undefined): string {
  return value === undefined ? "" : JSON.stringify(sortKeysDeep(value), null, 2);
}
