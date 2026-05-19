/**
 * Rexpo Console Inspector Agent
 *
 * Console log yakalama ve inspector'a gönderme işlemlerini yönetir.
 * Tüm console metodlarını (log, warn, error, info, debug) override eder.
 *
 * @example
 * ```ts
 * import { initConsoleAgent } from "./debug/console-agent";
 *
 * if (__DEV__) {
 *   initConsoleAgent({
 *     wsUrl: "ws://192.168.1.100:5051",
 *     enabled: true,
 *   });
 * }
 * ```
 */

export type LogLevel = "log" | "warn" | "error" | "info" | "debug";

export type ConsoleMessage = {
  type: "console";
  id: string;
  level: LogLevel;
  args: any[];
  timestamp: string;
  stack?: string;
};

import { discoverDebugger, resetDiscoveryCache } from "./discovery";

export type ConsoleAgentOptions = {
  /**
   * WebSocket URL — e.g. "ws://192.168.1.100:5051".
   * If omitted, the agent will auto-discover the debugger via mDNS.
   */
  wsUrl?: string;
  /** Enable/disable the agent (default: true) */
  enabled?: boolean;
  /** Enable detailed logging (default: false) */
  debug?: boolean;
  /** Capture stack traces for errors (default: true) */
  captureStackTrace?: boolean;
  /** Auto-discovery timeout in milliseconds (default: 10_000) */
  discoveryTimeoutMs?: number;
};

let initialized = false;
let socket: WebSocket | null = null;
let debugMode = false;
let captureStackTrace = true;

// ─── Reconnect state ──────────────────────────────────────────────────────
type ReconnectStrategy =
  | { mode: "manual"; wsUrl: string }
  | { mode: "auto"; discoveryTimeoutMs?: number };

let reconnectStrategy: ReconnectStrategy | null = null;
let reconnectAttempt = 0;
let reconnectTimer: any = null;
let stopped = false;

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 10_000;

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

// Original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

/**
 * Debug log helper - only logs in debug mode
 */
function debugLog(...args: any[]) {
  if (debugMode) {
    originalConsole.log("[ConsoleAgent]", ...args);
  }
}

/**
 * Error log helper - always logs (critical errors)
 */
function errorLog(...args: any[]) {
  originalConsole.error("[ConsoleAgent]", ...args);
}

/**
 * Initializes the console agent and overrides console methods
 */
function connectSocket(wsUrl: string) {
  try {
    debugLog("🔄 Connecting to inspector:", wsUrl);
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      debugLog("✅ Connected to inspector:", wsUrl);
      // Successful connect — reset backoff for the next disconnect.
      reconnectAttempt = 0;
      clearReconnectTimer();
    };

    socket.onerror = (e) => {
      errorLog("❌ WebSocket error:", e);
    };

    socket.onclose = (_e) => {
      debugLog("🔌 Disconnected from inspector");
      socket = null;
      // Auto-reconnect — same strategy as initial connect.
      scheduleReconnect();
    };
  } catch (error) {
    errorLog("❌ Failed to create WebSocket:", error);
    scheduleReconnect();
  }
}

