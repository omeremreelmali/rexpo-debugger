# Expo Integration Example

This document shows step-by-step how to integrate Rexpo Network Inspector into an Expo project.

## 📋 Step-by-Step Integration

### 1. Copy the Agent File

```bash
# In your Expo project root directory
mkdir -p src/debug
cp /path/to/rexpo-debugger/expo-agent/expoNetworkAgent.ts src/debug/
```

### 2. Initialize the Agent in App.tsx

```typescript
// App.tsx (or index.js)
import React from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import { initNetworkAgent } from "./src/debug/expoNetworkAgent";

// ⚠️ IMPORTANT: Initialize at the top (after all imports, before component)
if (__DEV__) {
  initNetworkAgent({
    // Your computer's local IP address
    // macOS/Linux: Find with "ifconfig | grep inet"
    // Windows: Find with "ipconfig"
    wsUrl: "ws://192.168.1.100:5051",
    enabled: true,
    maxBodyLength: 5000, // Optional
  });
}

export default function App() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const testRequest = async () => {
    setLoading(true);
    try {
      // This request will automatically appear in the inspector!
      const response = await fetch(
        "https://jsonplaceholder.typicode.com/posts/1"
      );
      const json = await response.json();
      setData(json);
      console.log("Data fetched:", json);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rexpo Network Inspector Demo</Text>

      <Button
        title={loading ? "Loading..." : "Send Test Request"}
        onPress={testRequest}
        disabled={loading}
      />

      {data && (
        <View style={styles.dataContainer}>
          <Text style={styles.dataText}>{JSON.stringify(data, null, 2)}</Text>
        </View>
      )}

      <Text style={styles.hint}>See network requests in the inspector! 🔍</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  dataContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    maxHeight: 300,
  },
  dataText: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  hint: {
    marginTop: 20,
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
});
```

### 3. If Using TypeScript (tsconfig.json)

Make TypeScript recognize the `__DEV__` variable:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "types": ["react-native"]
  }
}
```

Or add a global type definition:

```typescript
// src/types/global.d.ts
declare const __DEV__: boolean;
```

### 4. Test It

```bash
# Start the inspector application (in another terminal)
cd /path/to/rexpo-debugger
npm run dev

# Start your Expo app
cd /path/to/your-expo-app
npx expo start
```

## 🧪 Test Scenarios

### GET Request

```typescript
fetch("https://api.example.com/users/1")
  .then((res) => res.json())
  .then((data) => console.log(data));
```

### POST Request

```typescript
fetch("https://api.example.com/users", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "John Doe",
    email: "john@example.com",
  }),
})
  .then((res) => res.json())
  .then((data) => console.log(data));
```

### Request with Headers

```typescript
fetch("https://api.example.com/protected", {
  method: "GET",
  headers: {
    Authorization: "Bearer YOUR_TOKEN",
    "X-Custom-Header": "value",
  },
})
  .then((res) => res.json())
  .then((data) => console.log(data));
```

### Error Handling

```typescript
fetch("https://invalid-url-that-will-fail.com")
  .then((res) => res.json())
  .catch((error) => {
    // Error will also appear in the inspector!
    console.error("Network error:", error);
  });
```

## 🔍 What You'll See in the Inspector

For each request:

- ✅ **Method**: GET, POST, PUT, DELETE, PATCH
- ✅ **URL**: Full URL
- ✅ **Status**: 200, 404, 500, etc.
- ✅ **Duration**: Time in ms
- ✅ **Request Headers**: All headers
- ✅ **Request Body**: JSON/text body
- ✅ **Response Headers**: All headers
- ✅ **Response Body**: JSON/text body (pretty-printed)
- ✅ **Timing**: Start/end timestamps

## 💡 Tips

### 1. Finding IP Address

**macOS/Linux:**

```bash
# List all IP addresses
ifconfig | grep "inet " | grep -v 127.0.0.1

# Simplest method (macOS)
ipconfig getifaddr en0
```

**Windows:**

```bash
ipconfig
```

### 2. Physical Device vs Emulator

**Physical Device:**

- Must be on the same WiFi network
- Use your computer's IP address (e.g: `192.168.1.100`)

**Android Emulator:**

- Use `10.0.2.2` (host machine's localhost)
- Example: `ws://10.0.2.2:5051`

**iOS Simulator:**

- `localhost` or your computer's IP address works

### 3. Firewall Settings

If the inspector isn't working:

**macOS:**

```bash
# Open port 5051
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /path/to/Electron
```

**Windows:**

- Windows Defender Firewall > Inbound Rules
- Open port 5051

### 4. Disable in Production Builds

The agent automatically checks `__DEV__`, but for security:

```typescript
if (__DEV__ && !process.env.DISABLE_NETWORK_INSPECTOR) {
  initNetworkAgent({
    wsUrl: "ws://192.168.1.100:5051",
  });
}
```

## 🐛 Common Issues

### "WebSocket connection failed"

**Cause:** Inspector not running or incorrect IP address

**Solution:**

1. Make sure the inspector is running
2. Check the IP address
3. Make sure you're on the same WiFi network

### "Requests not appearing"

**Cause:** Agent not initialized properly

**Solution:**

1. Look for these messages in the console:
   - `[NetworkAgent] Connected to inspector: ws://...`
2. Make sure `initNetworkAgent()` is called
3. Check that you're in `__DEV__` mode

### "Body not showing"

**Cause:** Binary or stream content

**Solution:**

- Agent only displays text-based bodies
- Binary content like images/videos won't be shown

## 📚 Additional Resources

- [Expo Networking Docs](https://docs.expo.dev/versions/latest/sdk/network/)
- [React Native Networking](https://reactnative.dev/docs/network)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

**For questions:** GitHub Issues
