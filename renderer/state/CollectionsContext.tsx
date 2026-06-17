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
  /**
   * Explicit, first-class collection names. A collection listed here persists
   * even when it holds no requests — so creating an empty collection, or moving
   * the last request out of one, never makes it silently disappear.
   */
  collections: string[];
}

const initialState: CollectionsState = { savedRequests: [], collections: [] };

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
  /** Create an empty, first-class collection (no-op if it already exists). */
  createCollection: (name: string) => void;
  /** Rename a collection and re-tag every request that belonged to it. */
  renameCollection: (oldName: string, newName: string) => void;
  /**
   * Delete a collection. By default its requests are moved to Uncategorized;
   * pass { deleteRequests: true } to remove them as well.
   */
  deleteCollection: (name: string, opts?: { deleteRequests?: boolean }) => void;
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
    return {
      savedRequests: parsed.savedRequests as SavedRequest[],
      // Older payloads (pre first-class collections) have no `collections`
      // field — default to an empty list; existing buckets are still derived
      // from the saved requests themselves.
      collections: Array.isArray(parsed.collections)
        ? (parsed.collections as string[])
        : [],
    };
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

/**
 * Returns `collections` with `name` registered as a first-class bucket. Used
 * whenever a request is assigned to a collection so the bucket survives even
 * after that request is later moved or deleted. No-op for the Uncategorized
 * bucket and for names already present.
 */
function withCollection(
  collections: string[],
  name: string | undefined
): string[] {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === UNCATEGORIZED || collections.includes(trimmed)) {
    return collections;
  }
  return [...collections, trimmed];
}

function deriveCollectionNames(
  reqs: SavedRequest[],
  explicit: string[]
): string[] {
  const set = new Set<string>();
  // First-class collections always show, even when they hold no requests.
  for (const name of explicit) {
    const trimmed = name.trim();
    if (trimmed && trimmed !== UNCATEGORIZED) set.add(trimmed);
  }
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
        collections: withCollection(prev.collections, entry.collectionName),
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
        collections:
          "collectionName" in patch
            ? withCollection(prev.collections, patch.collectionName)
            : prev.collections,
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
        collections: withCollection(prev.collections, normalized),
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

  const createCollection = useCallback<
    CollectionsContextValue["createCollection"]
  >((name) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === UNCATEGORIZED) return;
    setState((prev) =>
      prev.collections.includes(trimmed)
        ? prev
        : { ...prev, collections: [...prev.collections, trimmed] }
    );
  }, []);

  const renameCollection = useCallback<
    CollectionsContextValue["renameCollection"]
  >((oldName, newName) => {
    const from = oldName.trim();
    const to = newName.trim();
    if (!from || !to || from === to) return;
    if (from === UNCATEGORIZED || to === UNCATEGORIZED) return;
    setState((prev) => {
      const collections = Array.from(
        new Set(
          prev.collections.map((c) => (c === from ? to : c)).concat(to)
        )
      ).filter((c) => c !== UNCATEGORIZED);
      const now = new Date().toISOString();
      const savedRequests = prev.savedRequests.map((r) =>
        (r.collectionName?.trim() || UNCATEGORIZED) === from
          ? { ...r, collectionName: to, updatedAt: now }
          : r
      );
      return { collections, savedRequests };
    });
  }, []);

  const deleteCollection = useCallback<
    CollectionsContextValue["deleteCollection"]
  >((name, opts) => {
    const target = name.trim();
    if (!target || target === UNCATEGORIZED) return;
    setState((prev) => {
      const collections = prev.collections.filter((c) => c !== target);
      const inCollection = (r: SavedRequest) =>
        (r.collectionName?.trim() || UNCATEGORIZED) === target;
      const now = new Date().toISOString();
      const savedRequests = opts?.deleteRequests
        ? prev.savedRequests.filter((r) => !inCollection(r))
        : prev.savedRequests.map((r) =>
            inCollection(r)
              ? { ...r, collectionName: undefined, updatedAt: now }
              : r
          );
      return { collections, savedRequests };
    });
  }, []);

  const collectionNames = useMemo(
    () => deriveCollectionNames(state.savedRequests, state.collections),
    [state.savedRequests, state.collections]
  );

  const value = useMemo<CollectionsContextValue>(
    () => ({
      state,
      saveRequest,
      updateRequest,
      deleteRequest,
      moveRequest,
      createCollection,
      renameCollection,
      deleteCollection,
      collectionNames,
    }),
    [
      state,
      saveRequest,
      updateRequest,
      deleteRequest,
      moveRequest,
      createCollection,
      renameCollection,
      deleteCollection,
      collectionNames,
    ]
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
