# Son yayınlanan sürüm

> Her yayından sonra güncellenir (bkz. [CLAUDE.md](CLAUDE.md)). Ayrıntılı geçmiş
> için [CHANGELOG.md](CHANGELOG.md).

## Özet

| Parça | Sürüm | Nerede | Tarih |
| --- | --- | --- | --- |
| Masaüstü uygulaması | **v1.9.2** | [GitHub Release](https://github.com/omeremreelmali/rexpo-debugger/releases/tag/v1.9.2) | 2026-11-26 |
| Agent (`rexpo-debugger`) | **1.5.1** yayında, **1.5.2 hazır ama henüz npm'e gönderilmedi** | [npm](https://www.npmjs.com/package/rexpo-debugger) | 1.5.1: 2026-11-05 |
| Web sitesi | 1.9.2'yi gösteriyor | https://rexpo.redvizor.app (`lib/release.ts` → `LATEST_VERSION = "1.9.2"`) | 2026-11-26 |

### Release dosyaları (v1.9.2)

| Dosya | Platform |
| --- | --- |
| `Rexpo.Network.Inspector-1.9.2-arm64.dmg` | macOS Apple Silicon (Developer ID ile imzalı, notarize edilmedi) |
| `Rexpo.Network.Inspector-1.9.2.dmg` | macOS Intel (imzalı, notarize edilmedi) |
| `Rexpo.Network.Inspector-1.9.2-win.zip` | Windows x64 (imzasız) |
| `Rexpo.Network.Inspector-1.9.2-arm64-win.zip` | Windows ARM64 (imzasız) |
| `Rexpo.Network.Inspector-1.9.2.AppImage` | Linux x64 |
| `Rexpo.Network.Inspector-1.9.2-arm64.AppImage` | Linux ARM64 |

## v1.9.2 içeriği

### Masaüstü

- Bozuk istek adresiyle gelen bir bağlantı artık uygulamayı dondurmuyor. Daha önce yeni bağlantıları durduruyor ve uygulamanın kapanmasını engelliyordu.
- Okunamayan kayıtlı koleksiyonlar boş listeyle ezilmiyor; yedekleniyor ve yerinde bırakılıyor.
- Hasarlı koleksiyon kayıtları her açılışta çökme yerine atlanıyor.
- Kayıt okunamadığında ya da depolama dolu olduğu için kaydedilemediğinde kullanıcıya bildiriliyor.
- Edit & Replay, dokunulmamış bir isteği yakalandığı gibi gönderiyor: `myapp://` URL'leri ve `ids=1,2,3` gibi sorgu değerleri bozulmuyor, gövde açılışta yeniden biçimlenmiyor.
- Pretty-print, cURL dışa aktarma ve "Save response", büyük sayıları (`9007199254740993`) ve sondaki sıfırları (`10.50`) koruyor.
- Yeni uygulama ikonu: terminal tasarımına uygun siyah panel, yeşil parıltılı "R", HUD ızgarası ve köşe çizgileri. Apple ikon ızgarasına uyuyor, Dock'ta artık büyük görünmüyor.

### Agent 1.5.2 (kodda ve GitHub'da; npm'e gönderilmeyi bekliyor)

- Masaüstü kapalıyken her agent her denemede hata basmak yerine kesinti başına tek satır yazıyor. `console.error` kullanmıyor, bu yüzden React Native'de kırmızı LogBox çıkmıyor.
- Agent'ların kendi mesajları artık uygulama logu olarak yakalanmıyor.
- `restoreConsole` sonrası `initConsoleAgent` ya da `stopStateAgent` sonrası `initStateAgent` çağrıldığında tek ve çalışan bir soket kalıyor.
- `restoreConsole` yeniden bağlanmayı da durduruyor.

## Henüz yayınlanmayanlar

- Agent `rexpo-debugger` 1.5.2 npm'e gönderilmedi. npm oturumu gerektiği için kullanıcı yayınlayacak: `cd expo-agent && npm login && npm publish --access public`.
