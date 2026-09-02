import { useSyncExternalStore } from "react";

import { store, type StoreState } from "@/store/store";

export function useStore(): StoreState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
