import { contextBridge, ipcRenderer } from "electron";
import { NetworkMessage, CommandMessage } from "./types";

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
});

// Type definition for window.electron
export interface ElectronAPI {
  onNetworkMessage: (callback: (message: NetworkMessage) => void) => void;
  removeNetworkMessageListener: () => void;
  sendCommand: (command: CommandMessage) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

