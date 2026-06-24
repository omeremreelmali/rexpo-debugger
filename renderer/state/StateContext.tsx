import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface StoreSnapshot {
  storeId: string;
  name: string;
  lib: "redux" | "zustand" | "custom";
  state: any;
  canSet: boolean;
  at: string;
}

interface StateContextValue {
  stores: StoreSnapshot[];
  clear: () => void;
}

const StateCtx = createContext<StateContextValue | null>(null);

/**
 * Receives state-store snapshots pushed by the agent (on the dedicated
 * "state-message" IPC channel) and keeps the latest snapshot per store.
 */
export function StateProvider({ children }: { children: ReactNode }) {
  const [storesMap, setStoresMap] = useState<Map<string, StoreSnapshot>>(
    () => new Map()
  );

  useEffect(() => {
    if (!window.electron?.onStateMessage) return;
    window.electron.onStateMessage((msg: StoreSnapshot & { type: string }) => {
      setStoresMap((prev) => {
        const next = new Map(prev);
        next.set(msg.storeId, {
          storeId: msg.storeId,
          name: msg.name,
          lib: msg.lib,
          state: msg.state,
          canSet: msg.canSet,
          at: msg.at,
        });
        return next;
      });
    });
    return () => window.electron?.removeStateMessageListener?.();
  }, []);

  const clear = useCallback(() => setStoresMap(new Map()), []);

  const stores = useMemo(
    () =>
      Array.from(storesMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [storesMap]
  );

  const value = useMemo<StateContextValue>(
    () => ({ stores, clear }),
    [stores, clear]
  );

  return <StateCtx.Provider value={value}>{children}</StateCtx.Provider>;
}

export function useStores(): StateContextValue {
  const ctx = useContext(StateCtx);
  if (!ctx) throw new Error("useStores must be used inside <StateProvider>");
  return ctx;
}
