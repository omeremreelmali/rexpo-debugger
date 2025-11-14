import React, { createContext, useContext, useReducer, useEffect, ReactNode } from "react";
import { NetworkMessage, RequestState, FilterMethod, FilterStatus } from "../types";

interface NetworkState {
  requests: RequestState[];
  selectedRequestId: string | null;
  searchQuery: string;
  filterMethod: FilterMethod;
  filterStatus: FilterStatus;
  isPaused: boolean;
}

type NetworkAction =
  | { type: "ADD_MESSAGE"; payload: NetworkMessage }
  | { type: "SELECT_REQUEST"; payload: string | null }
  | { type: "SET_SEARCH"; payload: string }
  | { type: "SET_FILTER_METHOD"; payload: FilterMethod }
  | { type: "SET_FILTER_STATUS"; payload: FilterStatus }
  | { type: "TOGGLE_PAUSE" }
  | { type: "CLEAR_ALL" };

const initialState: NetworkState = {
  requests: [],
  selectedRequestId: null,
  searchQuery: "",
  filterMethod: "ALL",
  filterStatus: "ALL",
  isPaused: false,
};

function networkReducer(state: NetworkState, action: NetworkAction): NetworkState {
  switch (action.type) {
    case "ADD_MESSAGE": {
      if (state.isPaused) return state;

      const message = action.payload;
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

    case "SET_SEARCH":
      return { ...state, searchQuery: action.payload };

    case "SET_FILTER_METHOD":
      return { ...state, filterMethod: action.payload };

    case "SET_FILTER_STATUS":
      return { ...state, filterStatus: action.payload };

    case "TOGGLE_PAUSE":
      return { ...state, isPaused: !state.isPaused };

    case "CLEAR_ALL":
      return { ...state, requests: [], selectedRequestId: null };

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

