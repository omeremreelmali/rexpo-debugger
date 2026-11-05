/**
 * Rexpo Network Inspector Agent
 *
 * Copy this file to your Expo project and call the initNetworkAgent() function in __DEV__ mode.
 * All fetch requests will be automatically captured and sent to the inspector application.
 *
 * @example
 * ```ts
 * import { initNetworkAgent } from "./debug/expoNetworkAgent";
 *
 * if (__DEV__) {
 *   initNetworkAgent({
 *     wsUrl: "ws://192.168.1.100:5051", // Your computer's local IP address
 *     enabled: true,
 *   });
 * }
 * ```
 */

/**
 * A single `multipart/form-data` part. File parts never carry their bytes —
 * only the metadata the app handed to `FormData.append()` (name, mime type,
 * size and, on React Native, the local `file://` uri).
 */
export type FormDataPart = {
  /** Field name, i.e. the first argument of `FormData.append()` */
  name: string;
  /** "file" when the part carries a file/blob, "text" for plain values */
  kind: "file" | "text";
  /** Plain value — only for `kind: "text"` (truncated) */
  value?: string;
  /** Original file name, e.g. "avatar.jpg" */
  fileName?: string;
  /** Content type of the part, e.g. "image/jpeg" */
  mimeType?: string;
  /** Size in bytes, when the platform exposes it */
  size?: number;
  /** Device-local uri, e.g. "file:///var/mobile/.../avatar.jpg" */
  uri?: string;
};

type NetworkMessage =
  | {
      type: "request";
      id: string;
      url: string;
      method: string;
      requestHeaders?: Record<string, string>;
      requestBodySnippet?: string;
      /** "formdata" when the body was multipart — see `requestFormParts` */
      requestBodyKind?: "formdata";
      requestFormParts?: FormDataPart[];
      startedAt: string;
    }
  | {
      type: "response";
      id: string;
      url: string;
      status: number;
      statusText?: string;
      responseHeaders?: Record<string, string>;
      responseBodySnippet?: string;
      durationMs: number;
      finishedAt: string;
      isError: boolean;
      errorMessage?: string;
    };

export type InitOptions = {
  /**
   * WebSocket URL — e.g. "ws://192.168.1.100:5051".
   * If omitted, the agent will try to auto-discover the debugger over mDNS.
   * Auto-discovery requires `react-native-zeroconf` to be installed and the
   * app to be running as a dev build (Expo Go is not supported).
   */
  wsUrl?: string;
  /** Enable/disable the agent (default: true) */
  enabled?: boolean;
  /** Maximum body snippet length (default: 3000) */
  maxBodyLength?: number;
  /** Enable detailed logging (default: false) */
  debug?: boolean;
  /** Auto-discovery timeout in milliseconds (default: 10_000) */
  discoveryTimeoutMs?: number;
};

import { discoverDebugger, resetDiscoveryCache, withAgentKind } from "./discovery";

let initialized = false;
let socket: WebSocket | null = null;
let healthCheckInterval: any = null;
let maxBodyLength = Infinity;
let debugMode = false;
let interceptedFetch: typeof fetch;
let nativeFetch: typeof fetch;

type FileTransferMessage = {
  type: "file_transfer";
  transferId: string;
  status: "content" | "opened" | "error";
  fileName?: string;
  mimeType?: string;
  size?: number;
  base64?: string;
  error?: string;
};

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
  // 1s, 2s, 4s, 8s, capped at 10s
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
  if (reconnectTimer !== null) return; // already scheduled

  const delay = computeReconnectDelay(reconnectAttempt);
  reconnectAttempt += 1;

  debugLog(
    `[NetworkAgent] 🔁 Will retry connection in ${delay}ms (attempt #${reconnectAttempt})`
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (stopped || !reconnectStrategy) return;
    establishConnection(reconnectStrategy).catch((err) => {
      errorLog("[NetworkAgent] ❌ Reconnect attempt failed:", err?.message || err);
      // The connection failure will itself trigger another scheduleReconnect
      // via onclose / discovery rejection — no need to chain here.
    });
  }, delay);
}

