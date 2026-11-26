# Son yayınlanan sürüm

> Her yayından sonra güncellenir (bkz. [CLAUDE.md](CLAUDE.md)). Ayrıntılı geçmiş
> için [CHANGELOG.md](CHANGELOG.md).

## Özet

| Parça | Sürüm | Nerede | Tarih |
| --- | --- | --- | --- |
| Masaüstü uygulaması | **v1.9.1** | [GitHub Release](https://github.com/omeremreelmali/rexpo-debugger/releases/tag/v1.9.1) (`5c6343d`) | 2026-11-05 |
| Agent (`rexpo-debugger`) | **1.5.1** | [npm](https://www.npmjs.com/package/rexpo-debugger) | 2026-11-05 |
| Web sitesi | 1.9.1'i gösteriyor | https://rexpo.redvizor.app (`lib/release.ts` → `LATEST_VERSION = "1.9.1"`) | 2026-11-05 |

### Release dosyaları (v1.9.1)

| Dosya | Platform |
| --- | --- |
| `Rexpo.Network.Inspector-1.9.1-arm64.dmg` | macOS Apple Silicon (Developer ID ile imzalı, notarize edilmedi) |
| `Rexpo.Network.Inspector-1.9.1.dmg` | macOS Intel (imzalı, notarize edilmedi) |
| `Rexpo.Network.Inspector-1.9.1-win.zip` | Windows x64 (imzasız) |
| `Rexpo.Network.Inspector-1.9.1-arm64-win.zip` | Windows ARM64 (imzasız) |
| `Rexpo.Network.Inspector-1.9.1.AppImage` | Linux x64 |
| `Rexpo.Network.Inspector-1.9.1-arm64.AppImage` | Linux ARM64 |

## v1.9.1 içeriği

1.9.0'daki terminal tarzı yeniden tasarımın üzerine güvenilirlik ve güvenlik düzeltmeleri.

### Masaüstü

- Otomatik temizleme yalnızca ilk soket bağlandığında çalışıyor; açılıştaki istekler ve başka cihazın trafiği silinmiyor.
- Bozuk agent mesajları doğrulanıyor, uygulama çökmüyor; bir error boundary render hatasında pencerenin boş kalmasını önlüyor.
- Replay, uygulamanın isteği alıp almadığını bildiriyor ve uygulama yeniden bağlandıktan sonra da çalışıyor. Yakalanırken kesilmiş bir gövde bozuk gönderilmek yerine reddediliyor. Dosya işlemleri sonsuz yüklenmek yerine mesajla başarısız oluyor.
- Komutlar hiçbir zaman tüm istemcilere gitmiyor; kayıtlı isteklerin auth header'ları tek uygulamada kalıyor.
- Web sayfaları WebSocket portuna bağlanamıyor (Origin kontrolü).
- Kayıtlı port açılışta uygulanıyor, port değişince bağlı agent'lar yeni porta taşınıyor, meşgul port `LISTEN` yerine `DOWN` görünüyor.
- Aynı anda yalnızca bir uygulama kopyası çalışıyor.
- Eski agent'ların axios hata kodları `ERR` yerine `404` gibi gösteriliyor.
- Pause sırasında gelen yanıtlar ekrandaki istekleri tamamlıyor; ERR filtresi bekleyen istekleri listelemiyor.
- `ws` paketi yüksek önem dereceli bir güvenlik açığı için güncellendi.

### Agent 1.5.1

- `fetch` debugger'ı beklemiyor; yanıt uygulamaya hemen dönüyor, stream ve binary gövdeler okunmuyor.
- Axios URL'leri `params` ve `baseURL` içeriyor, 4xx/5xx durum kodları doğru raporlanıyor ve gerçek isteklere `X-Network-Inspector-ID` header'ı eklenmiyor.

## Henüz yayınlanmayanlar (planlanan v1.9.2 / agent 1.5.2)

`main` dalında commit edildi (`cb2ad35`), **henüz push edilmedi ve yayınlanmadı**. Ayrıntılar CHANGELOG.md'nin `[Unreleased]` bölümünde.

- Bozuk istek adresiyle gelen bir bağlantı artık masaüstü uygulamasını dondurmuyor.
- Okunamayan veya hasarlı kayıtlı koleksiyonlar silinmiyor; yedekleniyor ve kullanıcıya bildiriliyor. Kayıt başarısız olursa uyarı çıkıyor.
- Edit & Replay, düzenlenmemiş bir isteği aynen gönderiyor; `myapp://` URL'leri, sorgu değerleri ve büyük sayılar bozulmuyor.
- Agent'lar masaüstü kapalıyken her kesinti için tek satır yazıyor, `console.error` kullanmıyor ve kendi mesajlarını uygulama logu olarak göndermiyor.
- Yeniden init'te eski soket yenisini bozmuyor; `restoreConsole` yeniden bağlanmayı durduruyor.
