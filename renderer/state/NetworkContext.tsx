import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from "react";
import { NetworkMessage, RequestState, FilterMethod, FilterStatus, ConsoleLog, FilterLogLevel } from "../types";
import { useSettings } from "./SettingsContext";

type TabType = "network" | "console" | "collections" | "state";

interface NetworkState {
  requests: RequestState[];
  consoleLogs: ConsoleLog[];
  selectedRequestId: string | null;
  selectedConsoleId: string | null;
  searchQuery: string;
  filterMethod: FilterMethod;
  filterStatus: FilterStatus;
  filterLogLevel: FilterLogLevel;
  isPaused: boolean;
  activeTab: TabType;
  // Max entries kept in memory before FIFO trimming. Driven by Settings.
  maxRequestHistory: number;
  maxLogHistory: number;
}

type NetworkAction =
  | { type: "ADD_MESSAGE"; payload: NetworkMessage }
  | { type: "SELECT_REQUEST"; payload: string | null }
  | { type: "SELECT_CONSOLE"; payload: string | null }
  | { type: "SET_SEARCH"; payload: string }
  | { type: "SET_FILTER_METHOD"; payload: FilterMethod }
  | { type: "SET_FILTER_STATUS"; payload: FilterStatus }
  | { type: "SET_FILTER_LOG_LEVEL"; payload: FilterLogLevel }
  | { type: "SET_ACTIVE_TAB"; payload: TabType }
  | { type: "TOGGLE_PAUSE" }
  | { type: "CLEAR_ALL" }
  | { type: "CLEAR_NETWORK" }
  | { type: "CLEAR_CONSOLE" }
  | { type: "DELETE_REQUEST"; payload: string }
  | { type: "DELETE_CONSOLE_LOG"; payload: string }
  | {
      type: "SET_LIMITS";
      payload: { maxRequestHistory: number; maxLogHistory: number };
    };

const initialState: NetworkState = {
  requests: [],
  consoleLogs: [],
  selectedRequestId: null,
  selectedConsoleId: null,
  searchQuery: "",
  filterMethod: "ALL",
  filterStatus: "ALL",
  filterLogLevel: "ALL",
  isPaused: false,
  activeTab: "network",
  maxRequestHistory: 1000,
  maxLogHistory: 1000,
};

function trimRequests(arr: RequestState[], max: number): RequestState[] {
  return arr.length > max ? arr.slice(0, max) : arr;
}

function trimLogs(arr: ConsoleLog[], max: number): ConsoleLog[] {
  return arr.length > max ? arr.slice(0, max) : arr;
}