/**
 * Establishes a fresh WebSocket connection according to the chosen strategy.
 * - Manual: connects directly to the stored wsUrl.
 * - Auto:   resets the discovery cache (so a re-published mDNS service with a
 *           new port is picked up) and runs discoverDebugger() again, then
 *           connects to the resolved URL.
 *
 * Used by both the initial init flow and the reconnect timer.
 */
async function establishConnection(strategy: ReconnectStrategy): Promise<void> {
  if (strategy.mode === "manual") {
    connectSocket(strategy.wsUrl);
    return;
  }

  debugLog("[NetworkAgent] 🔎 Re-discovering debugger via mDNS");
  resetDiscoveryCache();
  try {
    const service = await discoverDebugger({
      timeoutMs: strategy.discoveryTimeoutMs,
      debug: debugMode,
    });
    debugLog(
      `[NetworkAgent] 🎯 Discovered debugger: ${service.name} @ ${service.url}`
    );
    connectSocket(service.url);
  } catch (err) {
    errorLog(
      "[NetworkAgent] ❌ Auto-discovery failed:",
      (err as Error)?.message || err
    );
    // Trigger another retry cycle so the agent doesn't give up after one
    // unsuccessful discovery attempt (e.g. desktop launched a moment later).
    scheduleReconnect();
  }
}

// Metadata storage - use config object as key
const requestMetadataMap = new WeakMap<
  any,
  { id: string; startedAt: string; startTime: number }
>();

/**
 * Log helper - only logs in debug mode
 */
function debugLog(...args: any[]) {
  if (debugMode) {
    console.log(...args);
  }
}

/**
 * Error log helper - always logs (critical errors)
 */
function errorLog(...args: any[]) {
  console.log(...args);
}

/**
 * Establishes the WebSocket connection to the desktop inspector.
 * Called either directly (manual wsUrl) or after mDNS auto-discovery.
 */
function connectSocket(wsUrl: string) {
  try {
    debugLog("[NetworkAgent] 🔄 Connecting to inspector:", wsUrl);
    socket = new WebSocket(withAgentKind(wsUrl, "network"));

    socket.onopen = () => {
      debugLog("[NetworkAgent] ✅ Connected to inspector:", wsUrl);
      debugLog("[NetworkAgent] 🟢 Socket state: OPEN (readyState: 1)");

      // Successful connect — reset the backoff so the next disconnect starts
      // its retry cycle from 1s again instead of resuming a long delay.
      reconnectAttempt = 0;
      clearReconnectTimer();

      // Flush anything captured while the socket was null / connecting —
      // typically early-startup requests that fired before mDNS discovery
      // completed, or events from a disconnect window before reconnect.
      flushSendQueue();

      if (healthCheckInterval) clearInterval(healthCheckInterval);
      if (debugMode) {
        healthCheckInterval = setInterval(() => {
          if (socket) {
            const states = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
            const stateStr = states[socket.readyState] || "UNKNOWN";
            debugLog(
              `[NetworkAgent] 💚 Health check - Socket: ${stateStr} (${socket.readyState})`
            );
          }
        }, 10000);
      }
    };

    socket.onerror = (e) => {
      errorLog("[NetworkAgent] ❌ WebSocket error:", e);
      debugLog("[NetworkAgent] 🔍 Current socket state:", socket?.readyState);
    };

    socket.onmessage = async (event) => {
      try {
        const dataStr = typeof event.data === "string" ? event.data : event.data.toString();
        const message = JSON.parse(dataStr);
        if (message.type === "command" && message.command === "replay_request") {
          const { url, method, headers, body, formParts } = message.payload;
          debugLog(`[NetworkAgent] 🔄 Replaying request: ${method} ${url}`);

          const init: any = { method };
          if (headers) init.headers = headers;
          const methodAllowsBody = ["POST", "PUT", "PATCH"].includes(
            method.toUpperCase()
          );

          if (methodAllowsBody && Array.isArray(formParts) && formParts.length) {
            // Rebuild the multipart body. Files are re-read from their local
            // uri on the device — the desktop app never holds the bytes.
            init.body = buildFormDataFromParts(formParts);
            // Drop the captured content-type so the platform can generate a
            // fresh boundary that matches the body we just built.
            if (init.headers) {
              init.headers = Object.fromEntries(
                Object.entries(init.headers as Record<string, string>).filter(
                  ([key]) => key.toLowerCase() !== "content-type"
                )
              );
            }
          } else if (body && methodAllowsBody) {
            init.body = body;
          }

          if (interceptedFetch) {
            interceptedFetch(url, init).catch((err) => {
              errorLog("[NetworkAgent] ❌ Replay request failed:", err);
            });
          } else {
            errorLog("[NetworkAgent] ❌ Intercepted fetch is not ready yet.");
          }
        } else if (message.type === "command" && message.command === "request_file") {
          await handleFileRequest(message.payload);
        } else if (message.type === "command" && message.command === "open_file") {
          await handleOpenFile(message.payload);
        }
      } catch (e) {
        errorLog("[NetworkAgent] ❌ Failed to parse incoming message:", e);
      }
    };

    socket.onclose = (e) => {
      debugLog("[NetworkAgent] 🔌 Disconnected from inspector");
      debugLog("[NetworkAgent] 🔍 Close code:", e.code, "reason:", e.reason);

      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
      }

      socket = null;

      // Schedule an automatic reconnect — handles desktop restart, Wi-Fi
      // hiccup, port live-restart, VPN toggle, etc. without requiring an
      // app reload. The reconnect uses the same strategy (manual wsUrl or
      // mDNS re-discovery) that the initial init used.
      scheduleReconnect();
    };
  } catch (error) {
    errorLog("[NetworkAgent] ❌ Failed to create WebSocket:", error);
    scheduleReconnect();
  }
}

