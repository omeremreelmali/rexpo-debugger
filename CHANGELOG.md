# Changelog

All notable changes to this project will be documented in this file.

## [1.2.1] - 2026-05-20

### 🐛 Fixed

- **Expo config plugin crashed prebuild on Android.** `withRexpoAndroid`
  assigned the return value of `AndroidConfig.Permissions.ensurePermissions`
  to `cfg.modResults`. That helper mutates the manifest in place and
  returns a `{ permission: boolean }` map — not the manifest. The
  overwrite turned `cfg.modResults` into a boolean map, so every
  subsequent `android.manifest` mod in the pipeline crashed with:

  ```
  TypeError: [android.manifest]: withAndroidManifestBaseMod:
  Cannot read properties of undefined (reading 'hasOwnProperty')
  ```

  Fix: discard the return value; the in-place mutation is what we want.

## [1.2.0] - 2026-05-19

A large release focused on **zero-friction connection** between desktop
and agent, plus **Settings**, **Collections**, and quality-of-life polish
on the network workflow.

### ✨ Added — Collections (saved requests)

A new third tab next to Network and Console lets you save any captured
request to a named collection and replay it whenever you want — without
keeping the original traffic in the panel.

UI:

- 📚 **Collections tab** with a count badge. Left: collapsible tree
  grouped by collection (project) name. Right: details + actions for
  the selected saved request.
- Right-click any row in the Network panel → **Save to collection…**
  opens a modal. All fields are optional: name, collection (pick
  existing or "+ New"), tags (comma-separated, shown as chips),
  description. If you save with nothing filled in, the request lands
  in an **Uncategorized** bucket with an auto-derived label like
  `GET /api/users?id=42`.
- Right-click a saved request for: **Replay**, **Edit & Replay…**,
  **Rename / edit metadata…**, **Move to another collection…**,
  **Copy URL**, **Copy as cURL**, **Delete**.
- Details pane shows the URL, headers, body, tags, description,
  collection, and created / updated timestamps. The same actions
  are also exposed as buttons.

Persistence:

- Saved under `rexpo-debugger-collections` in localStorage — survives
  restarts and works alongside other Settings state.
- Defensive deserialization: malformed storage falls back to an empty
  collection list rather than throwing.

Architecture:

- New `CollectionsContext` exposes `state`, `saveRequest`,
  `updateRequest`, `deleteRequest`, `moveRequest` and a derived
  `collectionNames` list (Uncategorized always last).
- `useCollections()` hook + a small `defaultRequestLabel()` helper that
  builds a readable label when no name was provided.

### ✨ Added — Agent auto-reconnect

The agent now reconnects to the desktop debugger on its own — no app reload
required. Triggered by:

- 🔁 **Network port live-restart** (Settings → Apply) — agent picks up the new port within a few seconds via mDNS re-discovery.
- 🔌 **Desktop closed and reopened** — agent keeps retrying until the inspector comes back.
- 🛰 **Wi-Fi blip / VPN toggle** — once the connection re-establishes, the agent retries discovery and reconnects.

How it works:

- The agent remembers its initial connection strategy (manual `wsUrl` or auto-discovery) and reuses it for every retry.
- Retries use **exponential backoff** starting at 1s, doubling each attempt, capped at 10s. The counter resets to 0 on a successful connect.
- In auto-discovery mode, each retry calls `resetDiscoveryCache()` + `discoverDebugger()` again so the agent picks up a re-published mDNS service (e.g. desktop moved to a new port).
- Applies to both Network and Console agents independently.

Heads-up: when the agent reconnects, the desktop counts it as a new session and fires `session-started`. If you have `autoClearOnInit` enabled (default), your captured history will clear on reconnect — toggle it off in Settings if that's not what you want.

### ✨ Added — Context menu & Edit Replay polish

**Context menu (RED-159 leftovers):**

- 💬 **Toast feedback** after copy actions — "URL kopyalandı", "cURL komutu kopyalandı", "Request JSON kopyalandı". A reusable `<Toast>` system was added (`ToastProvider` + `useToast`) and wired into the network row context menu and replay actions.
- 💾 **Save response to file** — new context menu item. Opens the native OS save dialog (via a new `save-response-to-file` IPC handler) and writes the response body to disk. The default filename and extension are derived from the URL path or, failing that, the response Content-Type (`json`, `xml`, `html`, `txt`, `png`, `jpg`, `svg`, …). JSON bodies are pretty-printed on save. The menu item is greyed-out when the request has no captured response body.
- ✓ "Replay gönderildi" toast also fires after a plain Replay click for parity.

**Edit & Replay (RED-162 leftovers):**

- 🔧 **Query params editor** — new section in the modal, modelled after the headers table (add / remove / disable individually). On open, the URL's existing query string is parsed into rows; the URL field shows only the base. Pasting a URL with `?key=value` into the base field peels the query off into the table on blur.
- 🪞 **Live "Final URL" preview** appears under the URL row when any query param is active, so you can see exactly what will be sent.
- ✅ On Send, the URL is rebuilt via `URLSearchParams` so encoding is correct (no manual string concatenation).

