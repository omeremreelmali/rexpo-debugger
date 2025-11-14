# 📋 Console Agent Kullanım Kılavuzu

Rexpo Debugger artık **console logları** yakalayabiliyor! Network isteklerine ek olarak, tüm `console.log`, `console.warn`, `console.error`, `console.info` ve `console.debug` çağrılarınızı gerçek zamanlı olarak izleyebilirsiniz.

## ✨ Özellikler

- 🎯 **Tüm console seviyelerini yakala**: log, info, warn, error, debug
- 🔍 **Detaylı görüntüleme**: Arguments, stack traces, timestamps
- 🎨 **Renkli seviye göstergeleri**: Her log seviyesi için farklı renk
- 📊 **Gelişmiş filtreleme**: Log seviyesine ve içeriğe göre filtrele
- ⚡ **Zero overhead**: Production'da otomatik olarak devre dışı

## 🚀 Kurulum

### 1. Agent'ları Kopyalayın

```bash
# Expo projenizde
mkdir -p src/debug
cp path/to/expo-agent/src/* src/debug/
```

### 2. App.tsx'de Initialize Edin

```typescript
import { initNetworkAgent, initConsoleAgent } from "./src/debug";

if (__DEV__) {
  // Network monitoring
  initNetworkAgent({
    wsUrl: "ws://192.168.1.100:5051", // Bilgisayarınızın IP adresi
    enabled: true,
    debug: false, // true yaparsanız agent logları görürsünüz
  });

  // Console monitoring
  initConsoleAgent({
    wsUrl: "ws://192.168.1.100:5051", // Aynı WebSocket bağlantısı
    enabled: true,
    debug: false,
    captureStackTrace: true, // Error ve warning için stack trace yakala
  });
}
```

### 3. Desktop Inspector'ı Başlatın

```bash
npm run dev
```

## 📱 Kullanım Örnekleri

### Basit Loglar

```typescript
console.log("Uygulama başlatıldı");
console.info("Kullanıcı giriş yaptı:", userId);
console.warn("API yavaş yanıt veriyor");
console.error("Veri yüklenemedi");
console.debug("Debug bilgisi:", { data: 123 });
```

### Nesneler ve Diziler

```typescript
const user = {
  id: 1,
  name: "Ahmet",
  email: "ahmet@example.com"
};

console.log("Kullanıcı verisi:", user);
console.log("Liste:", [1, 2, 3, 4, 5]);
```

### Error Yakalama

```typescript
try {
  throw new Error("Bir şeyler yanlış gitti!");
} catch (error) {
  console.error("Hata yakalandı:", error);
  // Stack trace otomatik olarak yakalanır
}
```

### Çoklu Argümanlar

```typescript
const apiUrl = "https://api.example.com";
const userId = 123;

console.log("API çağrısı:", apiUrl, "User ID:", userId);
```

### Özel Tipler

```typescript
// Date objesi
console.log("Şimdiki zaman:", new Date());

// RegExp
console.log("Pattern:", /[a-z]+/gi);

// Function
const myFunc = function calculate() { return 42; };
console.log("Function:", myFunc);
```

## 🎛️ Inspector UI

### Console Sekmesi

1. **Tab Navigation**: Network ↔️ Console arasında geçiş yapın
2. **Log Listesi**: Tüm console loglarını kronolojik sırada görün
3. **Level Filter**: Sadece belirli seviyeleri göster (log, warn, error, vb.)
4. **Search**: Log içeriğinde arama yapın
5. **Details Panel**: Seçili log'un detaylarını görün

### Log Seviyeleri ve Renkler

- 🔵 **LOG** - Mavi (Genel bilgi)
- 💙 **INFO** - Açık mavi (Bilgilendirme)
- 🟠 **WARN** - Turuncu (Uyarı)
- 🔴 **ERROR** - Kırmızı (Hata)
- 🟣 **DEBUG** - Mor (Debug bilgisi)

## ⚙️ Konfigürasyon

### ConsoleAgentOptions

```typescript
interface ConsoleAgentOptions {
  /** WebSocket URL (zorunlu) */
  wsUrl: string;
  
  /** Agent'ı aktif/deaktif et (default: true) */
  enabled?: boolean;
  
  /** Debug modu - agent loglarını göster (default: false) */
  debug?: boolean;
  
  /** Error/warning için stack trace yakala (default: true) */
  captureStackTrace?: boolean;
}
```