const ABSOLUTE_MAX_FILE_BYTES = 5 * 1024 * 1024;

function sendFileTransfer(message: FileTransferMessage) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
}

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

async function handleFileRequest(payload: {
  transferId: string;
  uri: string;
  fileName?: string;
  mimeType?: string;
  maxBytes?: number;
}) {
  const maxBytes = Math.min(
    Math.max(1, Number(payload.maxBytes) || ABSOLUTE_MAX_FILE_BYTES),
    ABSOLUTE_MAX_FILE_BYTES
  );
  try {
    const readFetch = nativeFetch || global.fetch;
    const response = await readFetch(payload.uri);
    if (!response.ok) throw new Error(`Unable to read file (${response.status})`);
    const blob = await response.blob();
    if (blob.size > maxBytes) {
      throw new Error(`File is ${(blob.size / 1024 / 1024).toFixed(2)} MB; limit is ${(maxBytes / 1024 / 1024).toFixed(0)} MB`);
    }
    const base64 = await blobToBase64(blob);
    sendFileTransfer({
      type: "file_transfer",
      transferId: payload.transferId,
      status: "content",
      fileName: payload.fileName,
      mimeType: payload.mimeType || blob.type || "application/octet-stream",
      size: blob.size,
      base64,
    });
  } catch (err) {
    sendFileTransfer({
      type: "file_transfer",
      transferId: payload.transferId,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleOpenFile(payload: { transferId: string; uri: string }) {
  try {
    // React Native is a peer dependency; dynamic loading keeps non-RN builds safe.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Linking } = require("react-native");
    await Linking.openURL(payload.uri);
    sendFileTransfer({ type: "file_transfer", transferId: payload.transferId, status: "opened" });
  } catch (err) {
    sendFileTransfer({
      type: "file_transfer",
      transferId: payload.transferId,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Initializes the network agent and overrides global.fetch
 */
export function initNetworkAgent(options: InitOptions = {}) {
  // @ts-ignore - __DEV__ is defined globally by Expo
  if (typeof __DEV__ !== "undefined" && !__DEV__) {
    return;
  }

  if (initialized) {
    debugLog("[NetworkAgent] Already initialized");
    return;
  }

  const { wsUrl, enabled = true, debug = false, discoveryTimeoutMs } = options;
  maxBodyLength = options.maxBodyLength || 3000;
  debugMode = debug;

  if (!enabled) {
    debugLog("[NetworkAgent] Disabled by config");
    return;
  }

  initialized = true;
  stopped = false;

  // Remember how we connected so the reconnect timer can repeat the same path.
  reconnectStrategy = wsUrl
    ? { mode: "manual", wsUrl }
    : { mode: "auto", discoveryTimeoutMs };
  reconnectAttempt = 0;

  // Kick off the initial connection. The reconnect machinery takes over from
  // here whenever the socket drops. We intentionally use plain discoverDebugger()
  // (not establishConnection) on the initial path so the in-flight promise is
  // SHARED with any other agent (Console + Network) starting at the same time —
  // only one zeroconf scan is needed.
  if (wsUrl) {
    debugLog("[NetworkAgent] 🔄 Initial connect to:", wsUrl);
    connectSocket(wsUrl);
  } else {
    debugLog("[NetworkAgent] 🔎 No wsUrl provided — auto-discovering debugger via mDNS");
    discoverDebugger({ timeoutMs: discoveryTimeoutMs, debug: debugMode })
      .then((service) => {
        debugLog(
          `[NetworkAgent] 🎯 Discovered debugger: ${service.name} @ ${service.url}`
        );
        connectSocket(service.url);
      })
      .catch((err) => {
        errorLog(
          "[NetworkAgent] ❌ Initial auto-discovery failed:",
          err?.message || err
        );
        scheduleReconnect();
      });
  }

  // Override global.fetch
  const originalFetch = global.fetch;
  nativeFetch = originalFetch;

  interceptedFetch = async (input: any, init?: any): Promise<Response> => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    // Extract URL
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;
    const method = (init?.method ?? (input as any)?.method)?.toUpperCase() || "GET";

    // Normalize request headers — when fetch is called with a Request object
    // the headers/body live on it instead of on `init`
    const headerSource = init?.headers ?? (input as any)?.headers;
    const requestHeaders = headerSource
      ? normalizeHeaders(headerSource)
      : undefined;

    // Describe the request body (multipart bodies get expanded into parts)
    const bodySource = init?.body ?? (input as any)?._bodyInit;
    const { requestBodySnippet, requestBodyKind, requestFormParts } =
      describeRequestBody(bodySource, requestHeaders, maxBodyLength);

    // Send request message
    debugLog(
      `[NetworkAgent] 🚀 Capturing ${method} request:`,
      String(url).substring(0, 80)
    );
    safeSend(socket, {
      type: "request",
      id,
      url,
      method,
      requestHeaders,
      requestBodySnippet,
      requestBodyKind,
      requestFormParts,
      startedAt,
    });

    try {
      // Call original fetch
      const response = await originalFetch(input, init);
      const responseHeaders = normalizeHeaders(response.headers);

      const sendResponse = (responseBodySnippet?: string) => {
        const durationMs = Date.now() - startTime;
        debugLog(
          `[NetworkAgent] 📥 Capturing response: ${response.status} (${durationMs}ms)`
        );
        safeSend(socket, {
          type: "response",
          id,
          url,
          status: response.status,
          statusText: response.statusText,
          responseHeaders,
          responseBodySnippet,
          durationMs,
          finishedAt: new Date().toISOString(),
          isError: false,
        });
      };

      // The body is read on the side so the app gets its Response right away:
      // waiting here would hang any fetch whose body never ends.
      const uncaptured = describeUncapturedBody(responseHeaders);
      if (uncaptured) {
        sendResponse(uncaptured);
      } else {
        // Promise.resolve().then() so a clone() failure can't reach the app.
        Promise.resolve()
          .then(() => response.clone().text())
          .then((text) => sendResponse(createTextSnippet(text, maxBodyLength)))
          .catch((readError) => {
            debugLog("[NetworkAgent] Failed to read response body:", readError);
            sendResponse();
          });
      }

      return response;
    } catch (err: any) {
      // Send response message in case of error
      const durationMs = Date.now() - startTime;

      errorLog(`[NetworkAgent] ❌ Request failed:`, err?.message || err);
      safeSend(socket, {
        type: "response",
        id,
        url,
        status: 0,
        statusText: "NETWORK_ERROR",
        responseHeaders: undefined,
        responseBodySnippet: undefined,
        durationMs,
        finishedAt: new Date().toISOString(),
        isError: true,
        errorMessage: String(err?.message || err),
      });

      // Re-throw the error (preserve normal fetch behavior)
      throw err;
    }
  };

  global.fetch = interceptedFetch;

  // Axios that was exposed globally. Other instances need addAxiosInstance().
  const globalAxios = (global as any).axios;
  if (globalAxios?.interceptors) attachAxiosInterceptors(globalAxios);

  debugLog("[NetworkAgent] 🔍 Network monitoring started");
}

/**
 * Pre-connect / disconnect buffer.
 *
 * Captures network events that fire while the WebSocket is null or not yet
 * OPEN — typically the first ~2.5s after init (mDNS discovery) and any
 * disconnect window before auto-reconnect succeeds. Without this buffer
 * those events were silently dropped.
 *
 * The queue is bounded so a long disconnect can't unbounded-grow memory.
 * On overflow we drop the OLDEST message (FIFO), keeping the most recent
 * activity — usually what the developer wants to see when reconnecting.
 */
const sendQueue: NetworkMessage[] = [];
const MAX_SEND_QUEUE = 200;

function enqueueOrDrop(payload: NetworkMessage) {
  if (sendQueue.length >= MAX_SEND_QUEUE) {
    sendQueue.shift(); // drop oldest
  }
  sendQueue.push(payload);
}

function flushSendQueue() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  if (sendQueue.length === 0) return;

  debugLog(`[NetworkAgent] 📤 Flushing ${sendQueue.length} queued messages`);
  // Move queue out before iterating in case sending re-enters via interceptors.
  const drained = sendQueue.splice(0, sendQueue.length);
  for (const payload of drained) {
    try {
      socket.send(JSON.stringify(payload));
    } catch (e) {
      errorLog("[NetworkAgent] ❌ Flush error, dropping remainder:", e);
      break;
    }
  }
}

/**
 * Safe message sending over WebSocket. Queues the payload if the socket
 * isn't open yet — flushed by flushSendQueue() once onopen fires.
 */
function safeSend(ws: WebSocket | null, payload: NetworkMessage) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    enqueueOrDrop(payload);
    debugLog(
      `[NetworkAgent] 📥 Queued ${payload.type} (socket not ready, queue size: ${sendQueue.length})`
    );
    return;
  }

  try {
    const message = JSON.stringify(payload);
    ws.send(message);
    debugLog(
      `[NetworkAgent] ✅ Sent ${payload.type} for:`,
      payload.url.substring(0, 60) + "..."
    );
  } catch (e) {
    errorLog("[NetworkAgent] ❌ Send error:", e);
  }
}

/**
 * Normalizes headers to Record<string, string> format
 */
function normalizeHeaders(headers: any): Record<string, string> {
  const result: Record<string, string> = {};

  if (!headers) return result;

  // Headers object (Headers API)
  if (typeof headers.forEach === "function") {
    headers.forEach((value: string, key: string) => {
      result[key.toLowerCase()] = value;
    });
  }
  // Array of [key, value] tuples
  else if (Array.isArray(headers)) {
    headers.forEach(([k, v]) => {
      result[String(k).toLowerCase()] = String(v);
    });
  }
  // Plain object
  else if (typeof headers === "object") {
    Object.entries(headers).forEach(([k, v]) => {
      result[String(k).toLowerCase()] = String(v);
    });
  }

  return result;
}

/** Hard caps so a huge upload can never flood the socket */
const MAX_FORM_PARTS = 100;
const MAX_FORM_VALUE_LENGTH = 2000;

/**
 * Detects FormData without relying on `instanceof` — the constructor differs
 * between the React Native polyfill, Expo Go and any userland polyfill.
 */
function isFormDataLike(body: any): boolean {
  if (!body || typeof body !== "object") return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;
  // React Native keeps the raw [name, value] tuples on `_parts`
  if (Array.isArray(body._parts)) return true;
  if (body.constructor?.name === "FormData") return true;
  return typeof body.append === "function" && typeof body.getParts === "function";
}

/**
 * Describes one appended value. Files can arrive in three shapes:
 * `{ uri, name, type }` (React Native / expo-image-picker), a web `File`, or
 * a React Native `Blob` (metadata lives on `_data`).
 */
function toFormDataPart(name: string, value: any): FormDataPart {
  if (value === null || value === undefined) {
    return { name, kind: "text", value: String(value) };
  }

  if (typeof value !== "object") {
    return {
      name,
      kind: "text",
      value: createTextSnippet(String(value), MAX_FORM_VALUE_LENGTH),
    };
  }

  const blobData = value._data || {};
  const uri = typeof value.uri === "string" ? value.uri : undefined;
  const fileName = value.name ?? value.fileName ?? value.filename ?? blobData.name;
  const mimeType = value.type ?? value.mimeType ?? blobData.type;
  const size =
    typeof value.size === "number"
      ? value.size
      : typeof blobData.size === "number"
      ? blobData.size
      : undefined;

  if (uri || fileName || size !== undefined) {
    return {
      name,
      kind: "file",
      uri,
      fileName: fileName ? String(fileName) : undefined,
      mimeType: mimeType ? String(mimeType) : undefined,
      size,
    };
  }

  try {
    return {
      name,
      kind: "text",
      value: createTextSnippet(JSON.stringify(value), MAX_FORM_VALUE_LENGTH),
    };
  } catch {
    return { name, kind: "text", value: "[unserializable value]" };
  }
}

/**
 * Reads every field out of a FormData instance.
 */
function readFormDataParts(body: any): FormDataPart[] {
  const parts: FormDataPart[] = [];

  const push = (name: any, value: any) => {
    if (parts.length >= MAX_FORM_PARTS) return;
    parts.push(toFormDataPart(String(name), value));
  };

  try {
    if (Array.isArray(body._parts)) {
      // React Native
      body._parts.forEach((entry: any) => {
        if (Array.isArray(entry)) push(entry[0], entry[1]);
      });
    } else if (typeof body.forEach === "function") {
      // Web FormData — forEach(value, name)
      body.forEach((value: any, entryName: any) => push(entryName, value));
    } else if (typeof body.entries === "function") {
      for (const [entryName, value] of body.entries()) push(entryName, value);
    }
  } catch (err) {
    debugLog("[NetworkAgent] Failed to read FormData parts:", err);
  }

  return parts;
}

/** Pulls the boundary token out of a `multipart/form-data; boundary=…` header */
function getMultipartBoundary(contentType?: string): string | undefined {
  if (!contentType || !/multipart\/form-data/i.test(contentType)) return undefined;
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = match?.[1] || match?.[2];
  return boundary ? boundary.trim() : undefined;
}

/**
 * Parses an already-serialized multipart body (some HTTP clients hand us the
 * encoded string instead of the FormData object).
 */
function parseMultipartText(text: string, boundary: string): FormDataPart[] {
  const parts: FormDataPart[] = [];

  for (const segment of text.split(`--${boundary}`)) {
    if (parts.length >= MAX_FORM_PARTS) break;

    const body = segment.replace(/^\r?\n/, "");
    // Skip the preamble and the closing "--" delimiter
    if (!body || body.startsWith("--")) continue;

    const separator = body.search(/\r?\n\r?\n/);
    if (separator === -1) continue;

    const rawHeaders = body.slice(0, separator);
    const rawValue = body
      .slice(separator)
      .replace(/^\r?\n\r?\n/, "")
      .replace(/\r?\n$/, "");

    const name = /name="([^"]*)"/i.exec(rawHeaders)?.[1];
    if (name === undefined) continue;

    const fileName = /filename="([^"]*)"/i.exec(rawHeaders)?.[1];
    const mimeType = /content-type:\s*([^\r\n]+)/i.exec(rawHeaders)?.[1]?.trim();

    if (fileName !== undefined) {
      // Already encoded, so the payload length is our best size estimate
      parts.push({ name, kind: "file", fileName, mimeType, size: rawValue.length });
    } else {
      parts.push({
        name,
        kind: "text",
        value: createTextSnippet(rawValue, MAX_FORM_VALUE_LENGTH),
      });
    }
  }

  return parts;
}