function networkReducer(state: NetworkState, action: NetworkAction): NetworkState {
  switch (action.type) {
    case "ADD_MESSAGE": {
      if (state.isPaused) return state;

      const message = action.payload;

      // Handle console messages
      if (message.type === "console") {
        const newLog: ConsoleLog = {
          id: message.id,
          level: message.level,
          args: message.args,
          timestamp: message.timestamp,
          stack: message.stack,
        };
        return {
          ...state,
          consoleLogs: trimLogs([newLog, ...state.consoleLogs], state.maxLogHistory),
        };
      }

      // Handle network messages
      const existingIndex = state.requests.findIndex((r) => r.id === message.id);

      if (message.type === "request") {
        if (existingIndex >= 0) {
          // Update existing request
          const updated = [...state.requests];
          updated[existingIndex] = {
            ...updated[existingIndex],
            url: message.url,
            method: message.method,
            requestHeaders: message.requestHeaders,
            requestBodySnippet: message.requestBodySnippet,
            startedAt: message.startedAt,
          };
          return { ...state, requests: updated };
        } else {
          // Add new request
          const newRequest: RequestState = {
            id: message.id,
            url: message.url,
            method: message.method,
            requestHeaders: message.requestHeaders,
            requestBodySnippet: message.requestBodySnippet,
            startedAt: message.startedAt,
          };
          return {
            ...state,
            requests: trimRequests(
              [newRequest, ...state.requests],
              state.maxRequestHistory
            ),
          };
        }
      } else {
        // Response message
        if (existingIndex >= 0) {
          // Merge response into existing request
          const updated = [...state.requests];
          updated[existingIndex] = {
            ...updated[existingIndex],
            status: message.status,
            statusText: message.statusText,
            responseHeaders: message.responseHeaders,
            responseBodySnippet: message.responseBodySnippet,
            durationMs: message.durationMs,
            finishedAt: message.finishedAt,
            isError: message.isError,
            errorMessage: message.errorMessage,
          };
          return { ...state, requests: updated };
        } else {
          // Response arrived before request (edge case)
          const newRequest: RequestState = {
            id: message.id,
            url: message.url,
            method: "UNKNOWN",
            status: message.status,
            statusText: message.statusText,
            responseHeaders: message.responseHeaders,
            responseBodySnippet: message.responseBodySnippet,
            durationMs: message.durationMs,
            startedAt: message.finishedAt,
            finishedAt: message.finishedAt,
            isError: message.isError,
            errorMessage: message.errorMessage,
          };
          return {
            ...state,
            requests: trimRequests(
              [newRequest, ...state.requests],
              state.maxRequestHistory
            ),
          };
        }
      }
    }

    case "SELECT_REQUEST":
      return { ...state, selectedRequestId: action.payload };

    case "SELECT_CONSOLE":
      return { ...state, selectedConsoleId: action.payload };

    case "SET_SEARCH":
      return { ...state, searchQuery: action.payload };

    case "SET_FILTER_METHOD":
      return { ...state, filterMethod: action.payload };

    case "SET_FILTER_STATUS":
      return { ...state, filterStatus: action.payload };

    case "SET_FILTER_LOG_LEVEL":
      return { ...state, filterLogLevel: action.payload };

    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.payload };

    case "TOGGLE_PAUSE":
      return { ...state, isPaused: !state.isPaused };

    case "CLEAR_ALL":
      return { 
        ...state, 
        requests: [], 
        consoleLogs: [],
        selectedRequestId: null,
        selectedConsoleId: null,
      };

    case "CLEAR_NETWORK":
      return {
        ...state,
        requests: [],
        selectedRequestId: null,
      };

    case "CLEAR_CONSOLE":
      return {
        ...state,
        consoleLogs: [],
        selectedConsoleId: null,
      };

    case "DELETE_REQUEST":
      return {
        ...state,
        requests: state.requests.filter((r) => r.id !== action.payload),
        selectedRequestId:
          state.selectedRequestId === action.payload ? null : state.selectedRequestId,
      };

    case "DELETE_CONSOLE_LOG":
      return {
        ...state,
        consoleLogs: state.consoleLogs.filter((l) => l.id !== action.payload),
        selectedConsoleId:
          state.selectedConsoleId === action.payload ? null : state.selectedConsoleId,
      };

    case "SET_LIMITS":
      return {
        ...state,
        maxRequestHistory: action.payload.maxRequestHistory,
        maxLogHistory: action.payload.maxLogHistory,
        // Apply new limits immediately to existing data.
        requests: trimRequests(state.requests, action.payload.maxRequestHistory),
        consoleLogs: trimLogs(state.consoleLogs, action.payload.maxLogHistory),
      };

    default:
      return state;
  }
}

interface NetworkContextValue {
  state: NetworkState;
  dispatch: React.Dispatch<NetworkAction>;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(networkReducer, initialState);
  const { settings } = useSettings();

  // RED-158: incoming messages are filtered by agent enable/disable. We mirror
  // the relevant settings into a ref so the WS listener always reads the
  // current values without needing to be re-bound when settings change.
  const agentEnabledRef = useRef({
    network: settings.agents.networkEnabled,
    console: settings.agents.consoleEnabled,
  });
  useEffect(() => {
    agentEnabledRef.current = {
      network: settings.agents.networkEnabled,
      console: settings.agents.consoleEnabled,
    };
  }, [settings.agents.networkEnabled, settings.agents.consoleEnabled]);

  useEffect(() => {
    if (!window.electron) {
      console.warn("Electron API not available");
      return;
    }

    window.electron.onNetworkMessage((message: NetworkMessage) => {
      const flags = agentEnabledRef.current;
      if (message.type === "console" && !flags.console) return;
      if (
        (message.type === "request" || message.type === "response") &&
        !flags.network
      ) {
        return;
      }
      dispatch({ type: "ADD_MESSAGE", payload: message });
    });

    return () => {
      window.electron.removeNetworkMessageListener();
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ state, dispatch }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within NetworkProvider");
  }
  return context;
}

