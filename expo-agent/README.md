# Expo Network Agent

This folder contains the network agent file to be used in your Expo application.

## ✨ Supported HTTP Libraries

- ✅ **fetch API** (native)
- ✅ **axios** (with interceptors)
- ✅ Automatic detection

## Usage

### 1. Copy the File

Copy the `expoNetworkAgent.ts` file to your Expo project:

```bash
# Example directory structure
your-expo-project/
  src/
    debug/
      expoNetworkAgent.ts  ← Copy here
```

### 2. Initialize the Agent

Initialize the agent in your main file (e.g. `App.tsx` or `index.js`):

```typescript
import { initNetworkAgent } from "./src/debug/expoNetworkAgent";

if (__DEV__) {
  initNetworkAgent({
    wsUrl: "ws://192.168.1.100:5051", // Your computer's local IP address
    enabled: true,
  });

  addAxiosInstance(axios.getAxiosInstance()); // Define your Axios instance
}
```

### 3. Find Your Local IP Address

**macOS / Linux:**

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**

```bash
ipconfig
```

Look for an address like 192.168.x.x or 10.0.x.x in the output.

### 4. Start the Inspector Application

Open your desktop inspector application. The app will automatically start a WebSocket server at `ws://localhost:5051`.

### 5. Run Your Expo Application

```bash
npx expo start
```

Open your app on a physical device or emulator. Network requests will automatically start appearing in the inspector!

## Configuration Options

```typescript
initNetworkAgent({
  // WebSocket URL (required)
  wsUrl: "ws://192.168.1.100:5051",

  // Enable/disable the agent (optional, default: true)
  enabled: true,

  // Maximum body snippet length (optional, default: 3000)
  maxBodyLength: 3000,
});
```

## Troubleshooting

### "Connection refused" error

- Make sure you entered your computer's IP address correctly
- Make sure the inspector application is running
- Make sure your device is on the same WiFi network
- Check firewall settings

### Requests not showing up

- Check for the "[NetworkAgent] Connected to inspector" message in the console
- Make sure you are in `__DEV__` mode
- Make sure the agent is initialized correctly

### Body not showing up

Some request/response bodies may be binary or stream-based. The agent only displays text-based bodies.
