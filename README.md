# 🔍 Rexpo Network Inspector

A professional network debugging tool similar to **Flipper** and **Chrome DevTools** for your Expo and React Native applications.

<img width="1400" alt="Rexpo Network Inspector" src="./assets/debug-screenshot.png">

## ✨ Features

- 🚀 **Real-time monitoring**: View all network requests instantly
- 🎯 **Chrome DevTools-like UI**: Familiar and powerful interface
- 🔎 **Advanced filtering**: Filter by method, status code, and URL
- 📊 **Detailed analysis**: Headers, request/response body, timing information
- 💻 **Cross-platform**: Support for macOS, Windows, and Linux
- 🎨 **Modern UI**: Dark theme and responsive design
- ⚡ **Lightweight and fast**: Won't slow down your application
- 📦 **Fetch & Axios support**: Automatically captures both HTTP clients

## 🏗️ Architecture

This project consists of two main components:

1. **Desktop Inspector (Electron App)**: Desktop application that visualizes network traffic
2. **Expo Agent**: Lightweight client agent integrated into your Expo application

```
┌─────────────────────┐         WebSocket          ┌──────────────────────┐
│                     │    (ws://localhost:5051)   │                      │
│  Expo/RN App        │◄───────────────────────────┤  Desktop Inspector   │
│  (Mobile/Emulator)  │                            │  (Electron)          │
│                     │                            │                      │
│  + expoNetworkAgent │                            │  + WebSocket Server  │
│  + fetch override   │                            │  + React UI          │
└─────────────────────┘                            └──────────────────────┘
```

## 📦 Installation

### 1. Install the Inspector Application

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Or create a production build
npm run build
npm run package
```

### 2. Integrate the Expo Agent

Copy the `expo-agent/expoNetworkAgent.ts` file to your Expo project:

```bash
# In your Expo project
mkdir -p src/debug
cp path/to/expo-agent/expoNetworkAgent.ts src/debug/
```

Initialize the agent in your main file (e.g., `App.tsx`):

```typescript
import { initNetworkAgent } from "./src/debug/expoNetworkAgent";

if (__DEV__) {
  initNetworkAgent({
    wsUrl: "ws://YOUR_LOCAL_IP:5051", // Example: ws://192.168.1.100:5051
    enabled: true,
  });
}
```

### 3. Find Your Local IP Address

**macOS / Linux:**

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# or
ipconfig getifaddr en0
```

**Windows:**

```bash
ipconfig
```

Look for an address like `192.168.x.x` or `10.0.x.x` in the output and use it in the `wsUrl`.

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

### Main Screen

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

### Filtering and Search

- **Search**: Search by URL
- **Method Filter**: Show only specific methods
- **Status Filter**: Filter by status code
- **Pause**: Temporarily stop new requests
- **Clear**: Delete all requests

## 🔧 Configuration

### Agent Options

```typescript
initNetworkAgent({
  // WebSocket URL (required)
  wsUrl: "ws://192.168.1.100:5051",

  // Enable/disable agent (optional, default: true)
  enabled: true,

  // Maximum body snippet length (optional, default: 3000)
  maxBodyLength: 3000,
});
```

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

### "Connection refused" error

✅ **Solutions:**

- Ensure you entered your computer's IP address correctly
- Ensure the inspector application is running
- Ensure your device is on the same WiFi network
- Check your firewall settings

### Requests not showing up

✅ **Solutions:**

- Check for `[NetworkAgent] Connected to inspector` message in console
- Ensure you're in `__DEV__` mode
- Ensure the agent is properly initialized (is `initNetworkAgent` called?)

### Body not visible

⚠️ **Note:** Binary or stream bodies cannot be displayed. The agent only shows text-based bodies.

### Not working on emulator

✅ **Solutions:**

- **Android Emulator**: Use `10.0.2.2` address (host machine's localhost)
- **iOS Simulator**: `localhost` or your computer's IP address should work

## 🚀 Future Features

- [ ] XMLHttpRequest support
- [ ] WebSocket traffic monitoring
- [ ] GraphQL query/mutation visualization
- [ ] Export/Import feature (HAR format)
- [ ] Request replay feature
- [ ] Mock response feature
- [ ] Dark/Light theme toggle
- [ ] Automatic reconnect logic

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
