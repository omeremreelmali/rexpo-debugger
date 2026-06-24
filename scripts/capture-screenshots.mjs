#!/usr/bin/env node
/**
 * End-to-end screenshot capture for the Rexpo Debugger desktop UI.
 *
 * Connects to the running Electron app via two channels:
 *   1. Chrome DevTools Protocol on --remote-debugging-port=9222 — drives the
 *      renderer (theme toggles, tab switches, clicks, captures viewport).
 *   2. WebSocket as a fake mobile agent on ws://localhost:5051 — feeds the
 *      panels realistic dummy network + console data.
 *
 * Produces 4 scenes × 2 themes = 8 PNGs under assets/screenshots/.
 *
 *   1. Start vite:               npm run dev:vite (background)
 *   2. Start electron + cdp:     electron --remote-debugging-port=9222 .
 *   3. Run this script:          node scripts/capture-screenshots.mjs
 */
import { WebSocket } from "ws";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCollectionsSeed, sendInitialBurst } from "./dummy-payloads.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "assets", "screenshots");
const CDP_PORT = 9222;
const AGENT_URL = "ws://localhost:5051";
const RENDERER_URL_PREFIX = "http://localhost:5173";

mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[capture]", ...a);

// -----------------------------------------------------------------------------
// CDP client
// -----------------------------------------------------------------------------

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
    this.ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: ok, reject: err } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) err(new Error(msg.error.message));
        else ok(msg.result);
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(
        `eval failed: ${r.exceptionDetails.text}\n--- expression ---\n${expression}`
      );
    }
    return r.result?.value;
  }

  async screenshot(outPath) {
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(outPath, Buffer.from(r.data, "base64"));
    log("shot:", outPath);
  }

  async reload() {
    await this.send("Page.enable");
    await this.send("Page.reload", { ignoreCache: true });
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function findRendererWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${CDP_PORT}/json`);
      const targets = await res.json();
      const renderer = targets.find(
        (t) =>
          t.type === "page" &&
          (t.url.startsWith(RENDERER_URL_PREFIX) || t.url.startsWith("file://"))
      );
      if (renderer?.webSocketDebuggerUrl) return renderer.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error("Renderer not discoverable via CDP at port " + CDP_PORT);
}

async function waitForRendererReady(cdp) {
  for (let i = 0; i < 40; i++) {
    try {
      const ready = await cdp.eval(
        `!!document.querySelector('.tab-button') && !!document.querySelector('.filter-bar')`
      );
      if (ready) return;
    } catch {}
    await sleep(300);
  }
  throw new Error("Renderer DOM never became ready");
}

// -----------------------------------------------------------------------------
// Agent (WS client) — feeds dummy data into the desktop debugger
// -----------------------------------------------------------------------------

class FakeAgent {
  constructor(url) {
    this.url = url;
    this.ws = null;
  }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }
  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}

// -----------------------------------------------------------------------------
// Renderer driving helpers
// -----------------------------------------------------------------------------

async function applyPreReloadState(cdp, theme) {
  // Seed Collections + Settings into localStorage BEFORE reload so the
  // providers pick them up on init. autoClearOnInit is forced off so the
  // burst we'll send after reload isn't immediately wiped when the seed
  // (fake agent) reconnects.
  const collections = buildCollectionsSeed();
  const settings = {
    network: { maxRequestHistory: 200, autoClearOnInit: false },
    console: {
      maxLogHistory: 200,
      autoClearOnInit: false,
      // Filter values are uppercase per FilterLogLevel — "ALL" shows all
      // levels, anything else (e.g. "log") restricts the list.
      defaultLogLevel: "ALL",
    },
    connection: {
      port: 5051,
      autoDetectIp: true,
      manualWsUrl: "",
      preferredInterface: "",
    },
    agents: { networkEnabled: true, consoleEnabled: true },
    ui: { theme },
  };
  await cdp.eval(`
    localStorage.setItem('rexpo-debugger-collections', ${JSON.stringify(JSON.stringify(collections))});
    localStorage.setItem('rexpo-debugger-settings', ${JSON.stringify(JSON.stringify(settings))});
  `);
}

async function clickTab(cdp, label) {
  await cdp.eval(`
    (function() {
      const buttons = Array.from(document.querySelectorAll('.tab-button'));
      const t = buttons.find(b => b.textContent.trim().toLowerCase().includes(${JSON.stringify(label.toLowerCase())}));
      if (t) t.click();
    })()
  `);
  await sleep(200);
}

async function selectFirstInterestingRequest(cdp) {
  // Pick the GraphQL POST — it has a structured request body AND a deeply
  // nested response, so both the Request and Response tabs show real content.
  await cdp.eval(`
    (function() {
      const rows = Array.from(document.querySelectorAll('.network-row'));
      const graphql = rows.find(r => /graphql/i.test(r.textContent));
      const post200 = rows.find(r => /POST/.test(r.textContent) && /200/.test(r.textContent));
      const any200 = rows.find(r => /200/.test(r.textContent));
      const target = graphql || post200 || any200 || rows[0];
      if (target) target.click();
    })()
  `);
  await sleep(350);
  // Switch the details panel to the Response tab so the formatted JSON body
  // is visible — much more compelling than the default Overview summary.
  await cdp.eval(`
    (function() {
      const tabs = Array.from(document.querySelectorAll('.details-tabs .tab-button'));
      const t = tabs.find(b => /response/i.test(b.textContent));
      if (t) t.click();
    })()
  `);
  await sleep(250);
}

async function selectInterestingConsoleLog(cdp) {
  // Prefer an error log so the stack trace appears in the right pane.
  await cdp.eval(`
    (function() {
      const rows = Array.from(document.querySelectorAll('.console-row'));
      const error = rows.find(r => r.classList.contains('level-error'));
      const warn = rows.find(r => r.classList.contains('level-warn'));
      const target = error || warn || rows[Math.floor(rows.length / 2)];
      if (target) target.click();
    })()
  `);
  await sleep(350);
}

async function selectFirstSavedRequest(cdp) {
  // 1. Expand any collapsed group headers so all items are visible.
  await cdp.eval(`
    (function() {
      const carets = document.querySelectorAll('.collections-group-header .collections-group-caret');
      carets.forEach((c) => {
        // Collapsed carets show ▸ — click the parent header to expand.
        if (/▸|▶|►/.test(c.textContent)) {
          c.closest('.collections-group-header').click();
        }
      });
    })()
  `);
  await sleep(250);
  // 2. Click a meaningful saved request — prefer one with a description so
  //    the right-side detail panel shows rich info.
  await cdp.eval(`
    (function() {
      const items = Array.from(document.querySelectorAll('.collections-item'));
      if (items.length === 0) return;
      // Prefer the Checkout (Stripe) entry — it has a description in our seed.
      const checkout = items.find(el => /Checkout/.test(el.textContent));
      (checkout || items[0]).click();
    })()
  `);
  await sleep(350);
}

async function openSettings(cdp) {
  await cdp.eval(`
    const btn = document.querySelector('.settings-button');
    if (btn) btn.click();
  `);
  await sleep(300);
}

async function closeSettings(cdp) {
  await cdp.eval(`
    (function() {
      // Try common close patterns
      const close = document.querySelector('.settings-modal-close, [class*="modal-close"], [aria-label="Close"]');
      if (close) { close.click(); return; }
      // Fallback: press Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
    })()
  `);
  await sleep(250);
}

// -----------------------------------------------------------------------------
// Capture flow
// -----------------------------------------------------------------------------

async function captureForTheme(cdp, theme) {
  log(`=== theme: ${theme} ===`);

  await applyPreReloadState(cdp, theme);
  await cdp.reload();
  await sleep(800);
  await waitForRendererReady(cdp);
  // Belt-and-braces: also force-apply the theme attribute in case the
  // SettingsProvider race delays it.
  await cdp.eval(
    `document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});`
  );

  // Fresh agent connection per theme so the burst arrives cleanly into the
  // newly-reloaded renderer.
  const agent = new FakeAgent(AGENT_URL);
  await agent.connect();
  log("agent connected, sending initial burst…");
  await sendInitialBurst((msg) => agent.send(msg));
  // Let React render & state settle.
  await sleep(600);

  // 1. Network tab — pick a meaningful row so the details panel is populated.
  await clickTab(cdp, "network");
  await sleep(300);
  await selectFirstInterestingRequest(cdp);
  await sleep(400);
  await cdp.screenshot(resolve(OUT_DIR, `${theme}-network.png`));

  // 2. Console tab — pick the error log so the stack trace shows.
  await clickTab(cdp, "console");
  await sleep(300);
  await selectInterestingConsoleLog(cdp);
  await sleep(400);
  await cdp.screenshot(resolve(OUT_DIR, `${theme}-console.png`));

  // 3. Collections tab — already seeded via localStorage.
  await clickTab(cdp, "collections");
  await sleep(400);
  await selectFirstSavedRequest(cdp);
  await sleep(400);
  await cdp.screenshot(resolve(OUT_DIR, `${theme}-collections.png`));

  // 3b. State tab — stores arrive via the fake agent burst; StatePanel
  // auto-selects the first store so the JSON tree is populated.
  await clickTab(cdp, "state");
  await sleep(600);
  await cdp.screenshot(resolve(OUT_DIR, `${theme}-state.png`));

  // 4. Settings modal — opened on top of whichever tab is active.
  await clickTab(cdp, "network");
  await sleep(150);
  await openSettings(cdp);
  await sleep(500);
  await cdp.screenshot(resolve(OUT_DIR, `${theme}-settings.png`));
  await closeSettings(cdp);

  agent.close();
  // Tiny pause to let the close ripple through before we mutate state for next theme.
  await sleep(400);
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  log("looking for renderer at port", CDP_PORT, "…");
  const wsUrl = await findRendererWsUrl();
  log("renderer ws:", wsUrl);

  const cdp = new CDPClient(wsUrl);
  await cdp.open();
  await cdp.send("Page.enable");
  await waitForRendererReady(cdp);
  log("renderer ready");

  try {
    await captureForTheme(cdp, "dark");
    await captureForTheme(cdp, "light");
  } finally {
    cdp.close();
  }
  log("done — screenshots in", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
