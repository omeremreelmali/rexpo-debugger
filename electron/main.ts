import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as os from "os";
import { WebSocketServer, WebSocket } from "ws";
import { Bonjour, Service } from "bonjour-service";
import { NetworkMessage, CommandMessage, ConnectionInfo, NetworkInterfaceInfo } from "./types";

const WS_PORT = 5051;
const MDNS_SERVICE_TYPE = "rexpo";
const MDNS_SERVICE_NAME = `Rexpo Debugger on ${os.hostname()}`;
const NETWORK_POLL_INTERVAL_MS = 5000;

let mainWindow: BrowserWindow | null = null;
let wss: WebSocketServer | null = null;
let connectedClientCount = 0;

let bonjour: Bonjour | null = null;
let publishedService: Service | null = null;
let lastInterfaceSignature = "";
let networkPollTimer: NodeJS.Timeout | null = null;

function getLocalIPv4Addresses(): NetworkInterfaceInfo[] {
  const interfaces = os.networkInterfaces();
  const result: NetworkInterfaceInfo[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== "IPv4") continue;
      if (addr.internal) continue;
      // Skip link-local (169.254.x.x) — typically not reachable from another device
      if (addr.address.startsWith("169.254.")) continue;
      result.push({ name, address: addr.address });
    }
  }

  return result;
}

function getConnectionInfo(): ConnectionInfo {
  return {
    interfaces: getLocalIPv4Addresses(),
    port: WS_PORT,
    connectedClients: connectedClientCount,
  };
}

function broadcastConnectionState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("connection-state-changed", getConnectionInfo());
  }
}

function interfaceSignature(): string {
  return getLocalIPv4Addresses()
    .map((i) => `${i.name}:${i.address}`)
    .sort()
    .join("|");
}

function publishMdnsService() {
  if (!bonjour) return;

  // Tear down existing publication first
  if (publishedService) {
    try {
      publishedService.stop?.();
    } catch (err) {
      console.error("[Inspector] Failed to stop previous mDNS service:", err);
    }
    publishedService = null;
  }

  try {
    publishedService = bonjour.publish({
      name: MDNS_SERVICE_NAME,
      type: MDNS_SERVICE_TYPE,
      port: WS_PORT,
      protocol: "tcp",
      txt: {
        version: app.getVersion(),
        hostname: os.hostname(),
      },
    });
    console.log(
      `[Inspector] mDNS service published: ${MDNS_SERVICE_NAME} (_${MDNS_SERVICE_TYPE}._tcp on port ${WS_PORT})`
    );
  } catch (err) {
    console.error("[Inspector] Failed to publish mDNS service:", err);
  }
}

function startNetworkPolling() {
  // Track interface changes — when Wi-Fi changes or VPN toggles, re-publish so
  // mDNS announcements bind to the new IP and the renderer chip refreshes.
  lastInterfaceSignature = interfaceSignature();

  networkPollTimer = setInterval(() => {
    const current = interfaceSignature();
    if (current !== lastInterfaceSignature) {
      console.log("[Inspector] Network interfaces changed — re-publishing mDNS service");
      lastInterfaceSignature = current;
      publishMdnsService();
      broadcastConnectionState();
    }
  }, NETWORK_POLL_INTERVAL_MS);
}

function startMdns() {
  try {
    bonjour = new Bonjour();
    publishMdnsService();
    startNetworkPolling();
  } catch (err) {
    console.error("[Inspector] Failed to start Bonjour/mDNS:", err);
  }
}

function stopMdns() {
  if (networkPollTimer) {
    clearInterval(networkPollTimer);
    networkPollTimer = null;
  }
  if (publishedService) {
    try {
      publishedService.stop?.();
    } catch {
      // ignore
    }
    publishedService = null;
  }
  if (bonjour) {
    try {
      bonjour.unpublishAll();
      bonjour.destroy();
    } catch {
      // ignore
    }
    bonjour = null;
  }
}

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

  ipcMain.on("send-command", (_event, command: CommandMessage) => {
    if (wss) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(command));
        }
      });
    }
  });

  ipcMain.handle("get-connection-info", () => getConnectionInfo());

  const ips = getLocalIPv4Addresses();
  if (ips.length > 0) {
    console.log(`[Inspector] WebSocket server started on port ${WS_PORT}`);
    for (const iface of ips) {
      console.log(`[Inspector]   ws://${iface.address}:${WS_PORT}  (${iface.name})`);
    }
  } else {
    console.log(`[Inspector] WebSocket server started on ws://localhost:${WS_PORT} (no external IPv4 found)`);
  }

  wss.on("connection", (ws: WebSocket) => {
    connectedClientCount += 1;
    console.log(`[Inspector] Client connected (total: ${connectedClientCount})`);
    broadcastConnectionState();

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
      connectedClientCount = Math.max(0, connectedClientCount - 1);
      console.log(`[Inspector] Client disconnected (total: ${connectedClientCount})`);
      broadcastConnectionState();
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
  startMdns();

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
  stopMdns();
  if (wss) {
    wss.close();
  }
});

