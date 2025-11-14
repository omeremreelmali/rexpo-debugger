# 📁 Project Structure

This document explains the detailed file structure of the Rexpo Network Inspector project and the purpose of each file.

## 📂 Directory Tree

```
expo-network-inspector/
│
├── 📄 package.json                      # NPM dependencies and scripts
├── 📄 tsconfig.json                     # React/Renderer TypeScript config
├── 📄 tsconfig.electron.json            # Electron TypeScript config
├── 📄 tsconfig.node.json                # Node/Vite TypeScript config
├── 📄 vite.config.ts                    # Vite bundler configuration
├── 📄 .gitignore                        # Git ignore rules
├── 📄 .npmrc                            # NPM configuration
├── 📄 .editorconfig                     # Editor configuration
├── 📄 .cursorignore                     # Cursor ignore rules
│
├── 📚 README.md                         # Main documentation
├── 📚 QUICKSTART.md                     # Quick start guide
├── 📚 EXAMPLE_EXPO_INTEGRATION.md       # Detailed integration example
├── 📚 CHANGELOG.md                      # Version history
├── 📚 LICENSE                           # MIT License
├── 📚 PROJECT_STRUCTURE.md              # This file
│
├── 📁 electron/                         # Electron main process
│   ├── main.ts                          # ⭐ Main Electron process
│   │                                    #    - BrowserWindow creation
│   │                                    #    - WebSocket server (port 5051)
│   │                                    #    - IPC message forwarding
│   │
│   ├── preload.ts                       # 🔌 Preload script
│   │                                    #    - Context isolation bridge
│   │                                    #    - window.electron API
│   │
│   └── types.ts                         # 📝 Shared type definitions
│                                        #    - NetworkMessage types
│                                        #    - RequestState interface
│
├── 📁 renderer/                         # React renderer (UI)
│   ├── index.html                       # HTML entry point
│   ├── main.tsx                         # ⚛️ React entry point
│   ├── App.tsx                          # 🎯 Main React component
│   ├── App.css                          # 🎨 Global styles
│   ├── types.ts                         # 📝 Renderer type definitions
│   ├── vite.svg                         # 🖼️ Favicon
│   │
│   ├── 📁 state/                        # State management
│   │   └── NetworkContext.tsx           # 🔄 Global network state
│   │                                    #    - State with useReducer
│   │                                    #    - IPC message listener
│   │                                    #    - Request/response merging
│   │
│   └── 📁 components/                   # React components
│       ├── FilterBar.tsx                # 🔍 Top bar
│       ├── FilterBar.css                #    - Search, filters
│       │                                #    - Pause/Clear buttons
│       │
│       ├── NetworkTable.tsx             # 📊 Request list
│       ├── NetworkTable.css             #    - Sortable table
│       │                                #    - Status badges
│       │                                #    - Method badges
│       │
│       ├── RequestDetails.tsx           # 📄 Request details
│       └── RequestDetails.css           #    - Tabbed interface
│                                        #    - Headers, body, timing
│
└── 📁 expo-agent/                       # Expo client agent
    ├── expoNetworkAgent.ts              # ⭐ Agent implementation
    │                                    #    - global.fetch override
    │                                    #    - WebSocket client
    │                                    #    - Request/response capture
    │
    └── README.md                        # Agent documentation
```

## 🔑 Key Files

### ⭐ Critical Files (Be careful when making changes)

| File                                | Purpose                                 | Dependencies |
| ----------------------------------- | --------------------------------------- | ------------ |
| `electron/main.ts`                  | Electron main process, WebSocket server | electron, ws |
| `electron/preload.ts`               | IPC bridge                              | electron     |
| `renderer/state/NetworkContext.tsx` | Global state management                 | react        |
| `expo-agent/expoNetworkAgent.ts`    | Client agent                            | -            |

### 📝 Type Definitions

```typescript
// electron/types.ts & renderer/types.ts (dublicate)

type NetworkMessage =
  | { type: "request", id, url, method, ... }
  | { type: "response", id, status, body, ... };

interface RequestState {
  id: string;
  url: string;
  method: string;
  status?: number;
  // ... all request/response data
}
```

### 🎨 UI Components Hierarchy

