#!/usr/bin/env node
/**
 * End-to-end check of the packaged desktop app and the real agent code.
 *
 * Drives the app over CDP on throwaway profiles, so saved data is never touched.
 * The agent runs in a child process, under Node rather than React Native.
 *
 *   npm run build && npx electron-builder --mac --dir -c.mac.identity=null
 *   npm run test:e2e
 *
 * Override the app binary with REXPO_APP_BIN. Exits non-zero if a check fails.
 */
const http = require("http");
const net = require("net");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { spawn, fork, execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "rexpo-e2e-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Child: the real agent inside a stand-in app ─────────────────────────────
if (process.argv[2] === "--agent-child") {
  const [, , , agentDir, host] = process.argv;
  const silent = () => {};
  console.log = console.info = console.warn = console.error = console.debug = silent;
  global.__DEV__ = true;
  const ws = "ws://127.0.0.1:5051";
  const { initNetworkAgent, addAxiosInstance } = require(`${agentDir}/agent.js`);
  const { initConsoleAgent } = require(`${agentDir}/console-agent.js`);
  const { initStateAgent } = require(`${agentDir}/state-agent.js`);
  const axiosModule = require(path.join(ROOT, "node_modules/axios"));
  const axios = axiosModule.default || axiosModule;
  const commands = {
    async start() {
      initNetworkAgent({ wsUrl: ws });
      await Promise.all(["/start1", "/start2", "/start3"].map((p) => fetch(host + p)));
      initConsoleAgent({ wsUrl: ws });
      console.log("startup-log");
      initStateAgent({ wsUrl: ws });
    },
    fetch: (p) => fetch(host + p).then(() => true),
    async stream() {
      return Promise.race([fetch(`${host}/sse`).then(() => "resolved"), sleep(3000).then(() => "pending")]);
    },
    post: ({ p, body }) => fetch(host + p, { method: "POST", body, headers: { "content-type": "application/json" } }).then(() => true),
    async axios() {
      const client = axios.create({ baseURL: host });
      addAxiosInstance(client);
      await client.get("/ax", { params: { q: 1 } });
      await client.get("/ax404").catch(() => {});
    },
  };
  process.on("message", async ({ id, cmd, arg }) => {
    const result = await commands[cmd](arg).catch((e) => `error: ${e.message}`);
    process.send({ id, result });
  });
  process.send({ ready: true });
  return;
}

// ─── Parent ──────────────────────────────────────────────────────────────────
const WebSocket = require("ws");
const out = (line) => process.stdout.write(`${line}\n`);
let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  out(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== "" ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail)})` : ""}`);
}

const BIN =
  process.env.REXPO_APP_BIN ||
  path.join(ROOT, "release/mac-arm64/Rexpo Network Inspector.app/Contents/MacOS/Rexpo Network Inspector");
const FLAGS = [
  "--remote-debugging-port=9222",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-background-timer-throttling",
];

let app;
let cdp;
let seq = 0;
const pendingCdp = new Map();
let pageErrors = [];

function launch(profile) {
  app = spawn(BIN, [`--user-data-dir=${profile}`, ...FLAGS], { stdio: "ignore" });
}
async function quit() {
  cdp?.close();
  const started = Date.now();
  const exited = new Promise((r) => app.once("exit", () => r(true)));
  app.kill("SIGTERM");
  const clean = await Promise.race([exited, sleep(15000).then(() => false)]);
  check("app quits within 15s", clean, `${Date.now() - started}ms`);
  if (!clean) app.kill("SIGKILL");
}
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq;
    pendingCdp.set(id, resolve);
    cdp.send(JSON.stringify({ id, method, params }));
  });
async function attach() {
  let page;
  // The first launch of a freshly signed app can spend a while in Gatekeeper.
  for (let i = 0; i < 200 && !page; i++) {
    try {
      page = (await (await fetch("http://127.0.0.1:9222/json")).json()).find((t) => t.type === "page");
    } catch {}
    if (!page) await sleep(300);
  }
  if (!page) throw new Error("App did not start");
  cdp = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => cdp.once("open", r));
  cdp.on("message", (data) => {
    const m = JSON.parse(data);
    if (m.method === "Runtime.exceptionThrown") {
      pageErrors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split("\n")[0]);
    }
    if (pendingCdp.has(m.id)) {
      pendingCdp.get(m.id)(m);
      pendingCdp.delete(m.id);
    }
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await sleep(1500);
}
async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(`Page script failed: ${expression.slice(0, 80)}`);
  return r.result?.result?.value;
}
const reload = async () => {
  await send("Page.reload", { ignoreCache: true });
  await sleep(1200);
};
const alive = () => ev(`!!document.querySelector('.tab-navigation')`);
const rows = () => ev(`document.querySelectorAll('.network-row').length`);
const rowText = (match) =>
  ev(`[...document.querySelectorAll('.network-row')].filter(r=>${match}.test(r.textContent)).map(r=>r.innerText.replace(/\\s+/g,' '))`);
