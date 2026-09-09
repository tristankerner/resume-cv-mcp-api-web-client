import { Fragment, useMemo, useState } from "react";
import {
  Decoration,
  Diff,
  Hunk,
  getCollapsedLinesCountBetween,
  markEdits,
  parseDiff,
  tokenize,
  useSourceExpansion,
  type ViewType,
} from "react-diff-view";
import "react-diff-view/style/index.css";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { prettyJson, type JsonValue } from "@/lib/documents/diff";
import { toUnifiedDiff } from "@/lib/documents/unifiedDiff";

// Below this width split columns are unusable — same breakpoint the rest of
// the app redefines `md:` to (src/index.css).
const MD_BREAKPOINT_QUERY = "(min-width: 45rem)";

function defaultViewType(): ViewType {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "split";
  return window.matchMedia(MD_BREAKPOINT_QUERY).matches ? "split" : "unified";
}

export function DocumentDiffView({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: JsonValue;
  right: JsonValue;
  leftLabel: string;
  rightLabel: string;
}) {
  const [viewType, setViewType] = useState<ViewType>(defaultViewType);

  const leftText = useMemo(() => prettyJson(left), [left]);

  const file = useMemo(() => {
    const patch = toUnifiedDiff(left, right, leftLabel, rightLabel);
    return parseDiff(patch)[0] ?? null;
  }, [left, right, leftLabel, rightLabel]);

  const [hunks, expandRange] = useSourceExpansion(file?.hunks ?? [], leftText);

  const tokens = useMemo(() => {
    if (hunks.length === 0) return undefined;
    return tokenize(hunks, { highlight: false, enhancers: [markEdits(hunks)] });
  }, [hunks]);

  if (!file || hunks.length === 0) {
    return <p className="text-sm text-muted-foreground">No differences.</p>;
  }

  return (
    <div className="space-y-3">
      <ToggleGroup
        type="single"
        variant="outline"
        value={viewType}
        onValueChange={(v) => v && setViewType(v as ViewType)}
      >
        <ToggleGroupItem value="split">Split</ToggleGroupItem>
        <ToggleGroupItem value="unified">Unified</ToggleGroupItem>
      </ToggleGroup>
      <div className="overflow-x-auto rounded-md border">
        <Diff viewType={viewType} diffType="modify" hunks={hunks} tokens={tokens}>
          {(renderedHunks) =>
            renderedHunks.map((hunk, i) => {
              const previousHunk = i > 0 ? renderedHunks[i - 1] : null;
              const gap = getCollapsedLinesCountBetween(previousHunk, hunk);
              return (
                <Fragment key={hunk.content}>
                  {gap > 0 && (
                    <Decoration>
                      <button
                        type="button"
                        className="w-full py-1 text-center text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        onClick={() =>
                          expandRange(
                            previousHunk ? previousHunk.oldStart + previousHunk.oldLines : 1,
                            hunk.oldStart,
                          )
                        }
                      >
                        Expand {gap} unchanged {gap === 1 ? "line" : "lines"}
                      </button>
                    </Decoration>
                  )}
                  <Hunk hunk={hunk} />
                </Fragment>
              );
            })
          }
        </Diff>
      </div>
    </div>
  );
}
