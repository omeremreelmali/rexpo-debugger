# Changelog

All notable changes to this project will be documented in this file.

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
