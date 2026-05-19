# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
