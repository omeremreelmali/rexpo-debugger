# 🚀 Quick Start Guide

Get started with Rexpo Network Inspector in 5 minutes!

## ⚡ TL;DR

```bash
# 1. Install dependencies
npm install

# 2. Start the inspector
npm run dev

# 3. Use the agent in your Expo project
# (copy expo-agent/expoNetworkAgent.ts file)

# 4. Run your Expo app
# See network requests! 🎉
```

## 📋 Detailed Steps

### 1️⃣ Install the Inspector

```bash
# Clone the repo (if you haven't already)
git clone https://github.com/omeremreelmali/rexpo-debugger.git
cd rexpo-debugger

# Install dependencies
npm install

# Start in development mode
npm run dev
```

✅ **Success!** The inspector is now running at `ws://localhost:5051`.

### 2️⃣ Find Your IP Address

**macOS/Linux:**

```bash
ipconfig getifaddr en0
# Example output: 192.168.1.100
```

**Windows:**

```bash
ipconfig
# Find the "IPv4 Address" line
```

📝 **Note:** You'll use this IP address in the next step.

### 3️⃣ Add the Agent to Your Expo Project

```bash
# Navigate to your Expo project directory
cd /path/to/your-expo-project

# Create debug folder
mkdir -p src/debug

# Copy the agent file
cp /path/to/rexpo-debugger/expo-agent/expoNetworkAgent.ts src/debug/
```

### 4️⃣ Initialize the Agent

Open your `App.tsx` file and add:

```typescript
import { initNetworkAgent } from "./src/debug/expoNetworkAgent";

if (__DEV__) {
  initNetworkAgent({
    wsUrl: "ws://192.168.1.100:5051", // Replace with your IP address
  });
}

// ... rest of your code
```

### 5️⃣ Test It

```bash
# Start your Expo app
npx expo start

# Scan the QR code or open in emulator
```

### 6️⃣ Send a Network Request

Make an API call in your app:

```typescript
const testFetch = async () => {
  const response = await fetch("https://jsonplaceholder.typicode.com/posts/1");
  const data = await response.json();
  console.log(data);
};

testFetch();
```

🎉 **Congratulations!** You'll see the request in the inspector!

## 🎯 Quick Test

You can test using this simple component in your Expo project:

```typescript
import React from "react";
import { View, Button, Text, StyleSheet } from "react-native";

export default function App() {
  const [result, setResult] = React.useState("");

  const testRequest = async () => {
    try {
      const res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (error) {
      setResult("Error: " + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Inspector Test</Text>
      <Button title="Test Request" onPress={testRequest} />
      {result ? <Text style={styles.result}>{result}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  result: { marginTop: 20, fontSize: 12, fontFamily: "monospace" },
});
```

## 🐛 Not Working?

### ❌ "Connection refused" error

**Solution:**

- Make sure the inspector is running (`npm run dev`)
- Make sure you entered the correct IP address
- Make sure you're on the same WiFi network

### ❌ Requests not appearing

**Check the console:**

You should see:

```
[NetworkAgent] ✅ Connected to inspector: ws://192.168.1.100:5051
```

If you don't see it:

- Make sure `initNetworkAgent()` is called
- Check that you're in `__DEV__` mode
- Double-check the IP address

### ❌ Not working in emulator

**Android Emulator:**

```typescript
initNetworkAgent({
  wsUrl: "ws://10.0.2.2:5051", // Special Android emulator address
});
```

**iOS Simulator:**

```typescript
initNetworkAgent({
  wsUrl: "ws://localhost:5051", // or your computer's IP
});
```

## 📚 More Information

- [Main README](./README.md) - Full documentation
- [Integration Example](./EXAMPLE_EXPO_INTEGRATION.md) - Detailed examples
- [Expo Agent README](./expo-agent/README.md) - Agent details

## 💡 Pro Tips

1. **Use Environment Variables:**

```typescript
const INSPECTOR_URL = __DEV__ ? "ws://192.168.1.100:5051" : undefined;

if (INSPECTOR_URL) {
  initNetworkAgent({ wsUrl: INSPECTOR_URL });
}
```

2. **Conditional Activation:**

```typescript
initNetworkAgent({
  wsUrl: "ws://192.168.1.100:5051",
  enabled: !process.env.DISABLE_INSPECTOR, // Control with env var
});
```

3. **Larger Bodies:**

```typescript
initNetworkAgent({
  wsUrl: "ws://192.168.1.100:5051",
  maxBodyLength: 10000, // Default is 3000
});
```

## 🎓 Next Steps

- ✅ Test different request types (POST, PUT, DELETE)
- ✅ Inspect headers
- ✅ Check response timings
- ✅ Explore filter features
- ✅ Find specific requests with search

---

**Good luck!** 🚀 If you have any questions, please open an issue.
