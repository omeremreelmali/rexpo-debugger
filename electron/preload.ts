import { contextBridge, ipcRenderer } from "electron";
import { NetworkMessage } from "./types";

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
});

// Type definition for window.electron
export interface ElectronAPI {
  onNetworkMessage: (callback: (message: NetworkMessage) => void) => void;
  removeNetworkMessageListener: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

