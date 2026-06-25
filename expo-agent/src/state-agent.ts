/**
 * Rexpo State Inspector Agent
 *
 * Streams the values held in your state-management stores (Redux, Zustand, or
 * anything else) to the desktop inspector in real time. View-only for now —
 * the wire format already carries a `canSet` flag so write-back can be added
 * without a protocol change.
 *
 * @example
 * ```ts
 * import { initStateAgent, attachZustandStore, attachReduxStore } from "rexpo-debugger";
 *
 * if (__DEV__) {
 *   initStateAgent();                       // auto-discovers the debugger
 *   attachZustandStore(useBearStore, { name: "bears" });
 *   attachReduxStore(store, { name: "app" });
 * }
 * ```
 */

import { discoverDebugger, resetDiscoveryCache } from "./discovery";

export type StateMessage = {
  type: "state";
  /** Stable id for this store across snapshots. */
  storeId: string;
  /** Human label shown in the UI. */
  name: string;
  /** Which adapter produced it — informational. */
  lib: "redux" | "zustand" | "custom";
  /** Serialized state tree (JSON-safe, with markers for non-JSON values). */
  state: any;
  /** Whether the store could accept write-back (reserved for a future release). */
  canSet: boolean;
  /** ISO timestamp of the snapshot. */
  at: string;
};

export type StoreAdapter = {
  /** Human label. Defaults to "store N". */
  name?: string;
  /** Returns the current state value. */
  getState: () => any;
  /** Subscribes to changes; returns an unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
  /** Optional writer — present means the store *could* be edited later. */
  setState?: (next: any) => void;
  /** Adapter origin, for display only. */
  lib?: "redux" | "zustand" | "custom";
};

export type StateAgentOptions = {
  /** WebSocket URL — e.g. "ws://192.168.1.100:5051". Omit to auto-discover. */
  wsUrl?: string;
  /** Enable/disable the agent (default: true). */
  enabled?: boolean;
  /** Verbose logging (default: false). */
  debug?: boolean;
  /** Auto-discovery timeout in ms (default: 10_000). */
  discoveryTimeoutMs?: number;
  /** Minimum gap between snapshots per store, in ms (default: 150). */
  throttleMs?: number;
};

// ─── Module state ──────────────────────────────────────────────────────────
let initialized = false;
let socket: WebSocket | null = null;
let debugMode = false;
let throttleMs = 150;

type RegisteredStore = {
  storeId: string;
  name: string;
  lib: "redux" | "zustand" | "custom";
  getState: () => any;
  setState?: (next: any) => void;
  unsubscribe: () => void;
};

const stores = new Map<string, RegisteredStore>();
let storeCounter = 0;

// ─── Reconnect state (mirrors console-agent) ────────────────────────────────
type ReconnectStrategy =
  | { mode: "manual"; wsUrl: string }
  | { mode: "auto"; discoveryTimeoutMs?: number };

let reconnectStrategy: ReconnectStrategy | null = null;
let reconnectAttempt = 0;
let reconnectTimer: any = null;
let stopped = false;

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 10_000;

function debugLog(...args: any[]) {
  if (debugMode) console.log("[StateAgent]", ...args);
}
function errorLog(...args: any[]) {
  console.error("[StateAgent]", ...args);
}

function computeReconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, RECONNECT_MAX_DELAY_MS);
}
function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}
function scheduleReconnect() {
  if (stopped || !reconnectStrategy) return;
  if (reconnectTimer !== null) return;
  const delay = computeReconnectDelay(reconnectAttempt);
  reconnectAttempt += 1;
  debugLog(`🔁 Will retry connection in ${delay}ms (attempt #${reconnectAttempt})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (stopped || !reconnectStrategy) return;
    establishConnection(reconnectStrategy).catch((err) => {
      errorLog("❌ Reconnect attempt failed:", err?.message || err);
    });
  }, delay);
}

async function establishConnection(strategy: ReconnectStrategy): Promise<void> {
  if (strategy.mode === "manual") {
    connectSocket(strategy.wsUrl);
    return;
  }
  debugLog("🔎 Re-discovering debugger via mDNS");
  resetDiscoveryCache();
  try {
    const service = await discoverDebugger({
      timeoutMs: strategy.discoveryTimeoutMs,
      debug: debugMode,
    });
    debugLog(`🎯 Discovered debugger: ${service.name} @ ${service.url}`);
    connectSocket(service.url);
  } catch (err) {
    errorLog("❌ Auto-discovery failed:", (err as Error)?.message || err);
    scheduleReconnect();
  }
}

function connectSocket(wsUrl: string) {
  try {
    debugLog("🔄 Connecting to inspector:", wsUrl);
    socket = new WebSocket(wsUrl);
    socket.onopen = () => {
      debugLog("✅ Connected to inspector:", wsUrl);
      reconnectAttempt = 0;
      clearReconnectTimer();
      // Re-announce every store so the freshly-connected desktop sees them.
      for (const store of stores.values()) sendSnapshot(store);
    };
    socket.onerror = (e) => errorLog("❌ WebSocket error:", e);
    socket.onclose = () => {
      debugLog("🔌 Disconnected from inspector");
      socket = null;
      scheduleReconnect();
    };
  } catch (error) {
    errorLog("❌ Failed to create WebSocket:", error);
    scheduleReconnect();
  }
}

// ─── Serialization ──────────────────────────────────────────────────────────
const MAX_DEPTH = 7;
const MAX_KEYS = 200;
const MAX_ARRAY = 200;
const MAX_STRING = 20_000;

/**
 * Serializes a state value into a JSON-safe shape. Non-JSON values (functions,
 * Map/Set, circular refs) become tagged markers the UI can render. Bounded in
 * depth, breadth, and string length so a huge store can't flood the socket.
 */
function serializeState(value: any, depth = 0, seen = new WeakSet()): any {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value === undefined) return { __rexpo: "undefined" };
  if (typeof value === "string") {
    return value.length > MAX_STRING
      ? value.slice(0, MAX_STRING) + `…(+${value.length - MAX_STRING} chars)`
      : value;
  }
  if (typeof value === "bigint") return { __rexpo: "bigint", value: value.toString() };
  if (typeof value === "symbol") return { __rexpo: "symbol", value: value.toString() };
  if (typeof value === "function") {
    return { __rexpo: "function", name: value.name || "anonymous" };
  }
  if (value instanceof Error) {
    return { __rexpo: "error", name: value.name, message: value.message };
  }
  if (value instanceof Date) {
    return { __rexpo: "date", value: value.toISOString() };
  }
  if (value instanceof RegExp) {
    return { __rexpo: "regexp", value: value.toString() };
  }

  if (typeof value === "object") {
    if (seen.has(value)) return { __rexpo: "circular" };
    if (depth >= MAX_DEPTH) return { __rexpo: "truncated" };
    seen.add(value);

    if (value instanceof Map) {
      const out: Record<string, any> = {};
      let i = 0;
      for (const [k, v] of value) {
        if (i++ >= MAX_KEYS) {
          out["…"] = { __rexpo: "truncated", more: value.size - MAX_KEYS };
          break;
        }
        out[String(k)] = serializeState(v, depth + 1, seen);
      }
      seen.delete(value);
      return { __rexpo: "map", entries: out };
    }
    if (value instanceof Set) {
      const arr = Array.from(value)
        .slice(0, MAX_ARRAY)
        .map((v) => serializeState(v, depth + 1, seen));
      seen.delete(value);
      return { __rexpo: "set", values: arr };
    }
    if (Array.isArray(value)) {
      const arr = value
        .slice(0, MAX_ARRAY)
        .map((v) => serializeState(v, depth + 1, seen));
      if (value.length > MAX_ARRAY) {
        arr.push({ __rexpo: "truncated", more: value.length - MAX_ARRAY });
      }
      seen.delete(value);
      return arr;
    }

    const out: Record<string, any> = {};
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length && i < MAX_KEYS; i++) {
      const k = keys[i];
      try {
        out[k] = serializeState(value[k], depth + 1, seen);
      } catch {
        out[k] = { __rexpo: "unserializable" };
      }
    }
    if (keys.length > MAX_KEYS) {
      out["…"] = { __rexpo: "truncated", more: keys.length - MAX_KEYS };
    }
    seen.delete(value);
    return out;
  }

  return String(value);
}

// ─── Snapshot sending (throttled per store) ─────────────────────────────────
const pending = new Set<string>();
let flushTimer: any = null;

function sendSnapshot(store: RegisteredStore) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  let serialized: any;
  try {
    serialized = serializeState(store.getState());
  } catch (err) {
    errorLog("Failed to serialize store", store.name, err);
    serialized = { __rexpo: "unserializable" };
  }
  const message: StateMessage = {
    type: "state",
    storeId: store.storeId,
    name: store.name,
    lib: store.lib,
    state: serialized,
    canSet: typeof store.setState === "function",
    at: new Date().toISOString(),
  };
  try {
    socket.send(JSON.stringify(message));
  } catch (err) {
    errorLog("❌ Send error:", err);
  }
}

function flushPending() {
  flushTimer = null;
  for (const storeId of pending) {
    const store = stores.get(storeId);
    if (store) sendSnapshot(store);
  }
  pending.clear();
}

function scheduleSnapshot(storeId: string) {
  pending.add(storeId);
  if (flushTimer !== null) return;
  flushTimer = setTimeout(flushPending, throttleMs);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function initStateAgent(options: StateAgentOptions = {}): void {
  // @ts-ignore — __DEV__ is injected by Expo/Metro
  if (typeof __DEV__ !== "undefined" && !__DEV__) return;

  if (initialized) {
    debugLog("Already initialized");
    return;
  }

  const {
    wsUrl,
    enabled = true,
    debug = false,
    discoveryTimeoutMs,
    throttleMs: throttle = 150,
  } = options;
  debugMode = debug;
  throttleMs = throttle;

  if (!enabled) {
    debugLog("Disabled by config");
    return;
  }

  initialized = true;
  stopped = false;
  reconnectStrategy = wsUrl
    ? { mode: "manual", wsUrl }
    : { mode: "auto", discoveryTimeoutMs };
  reconnectAttempt = 0;

  if (wsUrl) {
    connectSocket(wsUrl);
  } else {
    debugLog("🔎 No wsUrl — auto-discovering debugger via mDNS");
    discoverDebugger({ timeoutMs: discoveryTimeoutMs, debug: debugMode })
      .then((service) => {
        debugLog(`🎯 Discovered debugger: ${service.name} @ ${service.url}`);
        connectSocket(service.url);
      })
      .catch((err) => {
        errorLog("❌ Initial auto-discovery failed:", err?.message || err);
        scheduleReconnect();
      });
  }

  debugLog("🔍 State monitoring started");
}

/**
 * Attach any store via a generic adapter. Returns a detach function.
 */
function slugify(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "store"
  );
}

export function attachStore(adapter: StoreAdapter): () => void {
  if (!initialized) {
    debugLog("attachStore called before initStateAgent — call init first.");
  }
  const name = adapter.name?.trim() || `store ${storeCounter + 1}`;
  const lib = adapter.lib ?? "custom";
  // Stable id derived from the name, so a re-attach (Fast Refresh, remount,
  // reconnect) overwrites the existing entry instead of duplicating it.
  const storeId = adapter.name?.trim()
    ? `s:${slugify(adapter.name)}`
    : `store-${++storeCounter}`;

  // Replace any existing registration with the same id (unsubscribe the old).
  if (stores.has(storeId)) detachStore(storeId);

  const onChange = () => scheduleSnapshot(storeId);
  let unsubscribe = () => {};
  try {
    unsubscribe = adapter.subscribe(onChange) ?? (() => {});
  } catch (err) {
    errorLog("Failed to subscribe to store", name, err);
  }

  const registered: RegisteredStore = {
    storeId,
    name,
    lib,
    getState: adapter.getState,
    setState: adapter.setState,
    unsubscribe,
  };
  stores.set(storeId, registered);
  debugLog(`📦 Attached store "${name}" (${storeId})`);

  // Push an initial snapshot right away (no-op if socket isn't open yet — it'll
  // be re-announced on connect).
  sendSnapshot(registered);

  return () => detachStore(storeId);
}

function detachStore(storeId: string): void {
  const store = stores.get(storeId);
  if (!store) return;
  try {
    store.unsubscribe();
  } catch {
    /* ignore */
  }
  stores.delete(storeId);
  pending.delete(storeId);
  debugLog(`🗑 Detached store ${storeId}`);
}

/**
 * Attach a Redux store. View-only (`setState` is intentionally omitted —
 * write-back lands in a later release).
 */
export function attachReduxStore(
  store: { getState: () => any; subscribe: (l: () => void) => () => void },
  opts: { name?: string } = {}
): () => void {
  return attachStore({
    name: opts.name ?? "redux",
    lib: "redux",
    getState: () => store.getState(),
    subscribe: (l) => store.subscribe(l),
  });
}

/**
 * Attach a Zustand store. Pass the hook returned by `create(...)` — it carries
 * `.getState` / `.subscribe` / `.setState`.
 */
export function attachZustandStore(
  useStore: {
    getState: () => any;
    subscribe: (l: () => void) => () => void;
    setState?: (next: any) => void;
  },
  opts: { name?: string } = {}
): () => void {
  return attachStore({
    name: opts.name ?? "zustand",
    lib: "zustand",
    getState: () => useStore.getState(),
    subscribe: (l) => useStore.subscribe(l),
    // setState captured so canSet=true and write-back works once the UI ships.
    setState: useStore.setState
      ? (next) => useStore.setState!(next)
      : undefined,
  });
}

/** Detach all stores and close the socket. */
export function stopStateAgent(): void {
  stopped = true;
  clearReconnectTimer();
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  for (const id of Array.from(stores.keys())) detachStore(id);
  if (socket) {
    socket.close();
    socket = null;
  }
  initialized = false;
  debugLog("State monitoring stopped");
}
