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
import axios from "axios";

type NetworkMessage =
  | {
      type: "request";
      id: string;
      url: string;
      method: string;
      requestHeaders?: Record<string, string>;
      requestBodySnippet?: string;
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
  /** WebSocket URL - e.g.: "ws://192.168.1.100:5051" */
  wsUrl: string;
  /** Enable/disable the agent (default: true) */
  enabled?: boolean;
  /** Maximum body snippet length (default: 3000) */
  maxBodyLength?: number;
};

let initialized = false;
let socket: WebSocket | null = null;
let healthCheckInterval: any = null;
let maxBodyLength = 3000;

// Metadata storage - use config object as key
const requestMetadataMap = new WeakMap<
  any,
  { id: string; startedAt: string; startTime: number }
>();

/**
 * Initializes the network agent and overrides global.fetch
 */
export function initNetworkAgent(options: InitOptions) {
  // @ts-ignore - __DEV__ is defined globally by Expo
  if (typeof __DEV__ !== "undefined" && !__DEV__) {
    return;
  }

  if (initialized) {
    console.log("[NetworkAgent] Already initialized");
    return;
  }

  const { wsUrl, enabled = true } = options;
  maxBodyLength = options.maxBodyLength || 3000;

  if (!enabled) {
    console.log("[NetworkAgent] Disabled by config");
    return;
  }

  initialized = true;

  // Establish WebSocket connection
  try {
    console.log("[NetworkAgent] 🔄 Connecting to inspector:", wsUrl);
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("[NetworkAgent] ✅ Connected to inspector:", wsUrl);
      console.log("[NetworkAgent] 🟢 Socket state: OPEN (readyState: 1)");

      // Health check - check socket status every 10 seconds
      if (healthCheckInterval) clearInterval(healthCheckInterval);
      healthCheckInterval = setInterval(() => {
        if (socket) {
          const states = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
          const stateStr = states[socket.readyState] || "UNKNOWN";
          console.log(
            `[NetworkAgent] 💚 Health check - Socket: ${stateStr} (${socket.readyState})`
          );
        }
      }, 10000);
    };

    socket.onerror = (e) => {
      console.log("[NetworkAgent] ❌ WebSocket error:", e);
      console.log(
        "[NetworkAgent] 🔍 Current socket state:",
        socket?.readyState
      );
    };

    socket.onclose = (e) => {
      console.log("[NetworkAgent] 🔌 Disconnected from inspector");
      console.log("[NetworkAgent] 🔍 Close code:", e.code, "reason:", e.reason);

      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
      }

      socket = null;
      // Optional: Auto-reconnect logic can be added
    };
  } catch (error) {
    console.error("[NetworkAgent] ❌ Failed to create WebSocket:", error);
    return;
  }

  // Override global.fetch
  const originalFetch = global.fetch;

  global.fetch = async (input: any, init?: any): Promise<Response> => {
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
    const method = init?.method?.toUpperCase() || "GET";

    // Normalize request headers
    const requestHeaders = init?.headers
      ? normalizeHeaders(init.headers)
      : undefined;

    // Get request body as snippet
    const requestBodySnippet = init?.body
      ? createBodySnippet(init.body, maxBodyLength)
      : undefined;

    // Send request message
    console.log(
      `[NetworkAgent] 🚀 Capturing ${method} request:`,
      url.substring(0, 80)
    );
    safeSend(socket, {
      type: "request",
      id,
      url,
      method,
      requestHeaders,
      requestBodySnippet,
      startedAt,
    });

    try {
      // Call original fetch
      const response = await originalFetch(input, init);

      // Clone response (to be able to read body)
      const clone = response.clone();

      // Read response body (as text)
      let responseText = "";
      try {
        responseText = await clone.text();
      } catch (readError) {
        console.log("[NetworkAgent] Failed to read response body:", readError);
      }

      const durationMs = Date.now() - startTime;

      // Normalize response headers
      const responseHeaders = normalizeHeaders(response.headers);

      // Send response message
      console.log(
        `[NetworkAgent] 📥 Capturing response: ${response.status} (${durationMs}ms)`
      );
      safeSend(socket, {
        type: "response",
        id,
        url,
        status: response.status,
        statusText: response.statusText,
        responseHeaders,
        responseBodySnippet: createTextSnippet(responseText, maxBodyLength),
        durationMs,
        finishedAt: new Date().toISOString(),
        isError: false,
      });

      return response;
    } catch (err: any) {
      // Send response message in case of error
      const durationMs = Date.now() - startTime;

      console.log(`[NetworkAgent] ❌ Request failed:`, err?.message || err);
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

  // ⭐ ADD AXIOS INTERCEPTOR (if available)
  try {
    // Dynamically import Axios

    if (axios && axios.interceptors) {
      console.log("[NetworkAgent] 🔧 Setting up Axios interceptors");

      // Log existing interceptor count
      console.log("[NetworkAgent] 📊 Existing interceptors (global):", {
        requestCount: (axios.interceptors.request as any).handlers?.length || 0,
        responseCount:
          (axios.interceptors.response as any).handlers?.length || 0,
      });

      // Request interceptor
      axios.interceptors.request.use(
        (config: any) => {
          if (!config) {
            console.log(
              "[NetworkAgent] ⚠️ Empty config in axios request interceptor"
            );
            return config;
          }

          const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const startedAt = new Date().toISOString();
          const startTime = Date.now();

          // Save metadata to both config and WeakMap
          const metadata = { id, startedAt, startTime };
          config.metadata = metadata;
          requestMetadataMap.set(config, metadata);

          // BONUS: Add custom header (as last resort)
          if (!config.headers) config.headers = {};
          config.headers["X-Network-Inspector-ID"] = id;

          const url = config.url || "";
          const fullUrl = config.baseURL ? `${config.baseURL}${url}` : url;
          const method = (config.method || "GET").toUpperCase();

          console.log(
            `[NetworkAgent] 🚀 [AXIOS] Capturing ${method} request:`,
            fullUrl.substring(0, 80)
          );

          safeSend(socket, {
            type: "request",
            id,
            url: fullUrl,
            method,
            requestHeaders: config.headers || {},
            requestBodySnippet: config.data
              ? createBodySnippet(config.data, maxBodyLength)
              : undefined,
            startedAt,
          });

          return config;
        },
        (error: any) => {
          console.log("[NetworkAgent] ❌ [AXIOS] Request error:", error);
          return Promise.reject(error);
        }
      );

      // Response interceptor
      axios.interceptors.response.use(
        (response: any) => {
          console.log(
            "[NetworkAgent] 🔍 [AXIOS] Response interceptor triggered (global)"
          );

          if (!response) {
            console.log(
              "[NetworkAgent] ⚠️ [AXIOS] No response object (global)"
            );
            return response;
          }

          // Find metadata - try several different methods
          let metadata: any = null;
          let id: string | undefined;
          let startTime: number | undefined;

          if (response.config) {
            // Method 1: Get from WeakMap
            metadata = requestMetadataMap.get(response.config);

            // Method 2: Get from Config.metadata
            if (!metadata && response.config.metadata) {
              metadata = response.config.metadata;
            }

            // Method 3: Get ID from request header
            if (
              !metadata &&
              response.config.headers &&
              response.config.headers["X-Network-Inspector-ID"]
            ) {
              id = response.config.headers["X-Network-Inspector-ID"];
              console.log(
                "[NetworkAgent] 🔄 Recovered ID from request header (global):",
                id
              );
            }
          }

          // Method 4: Get ID from response header (if API echoes it)
          if (
            !metadata &&
            !id &&
            response.headers &&
            response.headers["x-network-inspector-id"]
          ) {
            id = response.headers["x-network-inspector-id"];
            console.log(
              "[NetworkAgent] 🔄 Recovered ID from response header (global):",
              id
            );
          }

          if (!response.config) {
            console.log(
              "[NetworkAgent] ⚠️ [AXIOS] Response.config missing (global), ID recovered:",
              !!id
            );
            if (!id) {
              console.log(
                "[NetworkAgent] 📊 Orphan response - cannot track (global):",
                {
                  status: response.status,
                  hasData: !!response.data,
                }
              );
              return response;
            }
          }

          // Get values from metadata
          if (metadata) {
            if (!id) id = metadata.id;
            if (!startTime) startTime = metadata.startTime;
          }

          const startedAt = metadata?.startedAt;

          console.log("[NetworkAgent] 🔍 [AXIOS] Response metadata (global):", {
            hasId: !!id,
            hasMetadata: !!metadata,
            fromWeakMap: response.config
              ? requestMetadataMap.has(response.config)
              : false,
            fromConfig: !!response.config?.metadata,
            status: response.status,
          });

          if (id && startTime) {
            const durationMs = Date.now() - startTime;
            const url = response.config.url || "";
            const fullUrl = response.config.baseURL
              ? `${response.config.baseURL}${url}`
              : url;

            console.log(
              `[NetworkAgent] 📥 [AXIOS] Capturing response: ${response.status} (${durationMs}ms)`
            );

            safeSend(socket, {
              type: "response",
              id,
              url: fullUrl,
              status: response.status,
              statusText: response.statusText,
              responseHeaders: response.headers || {},
              responseBodySnippet: response.data
                ? createTextSnippet(
                    typeof response.data === "string"
                      ? response.data
                      : JSON.stringify(response.data),
                    maxBodyLength
                  )
                : undefined,
              durationMs,
              finishedAt: new Date().toISOString(),
              isError: false,
            });
          }

          return response;
        },
        (error: any) => {
          // First try to get from WeakMap
          let metadata = error.config
            ? requestMetadataMap.get(error.config)
            : null;
          if (!metadata && error.config?.metadata) {
            metadata = error.config.metadata;
          }

          const { id, startedAt, startTime } = metadata || {};

          if (id && startTime) {
            const durationMs = Date.now() - startTime;
            const url = error.config?.url || "";
            const fullUrl = error.config?.baseURL
              ? `${error.config.baseURL}${url}`
              : url;

            console.log(
              `[NetworkAgent] ❌ [AXIOS] Request failed:`,
              error.message
            );

            safeSend(socket, {
              type: "response",
              id,
              url: fullUrl,
              status: error.response?.status || 0,
              statusText: error.response?.statusText || "NETWORK_ERROR",
              responseHeaders: error.response?.headers || undefined,
              responseBodySnippet: error.response?.data
                ? createTextSnippet(
                    typeof error.response.data === "string"
                      ? error.response.data
                      : JSON.stringify(error.response.data),
                    maxBodyLength
                  )
                : undefined,
              durationMs,
              finishedAt: new Date().toISOString(),
              isError: true,
              errorMessage: error.message,
            });
          }

          return Promise.reject(error);
        }
      );

      // Move interceptors to the front (run before other interceptors)
      try {
        const responseHandlers = (axios.interceptors.response as any).handlers;
        if (responseHandlers && responseHandlers.length > 1) {
          // The last added (ours) is at the end, move it to the front
          const ourHandler = responseHandlers.pop();
          if (ourHandler) {
            responseHandlers.unshift(ourHandler);
            console.log(
              "[NetworkAgent] 🔄 Moved response interceptor to front (global)"
            );
          }
        }

        const requestHandlers = (axios.interceptors.request as any).handlers;
        if (requestHandlers && requestHandlers.length > 1) {
          // The last added (ours) is at the end, move it to the front
          const ourHandler = requestHandlers.pop();
          if (ourHandler) {
            requestHandlers.unshift(ourHandler);
            console.log(
              "[NetworkAgent] 🔄 Moved request interceptor to front (global)"
            );
          }
        }
      } catch (e) {
        console.log(
          "[NetworkAgent] ⚠️ Could not reorder interceptors (global):",
          e
        );
      }

      console.log("[NetworkAgent] ✅ Axios interceptors configured");
    }
  } catch (axiosError) {
    console.log("[NetworkAgent] ℹ️ Axios not found, using fetch-only mode");
  }

  console.log("[NetworkAgent] 🔍 Network monitoring started");
}

/**
 * Safe message sending over WebSocket
 */
function safeSend(ws: WebSocket | null, payload: NetworkMessage) {
  if (!ws) {
    console.log("[NetworkAgent] ❌ Socket is null, cannot send", payload.type);
    return;
  }

  if (ws.readyState !== WebSocket.OPEN) {
    console.log(
      "[NetworkAgent] ❌ Socket not open (state:",
      ws.readyState,
      "), cannot send",
      payload.type
    );
    return;
  }

  try {
    const message = JSON.stringify(payload);
    ws.send(message);
    console.log(
      `[NetworkAgent] ✅ Sent ${payload.type} for:`,
      payload.url.substring(0, 60) + "..."
    );
  } catch (e) {
    console.log("[NetworkAgent] ❌ Send error:", e);
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

/**
 * Converts body to snippet
 */
function createBodySnippet(body: any, maxLen: number): string {
  try {
    if (typeof body === "string") {
      return createTextSnippet(body, maxLen);
    }

    if (body instanceof FormData) {
      return "[FormData]";
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
    console.log("[NetworkAgent] ❌ Invalid axios instance");
    return;
  }

  console.log("[NetworkAgent] 🔧 Adding interceptors to custom axios instance");

  // Log existing interceptor count
  console.log("[NetworkAgent] 📊 Existing interceptors:", {
    requestCount:
      (axiosInstance.interceptors.request as any).handlers?.length || 0,
    responseCount:
      (axiosInstance.interceptors.response as any).handlers?.length || 0,
  });

  // Request interceptor
  axiosInstance.interceptors.request.use(
    (config: any) => {
      if (!config) {
        console.log(
          "[NetworkAgent] ⚠️ Empty config in axios request interceptor"
        );
        return config;
      }

      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const startedAt = new Date().toISOString();
      const startTime = Date.now();

      // Save metadata to both config and WeakMap
      const metadata = { id, startedAt, startTime };
      config.metadata = metadata;
      requestMetadataMap.set(config, metadata);

      // BONUS: Add custom header (as last resort)
      if (!config.headers) config.headers = {};
      config.headers["X-Network-Inspector-ID"] = id;

      const url = config.url || "";
      const fullUrl = config.baseURL ? `${config.baseURL}${url}` : url;
      const method = (config.method || "GET").toUpperCase();

      console.log(
        `[NetworkAgent] 🚀 [AXIOS] Capturing ${method} request:`,
        fullUrl.substring(0, 80)
      );

      safeSend(socket, {
        type: "request",
        id,
        url: fullUrl,
        method,
        requestHeaders: config.headers || {},
        requestBodySnippet: config.data
          ? createBodySnippet(config.data, maxBodyLength)
          : undefined,
        startedAt,
      });

      return config;
    },
    (error: any) => {
      console.log("[NetworkAgent] ❌ [AXIOS] Request error:", error);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  axiosInstance.interceptors.response.use(
    (response: any) => {
      console.log("[NetworkAgent] 🔍 [AXIOS] Response interceptor triggered");
      console.log(
        "[NetworkAgent] 🔍 Response object keys:",
        Object.keys(response || {})
      );

      if (!response) {
        console.log("[NetworkAgent] ⚠️ [AXIOS] No response object");
        return response;
      }

      // Find metadata - try several different methods
      let metadata: any = null;
      let id: string | undefined;
      let startTime: number | undefined;

      if (response.config) {
        // Method 1: Get from WeakMap
        metadata = requestMetadataMap.get(response.config);

        // Method 2: Get from Config.metadata
        if (!metadata && response.config.metadata) {
          metadata = response.config.metadata;
        }

        // Method 3: Get ID from request header
        if (
          !metadata &&
          response.config.headers &&
          response.config.headers["X-Network-Inspector-ID"]
        ) {
          id = response.config.headers["X-Network-Inspector-ID"];
          console.log(
            "[NetworkAgent] 🔄 Recovered ID from request header:",
            id
          );
        }
      }

      // Method 4: Get ID from response header (if API echoes it)
      if (
        !metadata &&
        !id &&
        response.headers &&
        response.headers["x-network-inspector-id"]
      ) {
        id = response.headers["x-network-inspector-id"];
        console.log("[NetworkAgent] 🔄 Recovered ID from response header:", id);
      }

      if (!response.config) {
        console.log(
          "[NetworkAgent] ⚠️ [AXIOS] Response.config missing, ID recovered:",
          !!id
        );
        if (!id) {
          console.log("[NetworkAgent] 📊 Orphan response - cannot track:", {
            status: response.status,
            hasData: !!response.data,
          });
          return response;
        }
      }

      // Get values from metadata
      if (metadata) {
        if (!id) id = metadata.id;
        if (!startTime) startTime = metadata.startTime;
      }

      const startedAt = metadata?.startedAt;

      console.log("[NetworkAgent] 🔍 [AXIOS] Response metadata:", {
        hasId: !!id,
        hasMetadata: !!metadata,
        fromWeakMap: response.config
          ? requestMetadataMap.has(response.config)
          : false,
        fromConfig: !!response.config?.metadata,
        status: response.status,
      });

      if (id && startTime) {
        const durationMs = Date.now() - startTime;
        const url = response.config.url || "";
        const fullUrl = response.config.baseURL
          ? `${response.config.baseURL}${url}`
          : url;

        console.log(
          `[NetworkAgent] 📥 [AXIOS] Capturing response: ${response.status} (${durationMs}ms)`
        );

        safeSend(socket, {
          type: "response",
          id,
          url: fullUrl,
          status: response.status,
          statusText: response.statusText,
          responseHeaders: response.headers || {},
          responseBodySnippet: response.data
            ? createTextSnippet(
                typeof response.data === "string"
                  ? response.data
                  : JSON.stringify(response.data),
                maxBodyLength
              )
            : undefined,
          durationMs,
          finishedAt: new Date().toISOString(),
          isError: false,
        });
      }

      return response;
    },
    (error: any) => {
      // First try to get from WeakMap
      let metadata = error.config ? requestMetadataMap.get(error.config) : null;
      if (!metadata && error.config?.metadata) {
        metadata = error.config.metadata;
      }

      const { id, startedAt, startTime } = metadata || {};

      if (id && startTime) {
        const durationMs = Date.now() - startTime;
        const url = error.config?.url || "";
        const fullUrl = error.config?.baseURL
          ? `${error.config.baseURL}${url}`
          : url;

        console.log(`[NetworkAgent] ❌ [AXIOS] Request failed:`, error.message);

        safeSend(socket, {
          type: "response",
          id,
          url: fullUrl,
          status: error.response?.status || 0,
          statusText: error.response?.statusText || "NETWORK_ERROR",
          responseHeaders: error.response?.headers || undefined,
          responseBodySnippet: error.response?.data
            ? createTextSnippet(
                typeof error.response.data === "string"
                  ? error.response.data
                  : JSON.stringify(error.response.data),
                maxBodyLength
              )
            : undefined,
          durationMs,
          finishedAt: new Date().toISOString(),
          isError: true,
          errorMessage: error.message,
        });
      }

      return Promise.reject(error);
    }
  );

  // Move interceptors to the front (run before other interceptors)
  try {
    const responseHandlers = (axiosInstance.interceptors.response as any)
      .handlers;
    if (responseHandlers && responseHandlers.length > 1) {
      // The last added (ours) is at the end, move it to the front
      const ourHandler = responseHandlers.pop();
      if (ourHandler) {
        responseHandlers.unshift(ourHandler);
        console.log("[NetworkAgent] 🔄 Moved response interceptor to front");
      }
    }

    const requestHandlers = (axiosInstance.interceptors.request as any)
      .handlers;
    if (requestHandlers && requestHandlers.length > 1) {
      // The last added (ours) is at the end, move it to the front
      const ourHandler = requestHandlers.pop();
      if (ourHandler) {
        requestHandlers.unshift(ourHandler);
        console.log("[NetworkAgent] 🔄 Moved request interceptor to front");
      }
    }
  } catch (e) {
    console.log("[NetworkAgent] ⚠️ Could not reorder interceptors:", e);
  }

  console.log("[NetworkAgent] ✅ Custom axios instance configured");
}
