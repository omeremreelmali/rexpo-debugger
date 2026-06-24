# Rexpo Debugger

Professional debugging tool for Expo and React Native apps. Inspect network traffic **and** console logs in real-time with Chrome DevTools-like UI.

<img width="1400" alt="Rexpo Debugger — Network panel" src="https://raw.githubusercontent.com/omeremreelmali/rexpo-debugger/main/assets/screenshots/dark-network.png">

## ✨ Features

### Network Monitoring

- ✅ **fetch API** (native, automatically captured)
- ✅ **axios** (with interceptors, automatically detected)
- ✅ Custom axios instances (via `addAxiosInstance()`)

### Console Monitoring

- ✅ **All console methods** (log, warn, error, info, debug)
- ✅ **Stack traces** for errors and warnings
- ✅ **Rich formatting** (objects, arrays, errors, dates, etc.)

### State Inspection (NEW! 🎉)

- ✅ **View store values live** — stream Redux, Zustand, or any store to the desktop "State" tab
- ✅ **Generic adapter** — `attachStore({ getState, subscribe })` works with Valtio, MobX, Jotai, XState, Effector, and more
- ✅ **Safe serialization** — functions, Maps/Sets, Dates and circular refs are tagged, never crash the bridge
- ℹ️ View-only for now; write-back is on the roadmap (the wire format already carries a `canSet` flag)

### Zero-config Auto-Discovery (NEW! 🎉)

- ✅ **No more hardcoded IPs** — the agent finds the desktop debugger over your local Wi-Fi automatically via mDNS / Bonjour
- ✅ **Survives Wi-Fi changes** — when your machine's IP changes, the agent reconnects without code edits
- ✅ **Auto-reconnect** — port change, desktop restart, Wi-Fi blip or VPN toggle no longer needs an app reload; the agent retries on its own with exponential backoff (1s → 2s → 4s → 8s, capped at 10s) until the connection is back
- ✅ **Expo config plugin** — required iOS/Android permissions are injected automatically; you never edit `Info.plist` or `AndroidManifest.xml`
- ✅ **Production-safe** — permissions and runtime code are stripped from release builds

## 📸 Take the tour

**Collections** — save any captured request into a named project and replay it whenever you want.

<img width="1400" alt="Collections tab — saved requests grouped by project" src="https://raw.githubusercontent.com/omeremreelmali/rexpo-debugger/main/assets/screenshots/dark-collections.png">

**Console** — every `console.log` / `warn` / `error` / `info` / `debug` with stack traces, level filtering, and rich object formatting.

<img width="1400" alt="Console panel — logs grouped by level with stack traces" src="https://raw.githubusercontent.com/omeremreelmali/rexpo-debugger/main/assets/screenshots/dark-console.png">

**Settings** — persistent preferences for port, history limits, agent toggles, manual host override, mDNS on/off, theme, and more.

<img width="1400" alt="Settings modal — every knob in one place" src="https://raw.githubusercontent.com/omeremreelmali/rexpo-debugger/main/assets/screenshots/dark-settings.png">

## 🏗️ How It Works

Rexpo Debugger consists of two parts:

1. **Desktop Inspector** (Electron app) — runs on your computer, listens on port 5051, publishes itself via mDNS as `_rexpo._tcp`
2. **npm package** — installed in your Expo app, connects to the desktop over WebSocket

```
┌─────────────────────┐    mDNS (discover)     ┌──────────────────────┐
│  Expo / RN App      │ ─────────────────────► │  Desktop Inspector   │
│  (Mobile / Sim)     │ ◄───────────────────── │  (Electron)          │
│                     │     WebSocket          │                      │
│  + Network Agent    │     (ws://…:5051)      │  + WebSocket server  │
│  + Console Agent    │                        │  + mDNS publisher    │
└─────────────────────┘                        └──────────────────────┘
```