```
App.tsx
├── NetworkProvider (Context)
│   ├── FilterBar
│   │   ├── Search Input
│   │   ├── Method Filter
│   │   ├── Status Filter
│   │   └── Pause/Clear Buttons
│   │
│   ├── NetworkTable (Sol Panel)
│   │   └── Request Rows
│   │       ├── Method Badge
│   │       ├── Status Badge
│   │       └── URL/Duration/Time
│   │
│   └── RequestDetails (Sağ Panel)
│       └── Tabs
│           ├── Overview
│           ├── Headers
│           ├── Request
│           ├── Response
│           └── Timing
```

## 🔄 Data Flow

```
┌──────────────────┐
│  Expo App        │
│  (Mobile)        │
└────────┬─────────┘
         │ 1. fetch() call
         │
┌────────▼──────────────┐
│  expoNetworkAgent.ts  │
│  - global.fetch       │
│    override           │
└────────┬──────────────┘
         │ 2. WebSocket message
         │    (NetworkMessage)
         │
┌────────▼──────────────┐
│  electron/main.ts     │
│  - WebSocket server   │
│  - Port 5051          │
└────────┬──────────────┘
         │ 3. IPC forward
         │    ("network-message")
         │
┌────────▼──────────────┐
│  electron/preload.ts  │
│  - Context bridge     │
└────────┬──────────────┘
         │ 4. window.electron
         │
┌────────▼──────────────┐
│  NetworkContext.tsx   │
│  - useReducer         │
│  - State merge        │
└────────┬──────────────┘
         │ 5. React state
         │
┌────────▼──────────────┐
│  UI Components        │
│  - NetworkTable       │
│  - RequestDetails     │
└───────────────────────┘
```

## 🏗️ Build Process

### Development

```bash
npm run dev
├── 1. vite dev server (port 5173)
│      renderer/ → http://localhost:5173
└── 2. electron .
       electron/main.ts → BrowserWindow.loadURL()
```

### Production

```bash
npm run build
├── 1. vite build
│      renderer/ → dist/renderer/
├── 2. tsc -p tsconfig.electron.json
│      electron/ → dist/electron/
└── 3. electron-builder
       dist/ → release/ (.dmg, .exe, .AppImage)
```

## 📦 Dependencies

### Runtime Dependencies

```json
{
  "react": "React UI library",
  "react-dom": "React DOM renderer",
  "ws": "WebSocket server"
}
```

### Dev Dependencies

```json
{
  "electron": "Desktop framework",
  "vite": "Modern bundler",
  "typescript": "Type checking",
  "electron-builder": "Package builder"
}
```

## 🔧 Configuration Files

### TypeScript

- `tsconfig.json`: Renderer (React) config

  - Target: ES2020
  - Module: ESNext
  - JSX: react-jsx

- `tsconfig.electron.json`: Electron config
  - Target: ES2020
  - Module: commonjs
  - Output: dist/electron/

### Vite

- `vite.config.ts`:
  - Root: renderer/
  - Output: dist/renderer/
  - Port: 5173

### Electron Builder

- `package.json` > `build`:
  - macOS: .dmg
  - Windows: .exe (NSIS)
  - Linux: .AppImage

## 🎯 Development Tips

### Adding New Features

1. **Adding a new field to network message:**

   - Update `electron/types.ts` and `renderer/types.ts`
   - Update state in `NetworkContext.tsx`
   - Display in UI components

2. **Adding a new UI component:**

   - Create under `renderer/components/`
   - Add CSS file
   - Import into `App.tsx` or relevant parent

3. **Adding a new filter:**
   - Add filter type in `types.ts`
   - Add reducer case in `NetworkContext.tsx`
   - Add UI in `FilterBar.tsx`

### Debugging

**Renderer (React):**

- Chrome DevTools opens automatically (dev mode)
- You can use `console.log()`

**Electron Main:**

- `console.log()` appears in terminal
- You can add VSCode debugging configuration

**Agent (Expo):**

- `console.log()` appears in Metro bundler
- Look for logs with `[NetworkAgent]` prefix

## 📚 Additional Resources

- [Electron Docs](https://www.electronjs.org/docs)
- [React Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

**Last Updated:** 2025-11-14
