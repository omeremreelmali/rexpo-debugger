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

/** A state-store snapshot pushed by the agent's state inspector. */
export interface StateMessage {
  type: "state";
  storeId: string;
  name: string;
  lib: "redux" | "zustand" | "custom";
  state: any;
  canSet: boolean;
  at: string;
}

/** Renderer-side view of a tracked store (latest snapshot). */
export interface StoreSnapshot {
  storeId: string;
  name: string;
  lib: "redux" | "zustand" | "custom";
  state: any;
  canSet: boolean;
  at: string;
}

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
}

export interface ConnectionInfo {
  interfaces: NetworkInterfaceInfo[];
  port: number;
  connectedClients: number;
}

export type CommandMessage = {
  type: "command";
  command: "replay_request";
  payload: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
  };
};
