import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface StateSnapshot {
  /** Serialized state at this point in time. */
  state: any;
  /** ISO timestamp of this snapshot. */
  at: string;
}

export interface StoreEntry {
  storeId: string;
  name: string;
  lib: "redux" | "zustand" | "custom";
  canSet: boolean;
  /** Latest state value. */
  current: any;
  /** Latest snapshot timestamp. */
  at: string;
  /** Snapshot history, newest first (includes current), capped. */
  history: StateSnapshot[];
}

/** Max snapshots kept per store before the oldest are dropped. */
const HISTORY_MAX = 100;

interface StateContextValue {
  stores: StoreEntry[];
  clear: () => void;
}

const StateCtx = createContext<StateContextValue | null>(null);

function sameState(a: any, b: any): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Receives state-store snapshots pushed by the agent (on the dedicated
 * "state-message" IPC channel), keyed by stable storeId. Keeps a bounded
 * per-store history so the UI can scrub back through past values.
 */
export function StateProvider({ children }: { children: ReactNode }) {
  const [storesMap, setStoresMap] = useState<Map<string, StoreEntry>>(
    () => new Map()
  );

  useEffect(() => {
    if (!window.electron?.onStateMessage) return;
    window.electron.onStateMessage(
      (msg: {
        storeId: string;
        name: string;
        lib: StoreEntry["lib"];
        state: any;
        canSet: boolean;
        at: string;
      }) => {
        setStoresMap((prev) => {
          const next = new Map(prev);
          const existing = next.get(msg.storeId);
          if (!existing) {
            next.set(msg.storeId, {
              storeId: msg.storeId,
              name: msg.name,
              lib: msg.lib,
              canSet: msg.canSet,
              current: msg.state,
              at: msg.at,
              history: [{ state: msg.state, at: msg.at }],
            });
            return next;
          }
          // Skip no-op snapshots (e.g. the re-announce on reconnect) so the
          // history only records actual changes.
          if (sameState(existing.current, msg.state)) {
            next.set(msg.storeId, {
              ...existing,
              name: msg.name,
              lib: msg.lib,
              canSet: msg.canSet,
            });
            return next;
          }
          const history = [
            { state: msg.state, at: msg.at },
            ...existing.history,
          ].slice(0, HISTORY_MAX);
          next.set(msg.storeId, {
            ...existing,
            name: msg.name,
            lib: msg.lib,
            canSet: msg.canSet,
            current: msg.state,
            at: msg.at,
            history,
          });
          return next;
        });
      }
    );
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