const clickRow = (match) => ev(`[...document.querySelectorAll('.network-row')].find(r=>${match}.test(r.textContent)).click()`);
const tab = (name) => ev(`[...document.querySelectorAll('.tab-navigation .tab-button')].find(b=>b.textContent.toLowerCase().includes('${name}'))?.click()`);
const toasts = () => ev(`[...document.querySelectorAll('.toast')].map(t=>t.innerText).join(' | ')`);
const setSettings = (value) => ev(`localStorage.setItem('rexpo-debugger-settings', ${JSON.stringify(JSON.stringify(value))})`);

async function client(port = 5051, options) {
  const c = new WebSocket(`ws://127.0.0.1:${port}`, options);
  c.got = [];
  c.on("message", (d) => c.got.push(JSON.parse(d)));
  c.on("error", () => {});
  await new Promise((resolve, reject) => {
    c.once("open", resolve);
    c.once("error", reject);
  });
  await sleep(150);
  return c;
}
const reqMsg = (id, extra = {}) => ({
  type: "request",
  id,
  url: `https://example.test/${id}`,
  method: "GET",
  requestHeaders: { authorization: "Bearer secret" },
  startedAt: new Date().toISOString(),
  ...extra,
});
const resMsg = (id, status = 200) => ({
  type: "response",
  id,
  url: `https://example.test/${id}`,
  status,
  statusText: "OK",
  durationMs: 5,
  finishedAt: new Date().toISOString(),
  isError: false,
});
const tx = (c, m) => c.send(JSON.stringify(m));

// The origin the agent talks to.
const seen = {};
let lastBody = null;
const origin = http.createServer((q, s) => {
  let body = "";
  q.on("data", (d) => (body += d));
  q.on("end", () => {
    seen[q.url] = { headers: q.headers };
    if (q.url === "/big") lastBody = body;
    if (q.url === "/small") lastBody = body;
    if (q.url === "/sse") {
      s.writeHead(200, { "content-type": "text/event-stream" });
      s.write("data: 1\n\n");
      return;
    }
    if (q.url === "/ax404") {
      s.writeHead(404, { "content-type": "application/json" });
      s.end('{"e":1}');
      return;
    }
    s.writeHead(200, { "content-type": "application/json" });
    s.end('{"ok":true}');
  });
});

async function agentChecks() {
  const agentDir = path.join(TMP, "agent");
  execSync(`npx tsc --outDir "${agentDir}"`, { cwd: path.join(ROOT, "expo-agent"), stdio: "ignore" });
  const host = `http://127.0.0.1:${origin.address().port}`;
  const child = fork(__filename, ["--agent-child", agentDir, host], { silent: true });
  await new Promise((r) => child.once("message", r));
  let id = 0;
  const call = (cmd, arg) =>
    new Promise((resolve) => {
      const callId = ++id;
      const onMessage = (m) => {
        if (m.id === callId) {
          child.off("message", onMessage);
          resolve(m.result);
        }
      };
      child.on("message", onMessage);
      child.send({ id: callId, cmd, arg });
    });

  out("\n# Real agent, default settings");
  await call("start");
  await sleep(1500);
  check("startup requests survive the other agents connecting", (await rows()) === 3, await rows());
  await tab("console");
  await sleep(150);
  check("startup console log arrives", (await ev(`document.querySelectorAll('.console-row').length`)) === 1);
  await tab("network");

  await call("fetch", "/keep");
  await sleep(300);
  const before = await rows();
  const second = await client();
  await sleep(300);
  check("a second device connecting keeps existing requests", (await rows()) === before, `${before} -> ${await rows()}`);
  second.close();

  check("fetch of a never-ending stream returns to the app", (await call("stream")) === "resolved");
  await sleep(300);
  check("stream response is recorded without reading it", (await rowText("/sse/")).some((r) => / 200 /.test(r)));

  const big = JSON.stringify({ a: "x".repeat(5000) });
  await call("post", { p: "/big", body: big });
  await sleep(300);
  await clickRow("/\\/big/");
  await sleep(150);
  lastBody = null;
  await ev(`document.querySelector('.replay-request-button').click()`);
  await sleep(500);
  check("replay of a truncated body is refused", lastBody === null && /truncated/.test(await toasts()), await toasts());

  await call("post", { p: "/small", body: '{"a":1}' });
  await sleep(300);
  await clickRow("/\\/small/");
  await sleep(150);
  lastBody = null;
  await ev(`document.querySelector('.replay-request-button').click()`);
  await sleep(500);
  check("replay of a complete body reaches the server intact", lastBody === '{"a":1}', lastBody);

  await call("axios");
  await sleep(400);
  const ax404 = await rowText("/ax404/");
  check("axios 404 shows its status", ax404.some((r) => / 404 /.test(r)), ax404);
  const axOk = await rowText("/\\/ax\\?/");
  check("axios URL includes params", axOk.some((r) => r.includes("/ax?q=1")), axOk);
  check("axios requests carry no injected header", !seen["/ax?q=1"]?.headers["x-network-inspector-id"]);

  child.kill();
  await sleep(300);
}

