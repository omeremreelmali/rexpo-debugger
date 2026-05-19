# 🔍 Rexpo Debugger

<div align="center">

[![npm version](https://badge.fury.io/js/rexpo-debugger.svg)](https://www.npmjs.com/package/rexpo-debugger)
[![Downloads](https://img.shields.io/npm/dm/rexpo-debugger.svg)](https://www.npmjs.com/package/rexpo-debugger)
[![GitHub release](https://img.shields.io/github/release/omeremreelmali/rexpo-debugger.svg)](https://github.com/omeremreelmali/rexpo-debugger/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

A professional debugging tool similar to **Flipper** and **Chrome DevTools** for your Expo and React Native applications. Monitor network traffic **and** console logs in real-time — with **zero-config auto-discovery** so you never hard-code IPs again.

<img width="1400" alt="Rexpo Debugger" src="./assets/debug-screenshot.png">

## ✨ Features

### Network Monitoring

- 🚀 **Real-time monitoring**: View all network requests instantly
- 📦 **Fetch & Axios support**: Automatically captures both HTTP clients
- 🔎 **Advanced filtering**: Filter by method, status code, and URL
- 📊 **Detailed analysis**: Headers, request/response body, timing information

<img width="1400" alt="Rexpo Debugger" src="./assets/debug-console-screenshot.png">

### Console Monitoring (NEW! 🎉)

- 📋 **Console logs**: Capture all console.log, warn, error, info, debug calls
- 🎨 **Color-coded levels**: Different colors for each log level
- 🔍 **Stack traces**: Automatic stack trace capture for errors and warnings
- 🎯 **Rich formatting**: Objects, arrays, errors, dates, and more

### Zero-Config Auto-Discovery (NEW! 🎉)

- 🛰️ **mDNS / Bonjour**: Desktop publishes itself over the local network; the agent finds it automatically — no IPs in your code
- 🔄 **Survives Wi-Fi changes**: When your machine's IP changes, the agent reconnects without code edits
- 🔌 **Expo config plugin**: iOS / Android permissions are injected automatically; you never touch `Info.plist` or `AndroidManifest.xml`
- 🛡️ **Production-safe**: Permissions and runtime code are stripped from release builds — App Store / Play Store binaries see nothing
- 🧭 **Live connection chip**: Desktop header shows the detected IP(s) with a copy button and a status dot for connected clients

### Settings (NEW)

- ⚙ **Settings modal**: Manage history limits, default log level, manual host overrides, and more from the header
- 💾 **Persisted**: Your preferences survive app restarts (stored in `localStorage`)
- 📜 **Live FIFO trimming**: Network and console panels honour the configured history limits in real time
- 🚦 **Reset to defaults**: One-click rollback when you've experimented too much

### General

- 💻 **Cross-platform**: Support for macOS, Windows, and Linux
- 🎨 **Modern UI**: Dark theme with tab navigation
- ⚡ **Lightweight and fast**: Won't slow down your application
- 🔒 **Development only**: Automatically disabled in production

## 🚀 Quick Start

```bash
# 1. Install the agent + the mDNS native module
npm install --save-dev rexpo-debugger
npx expo install react-native-zeroconf
```

```json
// 2. Add the config plugin to app.json
{ "expo": { "plugins": ["rexpo-debugger"] } }
```

```typescript
// 3. Initialize the agent — no wsUrl needed
import { initNetworkAgent, initConsoleAgent } from "rexpo-debugger";

if (__DEV__) {
  initNetworkAgent({});
  initConsoleAgent({ captureStackTrace: true });
}
```

```bash
# 4. Rebuild the dev client so the new permissions take effect
npx expo prebuild && npx expo run:ios   # or run:android
```

5. **Download** the desktop app from [GitHub Releases](https://github.com/omeremreelmali/rexpo-debugger/releases/latest) and open it. Open your app — within a few seconds it connects automatically.

> Prefer the old way? Skip the plugin and `react-native-zeroconf`, then pass `wsUrl: "ws://<your-ip>:5051"` explicitly. See [Manual `wsUrl` mode](#alternative-manual-wsurl-legacy) below.

## 🏗️ Architecture

This project consists of two main components:

1. **Desktop Inspector (Electron App)**: Desktop application that visualizes network traffic and console logs
2. **Expo Agents**: Lightweight client agents integrated into your Expo application

```
┌─────────────────────┐    mDNS (_rexpo._tcp)      ┌──────────────────────┐
│                     │ ◄──────────────────────────┤                      │
│  Expo / RN App      │       (auto-discover)      │  Desktop Inspector   │
│  (Mobile / Sim)     │                            │  (Electron)          │
│                     │         WebSocket          │                      │
│  + Network Agent    │ ────────────────────────►  │  + WebSocket server  │
│  + Console Agent    │      (ws://<ip>:5051)      │  + mDNS publisher    │
│  + fetch override   │                            │  + React UI          │
│  + console override │                            │  + Tab navigation    │
└─────────────────────┘                            └──────────────────────┘
```

## 📦 Installation

### 0. Download Desktop Inspector (Recommended)

Download the latest release for your platform:

- **macOS (Apple Silicon)**: [Rexpo Network Inspector-1.1.5-arm64.dmg](https://github.com/omeremreelmali/rexpo-debugger/releases/download/v1.1.5/Rexpo.Network.Inspector-1.1.5-arm64.dmg)
- **macOS (Intel)**: [Rexpo Network Inspector-1.1.5.dmg](https://github.com/omeremreelmali/rexpo-debugger/releases/download/v1.1.5/Rexpo.Network.Inspector-1.1.5.dmg)
- **Windows**: [Rexpo Network Inspector Setup 1.1.5.exe](https://github.com/omeremreelmali/rexpo-debugger/releases/download/v1.1.5/Rexpo.Network.Inspector.Setup.1.1.5.exe)
- **Linux (x64)**: [Rexpo Network Inspector-1.1.5.AppImage](https://github.com/omeremreelmali/rexpo-debugger/releases/download/v1.1.5/Rexpo.Network.Inspector-1.1.5.AppImage)
- **Linux (ARM64)**: [Rexpo Network Inspector-1.1.5-arm64.AppImage](https://github.com/omeremreelmali/rexpo-debugger/releases/download/v1.1.5/Rexpo.Network.Inspector-1.1.5-arm64.AppImage)

> 📦 **All releases**: [View all releases on GitHub](https://github.com/omeremreelmali/rexpo-debugger/releases)

### 1. Install the npm package (Required)

```bash
# npm
npm install --save-dev rexpo-debugger

# yarn
yarn add -D rexpo-debugger

# pnpm
pnpm add -D rexpo-debugger
```

> 📦 **npm package**: [rexpo-debugger](https://www.npmjs.com/package/rexpo-debugger)

Then pick one of the two integration modes below.

#### 1a. Auto-discovery mode (recommended)

The agent finds the desktop debugger automatically via mDNS — no IPs in your code, no manual updates when Wi-Fi changes.

```bash
# Install the mDNS native module
npx expo install react-native-zeroconf
```

Add the config plugin to `app.json`:

```json
{
  "expo": {
    "plugins": ["rexpo-debugger"]
  }
}
```

Initialize **without** `wsUrl`:

```typescript
// app/_layout.tsx (or App.tsx)
import { initNetworkAgent, initConsoleAgent } from "rexpo-debugger";

if (__DEV__) {
  initNetworkAgent({});
  initConsoleAgent({ captureStackTrace: true });
}
```

Rebuild the dev client so the injected permissions are picked up:

```bash
npx expo prebuild        # regenerates ios/ and android/ with required permissions
npx expo run:ios         # or run:android
```

**Requirements:** Expo dev build (Expo Go is not supported because its `Info.plist` does not declare `_rexpo._tcp`). Phone and computer must be on the same Wi-Fi. Many corporate / guest Wi-Fi networks block mDNS — fall back to `1b` in that case.

**Production safety:** The plugin is a no-op when `EAS_BUILD_PROFILE === "production"` (or `NODE_ENV=production` with no EAS profile). No `NSLocalNetworkUsageDescription`, no Bonjour services, and no `MULTICAST` permission ever reaches your release build.

#### 1b. Manual `wsUrl` mode (legacy / fallback)

Use this when the network blocks mDNS, when you don't want a native rebuild, or for Expo Go. No config plugin, no `react-native-zeroconf`.

```typescript
import { initNetworkAgent, initConsoleAgent } from "rexpo-debugger";

if (__DEV__) {
  initNetworkAgent({
    wsUrl: "ws://192.168.1.100:5051", // your computer's IP
    enabled: true,
  });
  initConsoleAgent({
    wsUrl: "ws://192.168.1.100:5051",
    enabled: true,
    captureStackTrace: true,
  });
}
```

The desktop app shows all detected IPs in its header bar with a copy button — much easier than running `ipconfig`.

### 2. Build from Source (Optional)

If you prefer to build the desktop application from source:

```bash
# Clone the repository
git clone https://github.com/omeremreelmali/rexpo-debugger.git
cd rexpo-debugger

# Install dependencies
npm install

# Run in development mode
npm run dev

# Or create a production build
npm run build
npm run package
```

### 3. (Alternative) Manual Integration

If you prefer not to use the npm package, copy the agent files to your Expo project:

```bash
# In your Expo project
mkdir -p src/debug
cp -r path/to/expo-agent/src/* src/debug/
```

Initialize the agents in your main file (e.g., `App.tsx`):

```typescript
import { initNetworkAgent, initConsoleAgent } from "./src/debug";

if (__DEV__) {
  // Network monitoring
  initNetworkAgent({
    wsUrl: "ws://YOUR_LOCAL_IP:5051", // Example: ws://192.168.1.100:5051
    enabled: true,
  });

  // Console monitoring (NEW!)
  initConsoleAgent({
    wsUrl: "ws://YOUR_LOCAL_IP:5051", // Same WebSocket connection
    enabled: true,
    captureStackTrace: true, // Capture stack traces for errors/warnings
  });
}
```

> 💡 **Tip**: You can enable one or both agents based on your needs!

### 4. Find Your Local IP Address (manual mode only)

The desktop app shows all detected IPs in its header chip with a one-click copy button — that's the easiest path. If you'd rather use the terminal:

**macOS / Linux:**

```bash
ipconfig getifaddr en0
# fallback
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**

```bash
ipconfig
```

Look for an address like `192.168.x.x` or `10.0.x.x` and pass it as `wsUrl`.

## 🚀 Usage

### Start the Desktop Inspector

```bash
npm run dev
```

The application will automatically start a WebSocket server at `ws://localhost:5051`.

### Run Your Expo Application

```bash
cd your-expo-project
npx expo start
```

Open your application on a physical device or emulator. Network requests will automatically start appearing in the inspector!

## 🎨 UI Features

### Tab Navigation

- **Network Tab** 🌐: View all HTTP requests (fetch & axios)
- **Console Tab** 📋: View all console logs

### Network Tab

- **Left Panel**: List of all network requests
  - Method badges (GET, POST, PUT, DELETE, PATCH)
  - Status codes (color-coded: green 2xx, yellow 3xx, orange 4xx, red 5xx)
  - URL, duration, timestamp information
- **Right Panel**: Details of selected request
  - **Overview**: Summary information
  - **Headers**: Request and response headers
  - **Request**: Request body (JSON pretty-print)
  - **Response**: Response body (JSON pretty-print)
  - **Timing**: Timing details

### Console Tab (NEW! 🎉)

- **Left Panel**: List of all console logs
  - Level badges (LOG, INFO, WARN, ERROR, DEBUG)
  - Color-coded by severity
  - Message preview and timestamp
- **Right Panel**: Details of selected log
  - **Message**: All arguments with formatting
  - **Stack Trace**: For errors and warnings
  - **Raw Data**: Full log information

### Filtering and Search

- **Search**: Search by URL (Network) or message (Console)
- **Method Filter**: Show only specific HTTP methods (Network)
- **Status Filter**: Filter by status code (Network)
- **Level Filter**: Filter by log level (Console)
- **Pause**: Temporarily stop capturing new data
- **Clear**: Delete all captured data

## 🔧 Configuration

### Network Agent Options

```typescript
initNetworkAgent({
  // WebSocket URL — optional. Omit to use mDNS auto-discovery.
  wsUrl: "ws://192.168.1.100:5051",

  // Enable/disable agent (default: true)
  enabled: true,

  // Maximum body snippet length (default: 3000)
  maxBodyLength: 3000,

  // Enable debug logging (default: false)
  debug: false,

  // mDNS discovery timeout in ms (default: 10000)
  discoveryTimeoutMs: 10000,
});
```

### Console Agent Options

```typescript
initConsoleAgent({
  // WebSocket URL — optional. Omit to use mDNS auto-discovery.
  wsUrl: "ws://192.168.1.100:5051",

  // Enable/disable agent (default: true)
  enabled: true,

  // Enable debug logging (default: false)
  debug: false,

  // Capture stack traces for errors/warnings (default: true)
  captureStackTrace: true,

  // mDNS discovery timeout in ms (default: 10000)
  discoveryTimeoutMs: 10000,
});
```

### Expo Config Plugin Options

The plugin only runs when listed in `expo.plugins`. To customize the iOS usage description:

```json
{
  "expo": {
    "plugins": [
      [
        "rexpo-debugger",
        {
          "iosLocalNetworkUsageDescription": "Used by our internal debugger to discover this device on the dev network."
        }
      ]
    ]
  }
}
```

| Option | Default | Description |
|---|---|---|
| `iosLocalNetworkUsageDescription` | A generic dev-only string | Override the `NSLocalNetworkUsageDescription` Info.plist value |
| `force` | `false` | Inject permissions even when `EAS_BUILD_PROFILE === "production"`. Not recommended. |

### Environment Variables

In development mode, Electron automatically opens DevTools. To change this:

```typescript
// electron/main.ts
if (
  process.env.NODE_ENV === "development" &&
  process.env.OPEN_DEVTOOLS !== "false"
) {
  mainWindow.webContents.openDevTools();
}
```

## 📁 Project Structure

```
expo-network-inspector/
├── electron/                    # Electron main process
│   ├── main.ts                 # Main process and WebSocket server
│   ├── preload.ts              # Preload script (IPC bridge)
│   └── types.ts                # Shared type definitions
├── renderer/                    # React renderer (UI)
│   ├── components/
│   │   ├── FilterBar.tsx       # Top bar (search, filters)
│   │   ├── NetworkTable.tsx    # Request list
│   │   └── RequestDetails.tsx  # Request details
│   ├── state/
│   │   └── NetworkContext.tsx  # Global state management
│   ├── App.tsx                 # Main React component
│   ├── main.tsx                # React entry point
│   └── types.ts                # Renderer type definitions
├── expo-agent/                  # Expo client agent
│   ├── expoNetworkAgent.ts     # Agent implementation
│   └── README.md               # Agent documentation
├── package.json
├── tsconfig.json               # Renderer TypeScript config
├── tsconfig.electron.json      # Electron TypeScript config
├── vite.config.ts              # Vite config
└── README.md
```

## 🛠️ Development

### Scripts

```bash
# Run in development mode (hot reload)
npm run dev

# Build renderer
npm run build:renderer

# Build electron
npm run build:electron

# Production build (full build)
npm run build

# Create production binary
npm run package

# Type checking
npm run type-check
```

### Build Output

After production build:

- `dist/electron/`: Compiled Electron files
- `dist/renderer/`: Compiled React files
- `release/`: Platform-specific binary files (.dmg, .exe, .AppImage)

## 🐛 Troubleshooting

### Auto-discovery never finds the debugger

✅ **Solutions:**

- **Desktop app running?** Check its terminal — you should see `[Inspector] mDNS service published: Rexpo Debugger on …`
- **Same Wi-Fi?** Auto-discovery is local-network only. Cellular / different Wi-Fi won't work.
- **Corporate / guest Wi-Fi?** Many block mDNS multicast — fall back to manual `wsUrl`.
- **VPN active?** Forces traffic off the local interface. Disable it for the dev session or use manual `wsUrl`.
- **iOS permission dialog never appeared?** The plugin didn't run. Verify `"rexpo-debugger"` is in `expo.plugins`, then `npx expo prebuild` and rebuild the dev client.
- **Expo Go?** Auto-discovery does not work in Expo Go because Expo Go's own `Info.plist` doesn't declare `_rexpo._tcp`. Use a dev build or fall back to manual `wsUrl`.

### `Module react-native-zeroconf not found`

You're using auto-discovery without installing the native module:

```bash
npx expo install react-native-zeroconf
npx expo prebuild
npx expo run:ios   # or run:android
```

If you don't want a native rebuild, switch to manual `wsUrl` instead.

### "Connection refused" error

✅ **Solutions:**

- Ensure the inspector application is running
- Ensure your device is on the same Wi-Fi network
- For manual mode: ensure you entered your computer's IP correctly (copy from the desktop header chip)
- Check your firewall settings (macOS: System Settings → Network → Firewall → allow port 5051)

### Requests not showing up

✅ **Solutions:**

- Enable `debug: true` on the agent to see the connection lifecycle
- Check for `[NetworkAgent] Connected to inspector` or `🎯 Discovered debugger:` in your app logs
- Ensure you're in `__DEV__` mode
- Ensure the agent is properly initialized (is `initNetworkAgent` called?)
- For custom axios instances, confirm `addAxiosInstance(yourClient)` is called

### Body not visible

⚠️ **Note:** Binary or stream bodies cannot be displayed. The agent only shows text-based bodies.

### Not working on emulator

✅ **Solutions:**

- **Android Emulator** (manual mode): Use `10.0.2.2` address (host machine's localhost)
- **iOS Simulator** (manual mode): `localhost` or your computer's IP address should work
- Auto-discovery works on simulators too, but mDNS on Android emulators is unreliable on some host setups — manual `wsUrl` is more dependable there

## 🚀 Future Features

### Network

- [ ] XMLHttpRequest support
- [ ] WebSocket traffic monitoring
- [ ] GraphQL query/mutation visualization
- [x] ✅ Request replay feature
- [ ] Mock response feature

### Discovery & Connection

- [x] ✅ mDNS / Bonjour auto-discovery
- [x] ✅ Live IP detection + copy chip in desktop header
- [x] ✅ Expo config plugin (permissions auto-inject)
- [x] ✅ Network change re-publish
- [ ] QR code pairing (mDNS fallback for blocked networks)

### Console

- [x] ✅ Console log monitoring (COMPLETED!)
- [ ] Advanced log formatting (React components, etc.)
- [ ] Log export feature

### General

- [ ] Export/Import feature (HAR format for network, JSON for console)
- [ ] Dark/Light theme toggle
- [ ] Automatic reconnect logic
- [ ] Performance metrics
- [ ] Redux/Zustand state monitoring

## 📄 License

MIT

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 💡 Inspiration

- [Flipper](https://fbflipper.com/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [React Native Debugger](https://github.com/jhen0409/react-native-debugger)

## 📞 Contact

- **Author**: Ömer Emre Elmalı
- **Email**: omeremreelma@gmail.com
- **GitHub**: [@omeremreelmali](https://github.com/omeremreelmali)

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

---

**Made with ❤️ for Expo developers**
