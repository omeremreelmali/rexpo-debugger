import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ConnectionInfo } from "./types";
import "./App.css";

// Type augmentation for window.electron
declare global {
  interface Window {
    electron: {
      onNetworkMessage: (callback: (message: any) => void) => void;
      removeNetworkMessageListener: () => void;
      sendCommand: (command: any) => void;
      getConnectionInfo: () => Promise<ConnectionInfo>;
      setMdnsEnabled: (enabled: boolean) => Promise<{ mdnsRunning: boolean }>;
      setNetworkPort: (
        port: number
      ) => Promise<{ ok: boolean; port: number; error?: string }>;
      saveResponseToFile: (payload: {
        defaultName: string;
        content: string;
        filters?: { name: string; extensions: string[] }[];
      }) => Promise<{
        ok: boolean;
        cancelled?: boolean;
        filePath?: string;
        fileName?: string;
        error?: string;
      }>;
      onConnectionStateChanged: (callback: (info: ConnectionInfo) => void) => void;
      removeConnectionStateListener: () => void;
      onSessionStarted: (callback: () => void) => void;
      removeSessionStartedListener: () => void;
      onStateMessage: (callback: (message: any) => void) => void;
      removeStateMessageListener: () => void;
    };
  }
}

/**
 * Apply the persisted theme synchronously, BEFORE React mounts, so the user
 * never sees a flash of the wrong theme. We deliberately read from
 * localStorage here instead of waiting for the SettingsContext to hydrate.
 */
(function applyThemeEarly() {
  try {
    const raw = localStorage.getItem("rexpo-debugger-settings");
    let theme = "dark";
    if (raw) {
      const parsed = JSON.parse(raw);
      theme = parsed?.ui?.theme || "dark";
    }
    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
        : theme;
    document.documentElement.setAttribute("data-theme", resolved);
  } catch {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