### ✨ Added — Full light theme (RED-160 follow-up)

- 🎨 Complete CSS-variable refactor: every component reads its colors from a
  semantic token system in `renderer/theme.css` (surfaces, borders, text,
  accent, status, overlays, scrollbar, shadows, JSON syntax, HTTP method
  badges, console log levels, status code badges).
- 🌗 Three theme modes:
  - **Dark** — the existing VS Code Dark+ inspired palette.
  - **Light** — a fresh VS Code Light+ inspired palette with adjusted
    accent / warning / error hues for legibility on white surfaces.
  - **System** — follows `prefers-color-scheme` and updates live when the
    OS appearance changes while the app is open.
- ⚡ **No FOUC** — the theme is applied synchronously in `main.tsx`
  before React mounts, reading from `localStorage` directly.
- 🧰 New tokens cover special cases (JSON syntax highlight, HTTP method
  badges, console log level stripes) so they remain readable on both
  themes instead of being washed out.

### ✨ Added — Network port live-restart (RED-160 follow-up)

- 🔁 Changing the port in Settings + clicking **Apply** now actually switches the WS server to the new port — no Electron restart needed.
- 🛡 Safety: the new port is bound **first**. If it's already in use, the old server keeps running and the error surfaces inline in the modal ("Apply" shows `✗ EADDRINUSE: ...`). Old port is never lost on failure.
- 🛰 mDNS publisher is automatically unpublished + re-published on the new port so agents discover the move within seconds.
- ⏳ Visual feedback during the switch: `Yeni portta başlatılıyor…` → `✓ Port 5052 olarak güncellendi`.
- ↩ A new `set-network-port` IPC handler implements the swap with a single in-flight guard so concurrent attempts can't race.

### ✨ Added — Network context menu (RED-159)

- 🖱 **Right-click on any network row** opens a context menu with: Copy URL, Copy as cURL, Copy as JSON, Replay, Edit & Replay, Delete request, Clear all requests.
- 🧹 New `DELETE_REQUEST` action removes a single request from the list (and unselects it if it was the active selection). `DELETE_CONSOLE_LOG` added for symmetry.
- ♻️ Shared `replayRequest()` / `sendReplayCommand()` helpers in `utils/replayRequest.ts` — used by both `RequestDetails` and the new context menu.
- 🎯 Reusable `ContextMenu` component with separators, destructive items, icons, shortcuts, viewport-aware positioning.

### ✨ Added — Edit & Replay editor (RED-162)

- ✏️ **Full editor modal** triggered from `Edit & Replay…` in the context menu — lets you tweak a captured request before re-sending it.
- 🔧 Editable: method, URL, headers (add / remove / disable individually), JSON body with pretty-print + validation.
- 🔒 Sensitive headers (`Authorization`, `Cookie`, `x-api-key`, `x-auth-token`) are masked by default with a 👁 reveal toggle.
- 🚫 Send button disables itself when the JSON body is structurally invalid; tooltip explains why.
- ⌨ Esc closes the modal; click-outside closes.

### ✨ Added — Auto-clear on agent connect (RED-157)

- 🛁 Electron emits a `session-started` IPC event the moment a new agent connects (i.e. app reload or fresh launch).
- 📋 Renderer listens; clears Network and/or Console lists based on the per-tab `autoClearOnInit` settings (default: on).
- The setting was previously shell-only; it is now wired end-to-end.

### ✨ Added — Independent agent enable/disable (RED-158)

- 🛰 `agents.networkEnabled` / `agents.consoleEnabled` Settings toggles are now wired.
- Messages of the disabled type are dropped at the dispatch boundary (so the rest of the state stays clean and the other agent is unaffected).
- Each panel renders a dedicated "agent disabled" empty state that points the user back to Settings → Agents.

### ✨ Added — RED-160 follow-ups (settings → behaviour wiring)

- 🛰 **Auto-detect IP (mDNS) toggle** now actually stops the Bonjour publisher on the Electron side via a new `set-mdns-enabled` IPC handler. Re-enabling re-publishes the service. Agents will fall back to manual `wsUrl` while disabled.
- 🔗 **Manuel host:port override** is wired into the header `ConnectionChip` — when set, it becomes the displayed/copyable URL and overrides the dropdown selection. A small **M** badge signals the override is active.
- 🎨 Theme dropdown is still UI-only (full light theme requires a CSS-wide refactor; remaining in `[RED-160 follow-up]`).

### ✨ Added — Settings panel (shell)

- ⚙ **Settings modal** accessible from the header gear button — groups every configurable knob in one place: Network, Console, Connection, Agents, UI.
- 💾 **Persistence layer** via `localStorage` (key: `rexpo-debugger-settings`). Settings survive restarts. New defaults are merged in automatically when the package adds fields, so users don't lose their config across upgrades.
- ✅ **Wired now**:
  - `network.maxRequestHistory` — FIFO trims the request list at the chosen size, applied instantly.
  - `console.maxLogHistory` — same for console.
  - `console.defaultLogLevel` — restores the level filter on app boot.
  - `Reset to defaults` button.
