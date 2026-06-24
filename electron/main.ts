import { app, BrowserWindow, dialog, ipcMain } from "electron";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { Bonjour, Service } from "bonjour-service";
import { CommandMessage, ConnectionInfo, NetworkInterfaceInfo } from "./types";

const DEFAULT_WS_PORT = 5051;
const MDNS_SERVICE_TYPE = "rexpo";
const MDNS_SERVICE_NAME = `Rexpo Debugger on ${os.hostname()}`;
const NETWORK_POLL_INTERVAL_MS = 5000;

let WS_PORT = DEFAULT_WS_PORT;
let mainWindow: BrowserWindow | null = null;
let wss: WebSocketServer | null = null;
let isRestarting = false;

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

/**
 * Connected-client count is derived live from `wss.clients` so it can't drift.
 * This avoids a class of races when the server is recreated during a port
 * restart: stale close events from the old server's clients can no longer
 * decrement the counter for the new server.
 */
function getConnectionInfo(): ConnectionInfo {
  return {
    interfaces: getLocalIPv4Addresses(),
    port: WS_PORT,
    connectedClients: wss?.clients.size ?? 0,
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

  // CRITICAL: Properly unpublish the previous service before re-publishing.
  //
  // Service.stop() is typed as optional in bonjour-service and is sometimes
  // undefined at runtime — using `.stop?.()` was silently a no-op, leaving
  // the old advertisement on the wire. After a few network changes we'd
  // accumulate stale services like:
  //   "Rexpo Debugger on apple-MacBook-Air-4-local"
  //   "Rexpo Debugger on apple-MacBook-Air-5-local"
  //   ...
  // each advertising stale addresses (e.g. a VPN tunnel IP that no longer
  // exists). Clients (iOS Simulator zeroconf, etc.) would resolve to one of
  // those stale entries and fail to connect.
  //
  // `bonjour.unpublishAll()` is authoritative — it sends "goodbye" packets
  // for every service this Bonjour instance owns, evicting them from the
  // network cache. We then publish a single fresh service.
  try {
    bonjour.unpublishAll();
  } catch (err) {
    console.error("[Inspector] unpublishAll failed (continuing):", err);
  }
  publishedService = null;

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

function resolveIconPath(): string {
  // In dev (tsc output at dist/electron/main.js): ../../assets/<file>
  // In packaged builds: electron-builder bundles the icon directly via the
  // build.{mac,win,linux}.icon config, so this runtime path is only used for
  // the BrowserWindow icon prop (Win/Linux) and app.dock.setIcon (macOS).
  const file =
    process.platform === "win32" ? "icon.ico" : "icon.png";
  return path.join(__dirname, "..", "..", "assets", file);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Rexpo Network Inspector",
    icon: resolveIconPath(),
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

/**
 * Attaches all WS event handlers to a WebSocketServer instance.
 * Called both for the initial server and any new server created during a
 * port-restart.
 */
function attachWebSocketListeners(server: WebSocketServer) {
  server.on("connection", (ws: WebSocket) => {
    console.log(`[Inspector] Client connected (total: ${server.clients.size})`);
    broadcastConnectionState();

    // Signal to the renderer that a fresh agent connection (i.e. app init or
    // reload) just happened. The renderer's auto-clear behaviour (RED-157)
    // listens to this event.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("session-started");
    }

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as { type?: string };

        if (mainWindow && !mainWindow.isDestroyed()) {
          // State snapshots ride a dedicated channel so the network reducer
          // never sees them; everything else stays on "network-message".
          if (message?.type === "state") {
            mainWindow.webContents.send("state-message", message);
          } else {
            mainWindow.webContents.send("network-message", message);
          }
        }
      } catch (error) {
        console.error("[Inspector] Failed to parse message:", error);
      }
    });

    ws.on("close", () => {
      // Defer one tick so `server.clients` has already removed this socket and
      // the count we read is the post-removal value. Also: the count we read
      // here is always for the SERVER this client was connected to, so a stale
      // close event from an old (port-restart) server cannot affect the count
      // shown to the renderer (which is computed from the live `wss`).
      setImmediate(() => {
        console.log(`[Inspector] Client disconnected (total: ${server.clients.size})`);
        broadcastConnectionState();
      });
    });

    ws.on("error", (error) => {
      console.error("[Inspector] WebSocket error:", error);
    });
  });

  server.on("error", (error) => {
    console.error("[Inspector] WebSocket server error:", error);
  });
}

/**
 * Binds a fresh WebSocketServer on the given port and resolves once it is
 * listening, or rejects with the bind error (e.g. EADDRINUSE).
 */
function bindWebSocketServer(port: number): Promise<WebSocketServer> {
  return new Promise((resolve, reject) => {
    const server = new WebSocketServer({ port });
    const onListening = () => {
      server.off("error", onError);
      resolve(server);
    };
    const onError = (err: Error) => {
      server.off("listening", onListening);
      reject(err);
    };
    server.once("listening", onListening);
    server.once("error", onError);
  });
}

