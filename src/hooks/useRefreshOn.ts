import { useEffect, useRef } from "react";

import { changed, type Resource } from "@/store/refresh";
import { useStore } from "@/store/useStore";

/**
 * Re-runs `onRefresh` when any of `resources` is invalidated. Deliberately
 * does NOT run on mount: every view already loads itself in a mount effect,
 * and firing here too would double every initial fetch.
 */
export function useRefreshOn(resources: readonly Resource[], onRefresh: () => void): void {
  const { revisions } = useStore();
  const seenRef = useRef(revisions);
  const resourcesRef = useRef(resources);
  resourcesRef.current = resources;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (changed(seenRef.current, revisions, resourcesRef.current)) {
      seenRef.current = revisions;
      onRefreshRef.current();
    } else {
      seenRef.current = revisions;
    }
  }, [revisions]);
}
