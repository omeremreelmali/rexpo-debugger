# Rexpo Debugger

Professional debugging tool for Expo and React Native apps. Inspect network traffic **and** console logs in real-time with Chrome DevTools-like UI.

<img width="1400" alt="Rexpo Debugger Network View" src="https://raw.githubusercontent.com/omeremreelmali/rexpo-debugger/main/assets/debug-screenshot.png">

## ✨ Features

### Network Monitoring

- ✅ **fetch API** (native, automatically captured)
- ✅ **axios** (with interceptors, automatically detected)
- ✅ Custom axios instances (via `addAxiosInstance()`)

### Console Monitoring (NEW! 🎉)

- ✅ **All console methods** (log, warn, error, info, debug)
- ✅ **Stack traces** for errors and warnings
- ✅ **Rich formatting** (objects, arrays, errors, dates, etc.)

<img width="1400" alt="Rexpo Debugger Console View" src="https://raw.githubusercontent.com/omeremreelmali/rexpo-debugger/main/assets/debug-console-screenshot.png">

## 🏗️ How It Works

Rexpo Debugger consists of two parts:

1. **Desktop Inspector** (Electron app) - Must be running on your computer
2. **npm package** - Installed in your Expo app

Your Expo app connects to the desktop inspector via WebSocket to send network/console data.

> 💡 **Desktop Inspector**: Download pre-built binaries for macOS, Windows, and Linux from [GitHub Releases](https://github.com/omeremreelmali/rexpo-debugger/releases/latest)

## 📦 Installation

Install via npm:

```bash
npm install rexpo-debugger
```

or with yarn:

```bash
yarn add rexpo-debugger
```

## 🚀 Quick Start

### 1. Install the Package

```bash
npm install rexpo-debugger
```

### 2. Initialize the Agent

In your main file (e.g. `App.tsx` or `app/_layout.tsx`):

```typescript
import { initNetworkAgent, initConsoleAgent } from "rexpo-debugger";

if (__DEV__) {
  // Network monitoring
  initNetworkAgent({
    wsUrl: "ws://192.168.1.100:5051", // Your computer's local IP address
    enabled: true,
  });

  // Console monitoring (NEW!)
  initConsoleAgent({
    wsUrl: "ws://192.168.1.100:5051", // Same WebSocket connection
    enabled: true,
    captureStackTrace: true, // Capture stack traces for errors/warnings
  });
}
```

### 3. (Optional) Add Custom Axios Instances

If you use custom axios instances:

```typescript
import {
  initNetworkAgent,
  initConsoleAgent,
  addAxiosInstance,
} from "rexpo-debugger";
import { apiClient } from "./api/client"; // Your custom axios instance

if (__DEV__) {
  // Network monitoring
  initNetworkAgent({
    wsUrl: "ws://192.168.1.100:5051",
  });

  // Add your custom axios instance
  addAxiosInstance(apiClient);

  // Console monitoring
  initConsoleAgent({
    wsUrl: "ws://192.168.1.100:5051",
    enabled: true,
  });
}
```

### 4. Find Your Local IP Address

**macOS / Linux:**

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**

```bash
ipconfig
```

Look for an address like 192.168.x.x or 10.0.x.x in the output.

### 5. Download and Start the Desktop Inspector

Download the desktop application for your platform:

- **macOS (Apple Silicon)**: [Rexpo Network Inspector-1.0.0-arm64.dmg](https://github.com/omeremreelmali/rexpo-debugger/releases/latest)
- **macOS (Intel)**: [Rexpo Network Inspector-1.0.0.dmg](https://github.com/omeremreelmali/rexpo-debugger/releases/latest)
- **Windows**: [Rexpo Network Inspector Setup 1.0.0.exe](https://github.com/omeremreelmali/rexpo-debugger/releases/latest)
- **Linux (x64)**: [Rexpo Network Inspector-1.0.0.AppImage](https://github.com/omeremreelmali/rexpo-debugger/releases/latest)
- **Linux (ARM64)**: [Rexpo Network Inspector-1.0.0-arm64.AppImage](https://github.com/omeremreelmali/rexpo-debugger/releases/latest)

> 📦 **All releases**: [View all releases on GitHub](https://github.com/omeremreelmali/rexpo-debugger/releases)

After downloading, open the application. It will automatically start a WebSocket server at `ws://localhost:5051`.

### 6. Run Your Expo Application

```bash
npx expo start
```

Open your app on a physical device or emulator. Network requests will automatically start appearing in the inspector! 🎉

## Configuration Options

```typescript
initNetworkAgent({
  // WebSocket URL (required)
  wsUrl: "ws://192.168.1.100:5051",

  // Enable/disable the agent (optional, default: true)
  enabled: true,

  // Maximum body snippet length (optional, default: 3000)
  maxBodyLength: 3000,

  // Enable detailed logging (optional, default: false)
  // When false, only critical errors are logged
  // When true, all network activity is logged
  debug: false,
});
```

### Debug Mode

By default, the agent runs in **silent mode** and only logs critical errors. To see detailed logs of all network activity:

```typescript
// Silent mode (default) - only critical errors
initNetworkAgent({
  wsUrl: "ws://192.168.1.100:5051",
});

// Debug mode - detailed logging
initNetworkAgent({
  wsUrl: "ws://192.168.1.100:5051",
  debug: true,
});
```

**Debug logs include:**

- Connection status
- Health checks (every 10 seconds)
- Request/response capturing
- Metadata tracking
- Interceptor setup

**Always logged (even in silent mode):**

- WebSocket connection errors
- Request/response errors
- Critical failures

## Troubleshooting

### "Connection refused" error

- Make sure you entered your computer's IP address correctly
- Make sure the inspector application is running
- Make sure your device is on the same WiFi network
- Check firewall settings

### Requests not showing up

- Enable debug mode to see detailed logs: `debug: true`
- Check for the "[NetworkAgent] Connected to inspector" message in the console (requires debug mode)
- Make sure you are in `__DEV__` mode
- Make sure the agent is initialized correctly
- Verify the desktop inspector app is running

### Body not showing up

Some request/response bodies may be binary or stream-based. The agent only displays text-based bodies.
