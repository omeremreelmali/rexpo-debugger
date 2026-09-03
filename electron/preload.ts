import { contextBridge, ipcRenderer } from "electron";
import {
  NetworkMessage,
  CommandMessage,
  ConnectionInfo,
  StateMessage,
  FileTransferMessage,
} from "./types";

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld("electron", {
  onNetworkMessage: (callback: (message: NetworkMessage) => void) => {
    ipcRenderer.on("network-message", (_event, message: NetworkMessage) => {
      callback(message);
    });
  },
  removeNetworkMessageListener: () => {
    ipcRenderer.removeAllListeners("network-message");
  },
  sendCommand: (command: CommandMessage) => {
    ipcRenderer.send("send-command", command);
  },
  getConnectionInfo: (): Promise<ConnectionInfo> =>
    ipcRenderer.invoke("get-connection-info"),
  setMdnsEnabled: (enabled: boolean): Promise<{ mdnsRunning: boolean }> =>
    ipcRenderer.invoke("set-mdns-enabled", enabled),
  setNetworkPort: (
    port: number
  ): Promise<{ ok: boolean; port: number; error?: string }> =>
    ipcRenderer.invoke("set-network-port", port),
  saveResponseToFile: (payload: {
    defaultName: string;
    content: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<{
    ok: boolean;
    cancelled?: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
  }> => ipcRenderer.invoke("save-response-to-file", payload),
  saveBinaryFile: (payload: { defaultName: string; base64: string; mimeType?: string; openAfterSave?: boolean }) =>
    ipcRenderer.invoke("save-binary-file", payload),
  onFileTransfer: (callback: (message: FileTransferMessage) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: FileTransferMessage) => callback(message);
    ipcRenderer.on("file-transfer-message", listener);
    return () => ipcRenderer.removeListener("file-transfer-message", listener);
  },
  onConnectionStateChanged: (callback: (info: ConnectionInfo) => void) => {
    ipcRenderer.on("connection-state-changed", (_event, info: ConnectionInfo) => {
      callback(info);
    });
  },
  removeConnectionStateListener: () => {
    ipcRenderer.removeAllListeners("connection-state-changed");
  },
  onSessionStarted: (callback: () => void) => {
    ipcRenderer.on("session-started", () => callback());
  },
  removeSessionStartedListener: () => {
    ipcRenderer.removeAllListeners("session-started");
  },
  onStateMessage: (callback: (message: StateMessage) => void) => {
    ipcRenderer.on("state-message", (_event, message: StateMessage) => {
      callback(message);
    });
  },
  removeStateMessageListener: () => {
    ipcRenderer.removeAllListeners("state-message");
  },
});

// Type definition for window.electron
export interface ElectronAPI {
  onNetworkMessage: (callback: (message: NetworkMessage) => void) => void;
  removeNetworkMessageListener: () => void;
  sendCommand: (command: CommandMessage) => void;
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
  saveBinaryFile: (payload: { defaultName: string; base64: string; mimeType?: string; openAfterSave?: boolean }) => Promise<{
    ok: boolean; cancelled?: boolean; filePath?: string; error?: string;
  }>;
  onFileTransfer: (callback: (message: FileTransferMessage) => void) => () => void;
  onConnectionStateChanged: (callback: (info: ConnectionInfo) => void) => void;
  removeConnectionStateListener: () => void;
  onSessionStarted: (callback: () => void) => void;
  removeSessionStartedListener: () => void;
  onStateMessage: (callback: (message: StateMessage) => void) => void;
  removeStateMessageListener: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
