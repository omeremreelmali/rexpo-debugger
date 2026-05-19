import { contextBridge, ipcRenderer } from "electron";
import { NetworkMessage, CommandMessage, ConnectionInfo } from "./types";

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
  onConnectionStateChanged: (callback: (info: ConnectionInfo) => void) => {
    ipcRenderer.on("connection-state-changed", (_event, info: ConnectionInfo) => {
      callback(info);
    });
  },
  removeConnectionStateListener: () => {
    ipcRenderer.removeAllListeners("connection-state-changed");
  },
});

// Type definition for window.electron
export interface ElectronAPI {
  onNetworkMessage: (callback: (message: NetworkMessage) => void) => void;
  removeNetworkMessageListener: () => void;
  sendCommand: (command: CommandMessage) => void;
  getConnectionInfo: () => Promise<ConnectionInfo>;
  onConnectionStateChanged: (callback: (info: ConnectionInfo) => void) => void;
  removeConnectionStateListener: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