async function startInitialWebSocketServer() {
  try {
    wss = await bindWebSocketServer(WS_PORT);
    attachWebSocketListeners(wss);

    const ips = getLocalIPv4Addresses();
    if (ips.length > 0) {
      console.log(`[Inspector] WebSocket server started on port ${WS_PORT}`);
      for (const iface of ips) {
        console.log(`[Inspector]   ws://${iface.address}:${WS_PORT}  (${iface.name})`);
      }
    } else {
      console.log(
        `[Inspector] WebSocket server started on ws://localhost:${WS_PORT} (no external IPv4 found)`
      );
    }
  } catch (err) {
    console.error(`[Inspector] Failed to bind initial WebSocket server on ${WS_PORT}:`, err);
  }
}

/**
 * Switches the WebSocket server to a new port without restarting the app.
 *
 * Safety: tries to bind the new port FIRST. Only if that succeeds do we tear
 * down the old server. If the new port is already in use, the existing server
 * keeps running on the old port and an error is returned to the renderer.
 */
async function setNetworkPort(
  newPort: number
): Promise<{ ok: boolean; port: number; error?: string }> {
  if (isRestarting) {
    return { ok: false, port: WS_PORT, error: "A restart is already in progress" };
  }
  if (!Number.isInteger(newPort) || newPort < 1024 || newPort > 65535) {
    return { ok: false, port: WS_PORT, error: "Port must be between 1024 and 65535" };
  }
  if (newPort === WS_PORT) {
    return { ok: true, port: WS_PORT };
  }

  isRestarting = true;
  try {
    // 1. Try to bind the new port. If this fails, the old server is untouched.
    const newServer = await bindWebSocketServer(newPort);
    attachWebSocketListeners(newServer);

    // 2. Swap references and update the port BEFORE closing the old server so
    //    any IPC calls that read WS_PORT/wss in the meantime see consistent state.
    const oldServer = wss;
    wss = newServer;
    WS_PORT = newPort;

    // 3. Gracefully close the old server. Existing clients get a close event.
    if (oldServer) {
      try {
        oldServer.close();
      } catch (err) {
        console.error("[Inspector] Error closing old WS server:", err);
      }
    }

    // 4. Re-publish mDNS on the new port if it was running.
    if (bonjour) {
      publishMdnsService();
    }

    console.log(`[Inspector] WebSocket server moved to port ${WS_PORT}`);
    broadcastConnectionState();
    return { ok: true, port: WS_PORT };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Inspector] Failed to bind port ${newPort}:`, message);
    return { ok: false, port: WS_PORT, error: message };
  } finally {
    isRestarting = false;
  }
}

/**
 * Registers all IPC handlers. Called once on app startup — must not be called
 * during a port restart, otherwise handlers would be double-registered and
 * each one would fire twice.
 */
function registerIpcHandlers() {
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

  ipcMain.handle("set-mdns-enabled", (_event, enabled: boolean) => {
    if (enabled) {
      // Re-publish only if not already publishing
      if (!publishedService) {
        startMdns();
      }
    } else {
      stopMdns();
    }
    return { mdnsRunning: publishedService !== null };
  });

  ipcMain.handle("set-network-port", async (_event, port: number) => {
    return await setNetworkPort(port);
  });

  ipcMain.handle(
    "save-response-to-file",
    async (
      _event,
      payload: { defaultName: string; content: string; filters?: { name: string; extensions: string[] }[] }
    ): Promise<{ ok: boolean; cancelled?: boolean; filePath?: string; fileName?: string; error?: string }> => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return { ok: false, error: "No active window" };
      }
      try {
        const result = await dialog.showSaveDialog(mainWindow, {
          title: "Save response",
          defaultPath: payload.defaultName,
          filters: payload.filters && payload.filters.length > 0
            ? payload.filters
            : [{ name: "All files", extensions: ["*"] }],
        });
        if (result.canceled || !result.filePath) {
          return { ok: false, cancelled: true };
        }
        await fs.promises.writeFile(result.filePath, payload.content, "utf-8");
        return {
          ok: true,
          filePath: result.filePath,
          fileName: path.basename(result.filePath),
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}

app.whenReady().then(async () => {
  // macOS shows the dock icon from the packaged .app bundle in production, but
  // in `npm run dev` it falls back to the Electron framework icon unless we
  // set it explicitly here.
  if (process.platform === "darwin" && app.dock) {
    try {
      app.dock.setIcon(path.join(__dirname, "..", "..", "assets", "icon.png"));
    } catch (err) {
      console.error("[Inspector] Failed to set dock icon:", err);
    }
  }

  createWindow();
  registerIpcHandlers();
  await startInitialWebSocketServer();
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
