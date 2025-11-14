import { app, BrowserWindow } from "electron";
import * as path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { NetworkMessage } from "./types";

const WS_PORT = 5051;
let mainWindow: BrowserWindow | null = null;
let wss: WebSocketServer | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Rexpo Network Inspector",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load renderer
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function startWebSocketServer() {
  wss = new WebSocketServer({ port: WS_PORT });

  console.log(`[Inspector] WebSocket server started on ws://localhost:${WS_PORT}`);

  wss.on("connection", (ws: WebSocket) => {
    console.log("[Inspector] Client connected");

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as NetworkMessage;
        
        // Forward message to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("network-message", message);
        }
      } catch (error) {
        console.error("[Inspector] Failed to parse message:", error);
      }
    });

    ws.on("close", () => {
      console.log("[Inspector] Client disconnected");
    });

    ws.on("error", (error) => {
      console.error("[Inspector] WebSocket error:", error);
    });
  });

  wss.on("error", (error) => {
    console.error("[Inspector] WebSocket server error:", error);
  });
}

app.whenReady().then(() => {
  createWindow();
  startWebSocketServer();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  if (wss) {
    wss.close();
  }
});