async function clientChecks() {
  out("\n# Pause and filters");
  await setSettings({ network: { autoClearOnInit: false }, console: { autoClearOnInit: false } });
  await reload();
  const a = await client();
  tx(a, reqMsg("p1"));
  await sleep(150);
  await ev(`document.querySelector('.pause-button').click()`);
  await sleep(50);
  tx(a, resMsg("p1"));
  tx(a, reqMsg("p2"));
  await sleep(150);
  await ev(`document.querySelector('.pause-button').click()`);
  await sleep(50);
  tx(a, resMsg("p2"));
  await sleep(200);
  check("a response during pause completes its request", (await rowText("/p1/")).some((r) => / 200 /.test(r)));
  check("a request dropped during pause leaves no UNKNOWN row", (await rowText("/p2/")).length === 0);
  tx(a, reqMsg("pend"));
  await sleep(150);
  await ev(`[...document.querySelectorAll('.filter-chip')].find(b=>b.textContent==='ERR').click()`);
  await sleep(100);
  check("ERR filter leaves out pending requests", (await rows()) === 0, await rows());
  await ev(`[...document.querySelectorAll('.filter-chip')].filter(b=>b.textContent==='ALL').pop().click()`);

  out("\n# Command routing");
  tx(a, reqMsg("r1"));
  await sleep(150);
  await clickRow("/r1/");
  await sleep(100);
  a.close();
  await sleep(200);
  await ev(`document.querySelector('.replay-request-button').click()`);
  await sleep(300);
  check("replay with no app connected says so", /No connected app/.test(await toasts()), await toasts());
  await ev(`[...document.querySelectorAll('.network-row')].find(r=>/r1/.test(r.textContent)).click()`);
  const b = await client();
  await ev(`document.querySelector('.replay-request-button').click()`);
  await sleep(300);
  check("replay reaches the app after it reconnects", b.got.length === 1, b.got.length);

  tx(b, reqMsg("up", { url: "https://example.test/up", method: "POST", requestBodyKind: "formdata", requestFormParts: [{ name: "a", kind: "file", uri: "file:///a.jpg", fileName: "a.jpg" }] }));
  await sleep(200);
  await clickRow("/\\/up/");
  await sleep(100);
  await ev(`[...document.querySelectorAll('.details-tabs .tab-button')].find(t=>/^request$/i.test(t.textContent.trim())).click()`);
  await sleep(200);
  b.close();
  await sleep(200);
  await ev(`[...document.querySelectorAll('.formdata-actions button')].find(x=>/Preview/.test(x.textContent)).click()`);
  await sleep(400);
  check("file action with no app connected fails with a message", /No connected app/.test(await ev(`document.querySelector('.formdata-file-error')?.textContent ?? ''`)));

  await ev(`localStorage.setItem('rexpo-debugger-collections', ${JSON.stringify(JSON.stringify({ savedRequests: [{ id: "s1", method: "POST", url: "https://example.test/save", headers: { authorization: "Bearer TOKEN" }, body: "{}", createdAt: new Date().toISOString(), collectionName: "c" }], collections: ["c"] }))})`);
  await reload();
  const d1 = await client();
  const d2 = await client();
  tx(d1, reqMsg("d1"));
  await sleep(50);
  tx(d2, reqMsg("d2"));
  await sleep(150);
  await tab("collections");
  await sleep(200);
  await ev(`document.querySelector('.collections-item').click()`);
  await sleep(150);
  await ev(`document.querySelector('.saved-details-action.primary').click()`);
  await sleep(300);
  check("saved replay goes to one device, not all", d1.got.length + d2.got.length === 1, [d1.got.length, d2.got.length]);
  d1.close();
  d2.close();
  await tab("network");

  out("\n# Connection policy");
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i.family === "IPv4" && !i.internal)?.address;
  const connects = (url, opts) =>
    new Promise((resolve) => {
      const c = new WebSocket(url, opts);
      c.once("open", () => {
        c.close();
        resolve(true);
      });
      c.once("error", () => resolve(false));
    });
  check("a web page's Origin is refused", !(await connects(`ws://${lan}:5051`, { origin: "https://evil.example" })));
  check("no Origin (native client) is accepted", await connects(`ws://${lan}:5051`));
  check("Origin naming the dialed host (React Native) is accepted", await connects(`ws://${lan}:5051`, { origin: `http://${lan}:5051` }));
  check("localhost Origin (Expo web) is accepted", await connects("ws://127.0.0.1:5051", { origin: "http://localhost:8081" }));
  check("agent kind query string is accepted", await connects("ws://127.0.0.1:5051/?agent=network"));

  out("\n# Malformed messages");
  const bad = [
    ["request without method", { type: "request", id: "m1", url: "u" }],
    ["request with numeric method", { type: "request", id: "m2", url: "u", method: 5 }],
    ["request with object header values", { type: "request", id: "m3", url: "u", method: "GET", requestHeaders: { a: { b: 1 } } }, "select"],
    ["response with object fields", { type: "request", id: "m4", url: "u", method: "GET" }, "select", { type: "response", id: "m4", status: "x", statusText: { a: 1 }, durationMs: "y", errorMessage: {} }],
    ["response with only an id", { type: "response", id: "m5" }],
    ["console without fields", { type: "console", id: "m6" }, "console"],
    ["console with string args", { type: "console", id: "m7", level: "log", args: "x", timestamp: "t" }, "console"],
    ["state without a name", { type: "state", storeId: "s" }, "state"],
    ["state without a store id", { type: "state" }, "state"],
    ["unknown type", { type: "zzz", id: "m8" }],
    ["form parts of the wrong type", { type: "request", id: "m9", url: "u", method: "POST", requestFormParts: "nope" }, "select"],
  ];
  for (const [name, msg, after, followUp] of bad) {
    await reload();
    pageErrors = [];
    const m = await client();
    tx(m, msg);
    if (followUp) tx(m, followUp);
    await sleep(200);
    if (after === "select") await ev(`document.querySelector('.network-row')?.click()`);
    else if (after) await tab(after);
    await sleep(200);
    check(name, (await alive()) && pageErrors.length === 0, pageErrors[0] ?? "");
    m.close();
    await sleep(100);
  }
  for (const raw of ["null", "5", "[1,2]", "{not json"]) {
    const m = await client();
    m.send(raw);
    await sleep(100);
    m.close();
  }
  check("non-object frames are ignored", await alive());
}