/** Human-readable byte count for the fallback snippet */
function formatBytes(bytes?: number): string | undefined {
  if (bytes === undefined || !isFinite(bytes)) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Plain-text rendering of the parts — kept so copy-as-cURL, saved requests and
 * older desktop builds still show something meaningful.
 */
function formatFormDataParts(parts: FormDataPart[]): string {
  const lines = [`multipart/form-data — ${parts.length} part(s)`];

  parts.forEach((part) => {
    if (part.kind === "file") {
      const meta = [part.mimeType, formatBytes(part.size)].filter(Boolean).join(", ");
      const label = part.fileName || "(unnamed file)";
      lines.push(
        `${part.name}: [file] ${label}${meta ? ` (${meta})` : ""}${
          part.uri ? ` ${part.uri}` : ""
        }`
      );
    } else {
      lines.push(`${part.name}: ${part.value ?? ""}`);
    }
  });

  if (parts.length >= MAX_FORM_PARTS) {
    lines.push(`…[only the first ${MAX_FORM_PARTS} parts are captured]`);
  }

  return lines.join("\n");
}

/**
 * Rebuilds a FormData from captured parts so a multipart request can be
 * replayed. File bytes never leave the device: only the local uri travels to
 * the inspector and back, and the platform re-reads the file when sending.
 * Parts captured without a uri (already-serialized bodies) cannot be restored.
 */
function buildFormDataFromParts(parts: FormDataPart[]): FormData {
  const form = new FormData();

  parts.forEach((part) => {
    if (part.kind === "file") {
      if (!part.uri) {
        errorLog(
          `[NetworkAgent] ⚠️ Skipping file part "${part.name}" during replay — no local uri captured`
        );
        return;
      }
      form.append(part.name, {
        uri: part.uri,
        name: part.fileName || "file",
        type: part.mimeType || "application/octet-stream",
      } as any);
    } else {
      form.append(part.name, part.value ?? "");
    }
  });

  return form;
}

/**
 * Returns the multipart parts of a request body, or undefined when the body is
 * not multipart. Handles both live FormData objects and pre-serialized bodies.
 */
function extractFormParts(
  body: any,
  headers?: Record<string, string>
): FormDataPart[] | undefined {
  if (isFormDataLike(body)) {
    return readFormDataParts(body);
  }

  if (typeof body === "string") {
    const boundary = getMultipartBoundary(headers?.["content-type"]);
    if (boundary) {
      const parts = parseMultipartText(body, boundary);
      if (parts.length > 0) return parts;
    }
  }

  return undefined;
}

/**
 * Builds the body-related fields of a "request" message. Multipart bodies get
 * expanded into `requestFormParts` so the inspector can list every field and
 * uploaded file instead of showing an opaque "[FormData]".
 */
function describeRequestBody(
  body: any,
  headers: Record<string, string> | undefined,
  maxLen: number
): {
  requestBodySnippet?: string;
  requestBodyKind?: "formdata";
  requestFormParts?: FormDataPart[];
} {
  if (body === undefined || body === null) return {};

  const formParts = extractFormParts(body, headers);
  if (formParts) {
    return {
      requestBodyKind: "formdata",
      requestFormParts: formParts,
      requestBodySnippet: formatFormDataParts(formParts),
    };
  }

  return { requestBodySnippet: createBodySnippet(body, maxLen) };
}

/**
 * Converts body to snippet
 */
function createBodySnippet(body: any, maxLen: number): string {
  try {
    if (typeof body === "string") {
      return createTextSnippet(body, maxLen);
    }

    if (isFormDataLike(body)) {
      return formatFormDataParts(readFormDataParts(body));
    }

    if (body instanceof Blob) {
      return `[Blob: ${body.type || "unknown"}, size: ${body.size}]`;
    }

    if (body instanceof ArrayBuffer) {
      return `[ArrayBuffer: ${body.byteLength} bytes]`;
    }

    if (typeof body === "object") {
      return createTextSnippet(JSON.stringify(body), maxLen);
    }

    return createTextSnippet(String(body), maxLen);
  } catch {
    return "[unserializable body]";
  }
}

/** Bodies that are binary or never end, which the agent doesn't try to read. */
const UNCAPTURED_BODY = /^(image|video|audio|font)\/|octet-stream|event-stream|ndjson|application\/(pdf|zip|gzip)/i;
const MAX_CAPTURED_RESPONSE_BYTES = 5 * 1024 * 1024;

function describeUncapturedBody(headers: Record<string, string>): string | undefined {
  const contentType = headers["content-type"] ?? "";
  if (UNCAPTURED_BODY.test(contentType)) return `[${contentType} body not captured]`;
  const length = Number(headers["content-length"]);
  if (length > MAX_CAPTURED_RESPONSE_BYTES) {
    return `[${formatBytes(length)} body not captured]`;
  }
  return undefined;
}

/**
 * Truncates text to specified length
 */
function createTextSnippet(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n…[truncated]";
}

/**
 * Adds interceptors to custom axios instances
 *
 * @example
 * ```ts
 * import { initNetworkAgent, addAxiosInstance } from "./debug/expoNetworkAgent";
 * import { apiClient } from "./api/client";
 *
 * if (__DEV__) {
 *   initNetworkAgent({ wsUrl: "ws://192.168.1.12:5051" });
 *   addAxiosInstance(apiClient); // Your custom axios instance
 * }
 * ```
 */
export function addAxiosInstance(axiosInstance: any) {
  if (!axiosInstance || !axiosInstance.interceptors) {
    errorLog("[NetworkAgent] ❌ Invalid axios instance");
    return;
  }
  attachAxiosInterceptors(axiosInstance);
}

/** The URL a request really goes to, including baseURL and params. */
function axiosRequestUrl(instance: any, config: any): string {
  let url: string | undefined;
  try {
    url = instance.getUri?.(config);
  } catch {
    // Fall through to the manual join.
  }
  url = url || config.url || "";
  if (config.baseURL && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url as string)) {
    url = `${String(config.baseURL).replace(/\/+$/, "")}/${String(url).replace(/^\/+/, "")}`;
  }
  return url as string;
}