export function initConsoleAgent(options: ConsoleAgentOptions = {}) {
  // @ts-ignore - __DEV__ is defined globally by Expo
  if (typeof __DEV__ !== "undefined" && !__DEV__) {
    return;
  }

  if (initialized) {
    debugLog("Already initialized");
    return;
  }

  const {
    wsUrl,
    enabled = true,
    debug = false,
    captureStackTrace: capture = true,
    discoveryTimeoutMs,
  } = options;
  debugMode = debug;
  captureStackTrace = capture;

  if (!enabled) {
    debugLog("Disabled by config");
    return;
  }

  initialized = true;
  stopped = false;

  // Remember how we connected so the reconnect timer can repeat the same path.
  reconnectStrategy = wsUrl
    ? { mode: "manual", wsUrl }
    : { mode: "auto", discoveryTimeoutMs };
  reconnectAttempt = 0;

  if (wsUrl) {
    connectSocket(wsUrl);
  } else {
    // Initial discovery: plain call so the in-flight promise is shared with
    // the Network agent if it started at the same time. Only the reconnect
    // path needs to invalidate the cache.
    debugLog("🔎 No wsUrl provided — auto-discovering debugger via mDNS");
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

  // Override console methods
  overrideConsoleMethod("log");
  overrideConsoleMethod("warn");
  overrideConsoleMethod("error");
  overrideConsoleMethod("info");
  overrideConsoleMethod("debug");

  debugLog("🔍 Console monitoring started");
}

/**
 * Override a specific console method
 */
function overrideConsoleMethod(level: LogLevel) {
  const original = originalConsole[level];

  (console as any)[level] = (...args: any[]) => {
    // Call original console method first
    original.apply(console, args);

    // Send to inspector
    try {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const timestamp = new Date().toISOString();

      // Serialize arguments
      const serializedArgs = args.map((arg) => serializeArgument(arg));

      // Capture stack trace for errors
      let stack: string | undefined;
      if (captureStackTrace && (level === "error" || level === "warn")) {
        stack = captureStack();
      }

      const message: ConsoleMessage = {
        type: "console",
        id,
        level,
        args: serializedArgs,
        timestamp,
        stack,
      };

      safeSend(socket, message);
    } catch (err) {
      errorLog("Failed to send console message:", err);
    }
  };
}

/**
 * Serialize console arguments for transmission
 */
function serializeArgument(arg: any): any {
  try {
    // Handle primitives
    if (
      arg === null ||
      arg === undefined ||
      typeof arg === "string" ||
      typeof arg === "number" ||
      typeof arg === "boolean"
    ) {
      return arg;
    }

    // Handle Error objects
    if (arg instanceof Error) {
      return {
        __type: "Error",
        name: arg.name,
        message: arg.message,
        stack: arg.stack,
      };
    }

    // Handle Date objects
    if (arg instanceof Date) {
      return {
        __type: "Date",
        value: arg.toISOString(),
      };
    }

    // Handle RegExp objects
    if (arg instanceof RegExp) {
      return {
        __type: "RegExp",
        value: arg.toString(),
      };
    }

    // Handle Arrays
    if (Array.isArray(arg)) {
      return arg.map((item) => serializeArgument(item));
    }

    // Handle plain objects
    if (typeof arg === "object") {
      // Avoid circular references
      const seen = new WeakSet();
      return JSON.parse(
        JSON.stringify(arg, (key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              return "[Circular]";
            }
            seen.add(value);
          }
          return value;
        })
      );
    }

    // Handle functions
    if (typeof arg === "function") {
      return {
        __type: "Function",
        name: arg.name || "anonymous",
        value: arg.toString().substring(0, 100) + "...",
      };
    }

    // Fallback
    return String(arg);
  } catch (err) {
    return "[Unserializable]";
  }
}

/**
 * Capture stack trace
 */
function captureStack(): string | undefined {
  try {
    const error = new Error();
    if (error.stack) {
      // Remove the first few lines (this function and the console override)
      const lines = error.stack.split("\n");
      return lines.slice(3).join("\n");
    }
  } catch (err) {
    return undefined;
  }
}

/**
 * Safe message sending over WebSocket
 */
function safeSend(ws: WebSocket | null, payload: ConsoleMessage) {
  if (!ws) {
    return;
  }

  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }

  try {
    const message = JSON.stringify(payload);
    ws.send(message);
  } catch (e) {
    errorLog("❌ Send error:", e);
  }
}

/**
 * Restore original console methods (for cleanup)
 */
export function restoreConsole() {
  if (!initialized) {
    return;
  }

  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;

  if (socket) {
    socket.close();
    socket = null;
  }

  initialized = false;
  debugLog("Console monitoring stopped");
}