async function portChecks(profile) {
  out("\n# Port handling");
  await setSettings({});
  await reload();
  const old = await client();
  const moved = await ev(`window.electron.setNetworkPort(5062)`);
  check("port change succeeds", moved.ok === true, moved);
  await sleep(600);
  check("port change disconnects clients so they can move", old.readyState !== WebSocket.OPEN, old.readyState);
  await setSettings({ connection: { port: 5062 } });
  await sleep(1500);
  await quit();

  launch(profile);
  await attach();
  await sleep(500);
  check("saved port applies on launch", (await ev(`window.electron.getConnectionInfo().then(i=>i.port)`)) === 5062);

  const second = spawn(BIN, [`--user-data-dir=${profile}`], { stdio: "ignore" });
  const exited = await Promise.race([new Promise((r) => second.once("exit", () => r(true))), sleep(6000).then(() => false)]);
  check("a second copy of the app exits", exited);
  if (!exited) second.kill();
  await quit();

  const hold = net.createServer((s) => s.destroy());
  await new Promise((r) => hold.listen(5051, r));
  launch(path.join(TMP, "busy"));
  await attach();
  await sleep(1000);
  const chip = await ev(`document.querySelector('.connection-chip')?.innerText.replace(/\\s+/g,' ')`);
  check("a busy port shows as down", /down/i.test(chip) && /unavailable/.test(chip), chip);
  hold.close();
  await sleep(300);
  const recovered = await ev(`window.electron.setNetworkPort(5051)`);
  check("a free port recovers the server", recovered.ok === true, recovered);
  await quit();
}

(async () => {
  const watchdog = setTimeout(() => {
    out("FAIL  timed out");
    app?.kill("SIGTERM");
    process.exit(2);
  }, 360000);
  await new Promise((r) => origin.listen(0, r));
  const profile = path.join(TMP, "main");
  launch(profile);
  await attach();
  await agentChecks();
  await clientChecks();
  await portChecks(profile);
  clearTimeout(watchdog);
  fs.rmSync(TMP, { recursive: true, force: true });
  out(`\n${failures === 0 ? "All checks passed" : `${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  out(`FAIL  ${e.stack}`);
  app?.kill("SIGTERM");
  process.exit(1);
});
