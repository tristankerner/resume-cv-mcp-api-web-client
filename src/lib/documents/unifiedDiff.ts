import { FILE_HEADERS_ONLY, createTwoFilesPatch } from "diff";

import { prettyJson, type JsonValue } from "@/lib/documents/diff";

// JsonValue -> prettyJson (stable key order, so the line diff isn't noise
// from key reordering) -> a unified diff string. react-diff-view's
// parseDiff (via gitdiff-parser) turns this into hunks for rendering; that
// step lives in the component since it isn't pure (react-diff-view owns the
// hunk shape).
export function toUnifiedDiff(
  left: JsonValue,
  right: JsonValue,
  leftLabel: string,
  rightLabel: string,
  context = 3,
): string {
  const leftText = prettyJson(left);
  const rightText = prettyJson(right);
  // FILE_HEADERS_ONLY drops the `===...` underline jsdiff normally prepends
  // — react-diff-view's parseDiff expects the file headers (`--- `/`+++ `)
  // as the first two lines, and chokes on that underline sitting above them.
  return createTwoFilesPatch(leftLabel, rightLabel, leftText, rightText, undefined, undefined, {
    context,
    headerOptions: FILE_HEADERS_ONLY,
  });
}