> 💡 **Desktop Inspector**: Download pre-built binaries for macOS, Windows, and Linux from [GitHub Releases](https://github.com/omeremreelmali/rexpo-debugger/releases/latest)

## 📦 Installation

You can use the package in two modes:

| Mode | What it does | Best for |
|---|---|---|
| **Auto-discovery (recommended)** | The agent finds the desktop debugger via mDNS — no IPs in code | Dev builds, EAS builds |
| **Manual `wsUrl` (legacy)** | You pass the debugger's WebSocket URL explicitly | Expo Go, networks that block mDNS, quick tests |

### Mode 1 — Auto-discovery (recommended)

```bash
# 1. Install the agent
npm install rexpo-debugger

# 2. Install the mDNS native module
npx expo install react-native-zeroconf
```

Add the config plugin to your `app.json` (or `app.config.js`):

```json
{
  "expo": {
    "plugins": ["rexpo-debugger"]
  }
}
```

Initialize the agent **without** a `wsUrl` — discovery handles the rest:

```typescript
// app/_layout.tsx (or App.tsx)
import { initNetworkAgent, initConsoleAgent } from "rexpo-debugger";

if (__DEV__) {
  initNetworkAgent({});
  initConsoleAgent({ captureStackTrace: true });
}
```

Then run a **new** dev build so the injected permissions are picked up:

```bash
npx expo prebuild       # regenerates ios/ and android/ with required permissions
npx expo run:ios        # or run:android
```

That's it. Open the desktop debugger, open the app, the connection appears within seconds.

### Mode 2 — Manual `wsUrl` (legacy / fallback)

If you don't want a native rebuild or you're on a network that blocks mDNS, pass `wsUrl` like before:

```bash
npm install rexpo-debugger
```

```typescript
import { initNetworkAgent, initConsoleAgent } from "rexpo-debugger";

if (__DEV__) {
  initNetworkAgent({
    wsUrl: "ws://192.168.1.100:5051", // your computer's local IP
  });
  initConsoleAgent({
    wsUrl: "ws://192.168.1.100:5051",
    captureStackTrace: true,
  });
}
```

No config plugin, no native changes. Use [`ipconfig getifaddr en0`](#find-your-local-ip-address) (macOS) or `ipconfig` (Windows) to find the IP — the desktop app also shows it in the header bar with a copy button.

### Custom axios instances

If you use a custom axios instance (e.g. via `axios.create`), register it explicitly:

```typescript
import { initNetworkAgent, addAxiosInstance } from "rexpo-debugger";
import { apiClient } from "./api/client";

if (__DEV__) {
  initNetworkAgent({});
  addAxiosInstance(apiClient);
}
```

### Find your local IP address

Only needed for Mode 2 (manual `wsUrl`). The desktop app shows all detected IPs in its header — just click the copy button. Or run:

**macOS / Linux**

```bash
ipconfig getifaddr en0
# fallback
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows**

```bash
ipconfig
```

Use the `192.168.x.x` or `10.0.x.x` address.

### Download and start the desktop inspector

Pre-built binaries are on [GitHub Releases](https://github.com/omeremreelmali/rexpo-debugger/releases/latest). After downloading, open the app — it starts a WebSocket server on port 5051 and publishes itself over mDNS automatically.

## ⚙️ Configuration Options

### `initNetworkAgent(options)`

```typescript
initNetworkAgent({
  // WebSocket URL — optional. Omit to use mDNS auto-discovery.
  wsUrl: "ws://192.168.1.100:5051",

  // Enable/disable the agent (default: true)
  enabled: true,

  // Max body snippet length in characters (default: 3000)
  maxBodyLength: 3000,

  // Verbose logging (default: false)
  debug: false,

  // mDNS discovery timeout in ms (default: 10000)
  discoveryTimeoutMs: 10000,
});
```

### `initConsoleAgent(options)`

```typescript
initConsoleAgent({
  wsUrl: "ws://192.168.1.100:5051",   // optional, same as above
  enabled: true,
  debug: false,
  captureStackTrace: true,             // capture stack for errors/warnings
  discoveryTimeoutMs: 10000,
});
```

### `initStateAgent(options)` + attaching stores

Stream your state-management stores to the desktop **State** tab.

```typescript
import {
  initStateAgent,
  attachZustandStore,
  attachReduxStore,
  attachStore,
} from "rexpo-debugger";

if (__DEV__) {
  initStateAgent();                              // auto-discovers the debugger
  attachZustandStore(useBearStore, { name: "bears" });   // Zustand hook from create(...)
  attachReduxStore(store, { name: "app" });              // Redux / Redux Toolkit

  // Anything else, via the generic adapter (Valtio shown):
  attachStore({
    name: "valtio",
    getState: () => snapshot(state),
    subscribe: (cb) => subscribe(state, cb),     // returns an unsubscribe fn
  });
}
```

`initStateAgent` options: `wsUrl?`, `enabled?`, `debug?`, `discoveryTimeoutMs?`, `throttleMs?` (min gap between snapshots per store, default 150). Each `attach*` call returns a detach function. Works with any store exposing `getState` + `subscribe` (Valtio, MobX, Jotai, XState, Effector…). Plain React Context / `useReducer` and Recoil aren't supported (no global store to snapshot).

### Debug mode

The agent runs silently by default and only logs critical failures. Set `debug: true` on any agent to see verbose output (discovery, connection, request/response capture, axios interceptor setup, periodic health checks, **reconnect attempts**).

## 🔁 Auto-Reconnect

Both agents reconnect to the desktop automatically when the connection drops — no app reload required. Common scenarios this handles:

| Scenario | What happens |
|---|---|
| Desktop closed and reopened | Agent keeps retrying until the inspector is back, then connects to whatever port it picks |
| **Settings → Network port → Apply** | Agent's socket closes on the old port, retries, re-discovers via mDNS, connects to the new port within a few seconds |
| Wi-Fi blip | Once the connection is back, the next retry succeeds |
| VPN toggle | Agent re-discovers and reconnects |

How the retry loop works:

- The agent remembers its initial strategy: either the explicit `wsUrl` you passed, or the mDNS auto-discovery path.
- On socket close (or a failed initial discovery), it schedules a retry with **exponential backoff**: 1s, 2s, 4s, 8s, capped at 10s.
- The counter resets to 0 on every successful connect, so the next disconnect starts fresh from 1s instead of resuming a long delay.
- In auto-discovery mode each retry first calls `resetDiscoveryCache()` and then `discoverDebugger()` again, so a desktop that has moved to a new port (e.g. via the port live-restart in Settings) gets picked up on the next mDNS browse.

**Heads-up:** when the agent reconnects, the desktop counts it as a new session and fires `session-started`. If you have `autoClearOnInit` enabled in Settings (default), captured history will clear on reconnect. Toggle it off in Settings → Network / Console if you'd rather keep the history.

## 🔌 Expo Config Plugin

The plugin is bundled with the package. Listing `"rexpo-debugger"` in `expo.plugins` is enough — there is nothing else to import.

### What it injects

**iOS (`Info.plist`)**

| Key | Value |
|---|---|
| `NSLocalNetworkUsageDescription` | A string explaining local network use (override with the `iosLocalNetworkUsageDescription` plugin option) |
| `NSBonjourServices` | `["_rexpo._tcp"]` |

**Android (`AndroidManifest.xml`)**

- `android.permission.ACCESS_WIFI_STATE`
- `android.permission.CHANGE_WIFI_MULTICAST_STATE`
- `android.permission.INTERNET`

### Customizing the iOS usage description

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

### Production safety (3 guarantees)

| Layer | Guarantee |
|---|---|
| **1. devDependency** | Keep the package under `devDependencies` — the JS code is never bundled into production |
| **2. Plugin guard** | When `EAS_BUILD_PROFILE === "production"` (or `NODE_ENV === "production"` with no EAS profile), the plugin is a **no-op** — no permissions are injected into `Info.plist` or `AndroidManifest.xml` |
| **3. `__DEV__` guard** | All agent code is wrapped in `if (__DEV__) { … }` — production runtime never starts the WebSocket or mDNS scan, so no system prompt appears to your users |

You can audit guarantee #2 yourself:

```bash
EAS_BUILD_PROFILE=production npx expo prebuild --no-install --platform ios --clean
# Then check that Info.plist has neither NSLocalNetworkUsageDescription nor NSBonjourServices
```

## 🛠 Troubleshooting

### Agent keeps retrying / "🔁 Will retry connection in Xms"

That's the auto-reconnect logic doing its job — the desktop is unreachable
right now. Common causes:

- Desktop inspector isn't running → start it
- Device and computer dropped off the same Wi-Fi → reconnect them
- You changed the port in Settings but the new port is blocked by your firewall → check System Settings → Network → Firewall

If the auto-discovery path can't find the service after the initial timeout
(default 10s), the agent will schedule another full retry cycle — so the
"timed out" error is recoverable, not terminal.

### Auto-discovery never finds the debugger

- **Desktop app running?** Check its terminal — you should see `[Inspector] mDNS service published: Rexpo Debugger on …`
- **Same Wi-Fi?** Auto-discovery is local network only. Cellular / different Wi-Fi won't work.
- **Corporate / guest Wi-Fi?** Many block mDNS multicast. Fall back to manual `wsUrl`.
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

### "Connection refused"

- Confirm the desktop inspector is running
- Confirm the device is on the same Wi-Fi
- Check the macOS firewall (System Settings → Network → Firewall) and allow port 5051

### Requests not appearing

- Enable `debug: true` to see the connection / capture lifecycle
- Confirm the app is running in `__DEV__` mode
- Confirm `initNetworkAgent` is actually called (check the `if (__DEV__)` block)
- For custom axios instances, confirm `addAxiosInstance(yourClient)` is called

### Body not shown

Binary or stream bodies cannot be displayed. The agent renders text-based bodies only.