### Örnek: Sadece Production-like Testing

```typescript
if (__DEV__) {
  initConsoleAgent({
    wsUrl: "ws://192.168.1.100:5051",
    enabled: true,
    debug: false,
    captureStackTrace: false, // Performance için kapatabilirsiniz
  });
}
```

## 🔧 İleri Seviye Kullanım

### Agent'ı Durdurma

```typescript
import { restoreConsole } from "./src/debug";

// Console metodlarını orijinal haline döndür
restoreConsole();
```

### Her İki Agent'ı Birlikte Kullanma

```typescript
import { 
  initNetworkAgent, 
  initConsoleAgent,
  addAxiosInstance 
} from "./src/debug";
import { apiClient } from "./api/client";

if (__DEV__) {
  // Network agent
  initNetworkAgent({
    wsUrl: "ws://192.168.1.100:5051",
    enabled: true,
  });

  // Axios instance ekle
  addAxiosInstance(apiClient);

  // Console agent
  initConsoleAgent({
    wsUrl: "ws://192.168.1.100:5051",
    enabled: true,
    captureStackTrace: true,
  });
}
```

## 🐛 Troubleshooting

### Console logları görünmüyor

✅ **Çözümler:**
- Inspector'da "Console" sekmesine geçtiğinizden emin olun
- `initConsoleAgent()` fonksiyonunun çağrıldığını kontrol edin
- Browser console'da `[ConsoleAgent] Connected to inspector` mesajını arayın
- WebSocket bağlantısının açık olduğunu kontrol edin

### Stack trace eksik

✅ **Çözümler:**
- `captureStackTrace: true` olarak ayarlandığından emin olun
- Stack trace sadece `error` ve `warn` seviyeleri için yakalanır

### Performance sorunları

✅ **Öneriler:**
- `captureStackTrace: false` yaparak stack trace yakalamayı kapatın
- Çok fazla log üretiyorsanız, geliştirme sırasında geçici olarak devre dışı bırakın
- Production build'de otomatik olarak devre dışı kalır (`__DEV__` kontrolü)

## 📊 Farklar: Network vs Console

| Özellik | Network Agent | Console Agent |
|---------|--------------|---------------|
| **Ne yakalar** | fetch & axios istekleri | console.* metodları |
| **Dosya** | `agent.ts` | `console-agent.ts` |
| **Singleton** | ✅ Ayrı singleton | ✅ Ayrı singleton |
| **Override** | `global.fetch` | `console.*` metodları |
| **WebSocket** | Aynı bağlantı | Aynı bağlantı |
| **UI Tab** | Network | Console |

## 🎯 En İyi Pratikler

1. **Development Only**: Her zaman `__DEV__` kontrolü içinde kullanın
2. **Tek Initialization**: `initConsoleAgent()` sadece bir kez çağırın
3. **Debug Mode**: Sorun giderirken `debug: true` yapın
4. **Selective Logging**: Çok kritik olmayan logları geliştirme sırasında kapatmayı düşünün
5. **Stack Traces**: Performance kritikse sadece error'lar için kullanın

## 💡 İpuçları

### Conditional Logging

```typescript
const DEBUG_LEVEL = __DEV__ ? 'debug' : 'error';

function log(level: string, ...args: any[]) {
  if (level === 'debug' && DEBUG_LEVEL !== 'debug') return;
  console[level](...args);
}
```

### Structured Logging

```typescript
function logEvent(event: string, data: any) {
  console.log(`[${event}]`, {
    timestamp: new Date().toISOString(),
    event,
    data,
  });
}

logEvent('user_login', { userId: 123, method: 'google' });
```

### Performance Monitoring

```typescript
console.time('api_call');
await fetchData();
console.timeEnd('api_call'); // Süreyi gösterir
```

## 🔗 Daha Fazla Bilgi

- [README.md](./README.md) - Ana dokümantasyon
- [EXAMPLE_EXPO_INTEGRATION.md](./EXAMPLE_EXPO_INTEGRATION.md) - Entegrasyon örneği
- [expo-agent/README.md](./expo-agent/README.md) - Agent detayları

---

**Made with ❤️ for Expo developers**

