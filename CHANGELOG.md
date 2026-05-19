# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
