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
      onConnectionStateChanged: (callback: (info: ConnectionInfo) => void) => void;
      removeConnectionStateListener: () => void;
      onSessionStarted: (callback: () => void) => void;
      removeSessionStartedListener: () => void;
    };
  }
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

