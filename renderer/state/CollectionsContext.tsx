import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToast } from "../components/Toast";
import { FormDataPart } from "../types";

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
  /**
   * Multipart parts, when the request was `multipart/form-data`. Replaying
   * these re-reads each file on the device from its local uri, so a saved
   * upload only replays while that file still exists there.
   */
  formParts?: FormDataPart[];

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

/** Why the stored collections could not be loaded as they were. */
type LoadProblem =
  | { kind: "unreadable"; backupKey: string | null }
  | { kind: "repaired"; dropped: number; backupKey: string | null };

interface LoadResult {
  state: CollectionsState;
  problem?: LoadProblem;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const optionalString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

/**
 * Copies the stored payload aside before anything replaces it, so a payload we
 * could not read in full can still be recovered by hand. Returns the key it
 * went to, or null when even that failed (storage full).
 */
function backupRaw(raw: string): string | null {
  const key = `${STORAGE_KEY}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  try {
    localStorage.setItem(key, raw);
    return key;
  } catch {
    return null;
  }
}

/**
 * Rebuilds one stored entry with the types the UI relies on. Entries written by
 * this app always pass; a hand-edited or damaged one would otherwise crash
 * rendering on every launch. Returns null when there is nothing to replay.
 */
function sanitizeEntry(value: unknown): SavedRequest | null {
  if (!isPlainObject(value)) return null;
  const { method, url } = value;
  if (typeof method !== "string" || !method.trim() || typeof url !== "string") return null;

  const headers = isPlainObject(value.headers)
    ? Object.fromEntries(
        Object.entries(value.headers)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      )
    : undefined;
  const tags = Array.isArray(value.tags)
    ? value.tags.filter((t): t is string => typeof t === "string")
    : undefined;
  const formParts = Array.isArray(value.formParts)
    ? (value.formParts.filter(
        (p) => isPlainObject(p) && typeof p.name === "string" && (p.kind === "file" || p.kind === "text")
      ) as unknown as FormDataPart[])
    : undefined;

  return {
    id: typeof value.id === "string" && value.id ? value.id : newId(),
    name: optionalString(value.name),
    collectionName: optionalString(value.collectionName),
    tags,
    description: optionalString(value.description),
    method,
    url,
    headers,
    body: optionalString(value.body),
    formParts,
    createdAt: optionalString(value.createdAt) ?? new Date().toISOString(),
    updatedAt: optionalString(value.updatedAt),
  };
}

function loadState(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { state: initialState };
  }
  if (!raw) return { state: initialState };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (!isPlainObject(parsed) || !Array.isArray(parsed.savedRequests)) {
    return { state: initialState, problem: { kind: "unreadable", backupKey: backupRaw(raw) } };
  }

  const seen = new Set<string>();
  const savedRequests: SavedRequest[] = [];
  for (const entry of parsed.savedRequests) {
    const clean = sanitizeEntry(entry);
    if (!clean) continue;
    // Duplicate ids would make edits and deletes hit the wrong entry.
    if (seen.has(clean.id)) clean.id = newId();
    seen.add(clean.id);
    savedRequests.push(clean);
  }
  // Older payloads (pre first-class collections) have no `collections` field;
  // existing buckets are still derived from the saved requests themselves.
  const collections = Array.isArray(parsed.collections)
    ? parsed.collections.filter((c): c is string => typeof c === "string")
    : [];

  const dropped = parsed.savedRequests.length - savedRequests.length;
  const state = { savedRequests, collections };
  if (dropped > 0) {
    return { state, problem: { kind: "repaired", dropped, backupKey: backupRaw(raw) } };
  }
  return { state };
}

function persist(state: CollectionsState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn("[Collections] Failed to persist:", err);
    return false;
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
  // `show` is stable; the context object itself changes with every toast.
  const { show: showToast } = useToast();
  const [loaded] = useState<LoadResult>(() => loadState());
  const [state, setState] = useState<CollectionsState>(loaded.state);
  // The loaded state is what storage already holds, so it is not written back.
  // That way a payload we could not read stays where it is until the user
  // actually changes something (and by then it has been backed up).
  const persistFailed = useRef(false);
  const problemReported = useRef(false);

  useEffect(() => {
    const problem = loaded.problem;
    if (!problem || problemReported.current) return;
    problemReported.current = true;
    const where = problem.backupKey
      ? ` A copy was kept in local storage as "${problem.backupKey}".`
      : " It could not be backed up, so it is left untouched until you change a collection.";
    const message =
      problem.kind === "unreadable"
        ? `Saved collections could not be read.${where}`
        : `${problem.dropped} damaged saved request${problem.dropped === 1 ? " was" : "s were"} skipped.${where}`;
    console.warn("[Collections]", message);
    showToast(message, "error", 9000);
  }, [loaded, showToast]);

  useEffect(() => {
    if (state === loaded.state) return;
    const ok = persist(state);
    // Say so once per run of failures; a toast per keystroke would be noise.
    if (!ok && !persistFailed.current) {
      showToast(
        "Could not save collections: local storage is full or unavailable. Recent changes will be lost when the app closes.",
        "error",
        9000
      );
    }
    persistFailed.current = !ok;
  }, [state, loaded, showToast]);

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
