// Shared types for renderer

export type LogLevel = "log" | "warn" | "error" | "info" | "debug";

/**
 * A single `multipart/form-data` part as captured by the agent. File parts
 * carry metadata only — the bytes stay on the device.
 */
export interface FormDataPart {
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
}

export type NetworkMessage =
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
    }
  | {
      type: "console";
      id: string;
      level: LogLevel;
      args: any[];
      timestamp: string;
      stack?: string;
    };

export interface RequestState {
  id: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBodySnippet?: string;
  requestBodyKind?: "formdata";
  requestFormParts?: FormDataPart[];
  responseBodySnippet?: string;
  durationMs?: number;
  startedAt: string;
  finishedAt?: string;
  isError?: boolean;
  errorMessage?: string;
}

export interface ConsoleLog {
  id: string;
  level: LogLevel;
  args: any[];
  timestamp: string;
  stack?: string;
}

export type FilterMethod = "ALL" | "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";
export type FilterStatus = "ALL" | "2xx" | "3xx" | "4xx" | "5xx" | "ERR";
export type FilterLogLevel = "ALL" | "log" | "warn" | "error" | "info" | "debug";

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
}

export interface ConnectionInfo {
  interfaces: NetworkInterfaceInfo[];
  port: number;
  connectedClients: number;
}

export interface FileTransferMessage {
  type: "file_transfer";
  transferId: string;
  status: "content" | "opened" | "error";
  fileName?: string;
  mimeType?: string;
  size?: number;
  base64?: string;
  error?: string;
}

export type CommandMessage =
  | {
      type: "command";
      command: "replay_request";
      payload: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
    /**
     * Multipart parts to rebuild on the device. When present the agent
     * reconstructs a FormData (re-reading files from their local uri) and
     * ignores `body`.
     */
        formParts?: FormDataPart[];
      };
    }
  | {
      type: "command";
      command: "request_file";
      payload: { transferId: string; uri: string; fileName?: string; mimeType?: string; maxBytes: number };
    }
  | {
      type: "command";
      command: "open_file";
      payload: { transferId: string; uri: string };
    };