function axiosBodySnippet(data: any): string | undefined {
  if (!data) return undefined;
  try {
    return createTextSnippet(
      typeof data === "string" ? data : JSON.stringify(data),
      maxBodyLength
    );
  } catch {
    return "[unserializable body]";
  }
}

function attachAxiosInterceptors(instance: any) {
  instance.interceptors.request.use(
    (config: any) => {
      if (!config) return config;

      const metadata = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        startedAt: new Date().toISOString(),
        startTime: Date.now(),
      };
      config.metadata = metadata;
      requestMetadataMap.set(config, metadata);

      const url = axiosRequestUrl(instance, config);
      const method = (config.method || "GET").toUpperCase();
      const requestHeaders = normalizeHeaders(config.headers);
      debugLog(`[NetworkAgent] 🚀 [AXIOS] Capturing ${method} request:`, url.substring(0, 80));

      safeSend(socket, {
        type: "request",
        id: metadata.id,
        url,
        method,
        requestHeaders,
        ...describeRequestBody(config.data, requestHeaders, maxBodyLength),
        startedAt: metadata.startedAt,
      });

      return config;
    },
    (error: any) => {
      errorLog("[NetworkAgent] ❌ [AXIOS] Request error:", error);
      return Promise.reject(error);
    }
  );

  const report = (config: any, fields: {
    status: number;
    statusText?: string;
    headers?: any;
    data?: any;
    isError: boolean;
    errorMessage?: string;
  }) => {
    const metadata = config && (requestMetadataMap.get(config) ?? config.metadata);
    if (!metadata) return;
    safeSend(socket, {
      type: "response",
      id: metadata.id,
      url: axiosRequestUrl(instance, config),
      status: fields.status,
      statusText: fields.statusText,
      responseHeaders: fields.headers ? normalizeHeaders(fields.headers) : undefined,
      responseBodySnippet: axiosBodySnippet(fields.data),
      durationMs: Date.now() - metadata.startTime,
      finishedAt: new Date().toISOString(),
      isError: fields.isError,
      errorMessage: fields.errorMessage,
    });
  };

  instance.interceptors.response.use(
    (response: any) => {
      if (response) {
        report(response.config, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          isError: false,
        });
      }
      return response;
    },
    (error: any) => {
      // A 4xx/5xx is a normal HTTP response. Only "no response at all" is an error.
      report(error?.config, {
        status: error?.response?.status || 0,
        statusText: error?.response?.statusText || "NETWORK_ERROR",
        headers: error?.response?.headers,
        data: error?.response?.data,
        isError: !error?.response,
        errorMessage: error?.message,
      });
      return Promise.reject(error);
    }
  );

  // Run ours before the app's interceptors so we see the untouched traffic.
  try {
    for (const manager of [instance.interceptors.response, instance.interceptors.request]) {
      const handlers = (manager as any).handlers;
      if (handlers?.length > 1) handlers.unshift(handlers.pop());
    }
  } catch (e) {
    debugLog("[NetworkAgent] ⚠️ Could not reorder interceptors:", e);
  }

  debugLog("[NetworkAgent] ✅ Axios interceptors configured");
}
