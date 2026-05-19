import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "rexpo-debugger-collections";

export interface SavedRequest {
  id: string;
  /** Human label. Optional — UI shows "<METHOD> <path>" when missing. */
  name?: string;
  /** Collection / project name. Optional — null bucket = "Uncategorized". */
  collectionName?: string;
  /** Free-form tags for filtering. Optional. */
  tags?: string[];
  /** Free-form description. Optional. */
  description?: string;

  // Captured request payload — these are the fields needed to replay it.
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;

  createdAt: string;
  updatedAt?: string;
}

interface CollectionsState {
  savedRequests: SavedRequest[];
}

const initialState: CollectionsState = { savedRequests: [] };

interface CollectionsContextValue {
  state: CollectionsState;
  /** Returns the newly-created SavedRequest's id. */
  saveRequest: (req: Omit<SavedRequest, "id" | "createdAt">) => string;
  updateRequest: (
    id: string,
    patch: Partial<Omit<SavedRequest, "id" | "createdAt">>
  ) => void;
  deleteRequest: (id: string) => void;
  moveRequest: (id: string, newCollectionName: string | undefined) => void;
  /** Distinct collection names currently in use, sorted, with "Uncategorized" last. */
  collectionNames: string[];
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null);

function loadState(): CollectionsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.savedRequests)) return initialState;
    return parsed as CollectionsState;
  } catch {
    return initialState;
  }
}

function persist(state: CollectionsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("[Collections] Failed to persist:", err);
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

const UNCATEGORIZED = "Uncategorized";

function deriveCollectionNames(reqs: SavedRequest[]): string[] {
  const set = new Set<string>();
  for (const r of reqs) {
    set.add(r.collectionName?.trim() || UNCATEGORIZED);
  }
  const all = Array.from(set).sort((a, b) => a.localeCompare(b));
  // Always keep Uncategorized at the end.
  return [
    ...all.filter((n) => n !== UNCATEGORIZED),
    ...(all.includes(UNCATEGORIZED) ? [UNCATEGORIZED] : []),
  ];
}

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CollectionsState>(() => loadState());

  useEffect(() => {
    persist(state);
  }, [state]);

  const saveRequest = useCallback<CollectionsContextValue["saveRequest"]>(
    (req) => {
      const id = newId();
      const entry: SavedRequest = {
        ...req,
        id,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        savedRequests: [entry, ...prev.savedRequests],
      }));
      return id;
    },
    []
  );

  const updateRequest = useCallback<CollectionsContextValue["updateRequest"]>(
    (id, patch) => {
      setState((prev) => ({
        ...prev,
        savedRequests: prev.savedRequests.map((r) =>
          r.id === id
            ? { ...r, ...patch, updatedAt: new Date().toISOString() }
            : r
        ),
      }));
    },
    []
  );

  const deleteRequest = useCallback<CollectionsContextValue["deleteRequest"]>(
    (id) => {
      setState((prev) => ({
        ...prev,
        savedRequests: prev.savedRequests.filter((r) => r.id !== id),
      }));
    },
    []
  );

  const moveRequest = useCallback<CollectionsContextValue["moveRequest"]>(
    (id, newCollectionName) => {
      const normalized = newCollectionName?.trim() || undefined;
      setState((prev) => ({
        ...prev,
        savedRequests: prev.savedRequests.map((r) =>
          r.id === id
            ? {
                ...r,
                collectionName: normalized,
                updatedAt: new Date().toISOString(),
              }
            : r
        ),
      }));
    },
    []
  );

  const collectionNames = useMemo(
    () => deriveCollectionNames(state.savedRequests),
    [state.savedRequests]
  );

  const value = useMemo<CollectionsContextValue>(
    () => ({
      state,
      saveRequest,
      updateRequest,
      deleteRequest,
      moveRequest,
      collectionNames,
    }),
    [state, saveRequest, updateRequest, deleteRequest, moveRequest, collectionNames]
  );

  return (
    <CollectionsContext.Provider value={value}>
      {children}
    </CollectionsContext.Provider>
  );
}

export function useCollections(): CollectionsContextValue {
  const ctx = useContext(CollectionsContext);
  if (!ctx) {
    throw new Error("useCollections must be used inside <CollectionsProvider>");
  }
  return ctx;
}

/** Bucket key used when no collection name is set. Exported so UI can label it. */
export const UNCATEGORIZED_BUCKET = UNCATEGORIZED;

/** Convenience: a display label for a saved request when no name was given. */
export function defaultRequestLabel(req: SavedRequest): string {
  if (req.name && req.name.trim()) return req.name.trim();
  try {
    const u = new URL(req.url);
    return `${req.method.toUpperCase()} ${u.pathname}${u.search}`;
  } catch {
    return `${req.method.toUpperCase()} ${req.url}`;
  }
}