- ⏳ **Shell-only (no behaviour yet — tagged in the UI with the issue that will wire them)**:
  - `network.autoClearOnInit`, `console.autoClearOnInit` → RED-157
  - `agents.networkEnabled`, `agents.consoleEnabled` → RED-158
  - `connection.port` live restart, `connection.autoDetectIp` toggle, `connection.manualWsUrl`, `ui.theme` → RED-160 follow-ups

### ✨ Added — Zero-config auto-discovery

- 🛰️ **mDNS / Bonjour publisher** in the desktop app — broadcasts itself as `_rexpo._tcp` on the local network, so the agent can find it without a hard-coded IP.
- 🔎 **Auto-discovery in the agent** — `initNetworkAgent({})` / `initConsoleAgent({})` now work without a `wsUrl`. Uses `react-native-zeroconf` (optional peer dep) to browse the local network and connect automatically.
- 🔌 **Expo config plugin** (`app.plugin.js`) — automatically injects the iOS `NSLocalNetworkUsageDescription` + `NSBonjourServices` and the Android `CHANGE_WIFI_MULTICAST_STATE` / `ACCESS_WIFI_STATE` permissions. Users never touch native files.
- 🛡️ **Production safety** — plugin is a no-op when `EAS_BUILD_PROFILE === "production"` (or `NODE_ENV=production` with no EAS profile). Combined with `__DEV__` runtime guards and `devDependency` placement, the package is invisible in release builds.
- 🔄 **Network change handling** — desktop polls interfaces every 5s and re-publishes the mDNS service when Wi-Fi / VPN state changes, so the agent finds the new IP automatically.
- 🧭 **Connection chip in the desktop header** — shows detected local IP(s) with a copy button, live status dot, and connected-client badge. Dropdown to pick a specific interface when multiple are present (Wi-Fi + Ethernet, VPN, etc.); selection persists across restarts.

### 🔧 Changed

- `InitOptions.wsUrl` is now **optional** — backwards compatible (passing a `wsUrl` still works exactly like before).
- New `discoveryTimeoutMs` option (default 10s) controls how long the agent waits for mDNS before giving up.

### 📚 Docs

- README + agent README rewritten to lead with auto-discovery mode.
- New troubleshooting section for discovery-specific issues (corporate Wi-Fi, VPN, Expo Go limitations).

---

## [1.0.0] - 2025-11-14

### ✨ Initial Release

#### Added Features

- 🚀 **Electron Desktop Inspector**: Modern UI with React + TypeScript
- 📡 **WebSocket Server**: Real-time communication (port 5051)
- 🔍 **Network Monitoring**: Capture all fetch requests
- 📊 **Chrome DevTools-like UI**: 
  - Left panel: Network requests list
  - Right panel: Detailed request information
  - Tabs: Overview, Headers, Request, Response, Timing
- 🎯 **Advanced Filtering**:
  - Search by URL
  - Method filter (GET, POST, PUT, DELETE, PATCH)
  - Status code filter (2xx, 3xx, 4xx, 5xx, ERR)
- ⏸️ **Pause/Resume**: Temporarily pause requests
- 🗑️ **Clear**: Clear all requests
- 🎨 **Dark Theme**: VS Code style dark theme
- 📱 **Expo Agent**: Lightweight and easy-to-integrate client agent
- 🔧 **Configuration**: Flexible settings (wsUrl, enabled, maxBodyLength)
- 📝 **Pretty-Print**: JSON formatted body display
- ⚡ **Real-time**: Instant request visualization
- 🎯 **Type-Safe**: Full TypeScript support

#### Technical Details

- **Electron**: v27.x
- **React**: v18.x
- **TypeScript**: v5.x
- **Vite**: v5.x for modern bundling
- **WebSocket**: ws library
- **Build System**: electron-builder

#### Documentation

- ✅ Main README.md
- ✅ Expo Agent README.md
- ✅ Integration example guide
- ✅ Troubleshooting guide
- ✅ TypeScript type definitions

### 📦 Distribution

- macOS: .dmg
- Windows: .exe (NSIS installer)
- Linux: .AppImage

---

## Future Version Plans

### [1.1.0] - TBD

- [ ] XMLHttpRequest support
- [ ] WebSocket traffic monitoring
- [ ] Auto-reconnect logic
- [ ] Request/Response export (HAR format)

### [1.2.0] - TBD

- [ ] GraphQL query/mutation visualization
- [ ] Request replay feature
- [ ] Mock response feature
- [ ] Dark/Light theme toggle

### [2.0.0] - TBD

- [ ] Multi-device support (multiple devices)
- [ ] History/Timeline view
- [ ] Performance metrics
- [ ] Advanced filtering rules

---

**Notes:**
- We use Semantic Versioning: MAJOR.MINOR.PATCH
- [Unreleased] section is for upcoming features
