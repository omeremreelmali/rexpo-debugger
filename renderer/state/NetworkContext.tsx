import React, { createContext, useContext, useReducer, useEffect, ReactNode } from "react";
import { NetworkMessage, RequestState, FilterMethod, FilterStatus, ConsoleLog, FilterLogLevel } from "../types";

type TabType = "network" | "console";

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
  | { type: "CLEAR_ALL" };

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
};

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
        return { ...state, consoleLogs: [newLog, ...state.consoleLogs] };
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
          return { ...state, requests: [newRequest, ...state.requests] };
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
          return { ...state, requests: [newRequest, ...state.requests] };
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

  useEffect(() => {
    if (!window.electron) {
      console.warn("Electron API not available");
      return;
    }

    window.electron.onNetworkMessage((message: NetworkMessage) => {
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

