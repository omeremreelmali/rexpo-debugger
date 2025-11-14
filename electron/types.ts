// Shared types between Electron and Renderer

export type LogLevel = "log" | "warn" | "error" | "info" | "debug";

export type NetworkMessage =
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

