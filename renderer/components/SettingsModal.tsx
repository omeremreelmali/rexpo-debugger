import { useEffect, useRef, useState } from "react";
import { useSettings, ThemeMode } from "../state/SettingsContext";
import { FilterLogLevel } from "../types";
import "./SettingsModal.css";

type PortApplyStatus =
  | { kind: "idle" }
  | { kind: "applying" }
  | { kind: "success"; port: number }
  | { kind: "error"; message: string };

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LOG_LEVELS: FilterLogLevel[] = ["ALL", "log", "info", "warn", "error", "debug"];
const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

/**
 * A small inline tag that flags a setting as not yet wired to runtime
 * behaviour. The setting is still persisted to localStorage — it will be
 * wired in a future release.
 */
function ComingSoonTag() {
  return (
    <span className="setting-pending" title="Bu ayar henüz canlı davranışa bağlı değil — yakında">
      Yakında
    </span>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Network port — kept locally until "Apply" so each keystroke doesn't trigger
  // a server restart. Resets when the modal is reopened.
  const [pendingPort, setPendingPort] = useState<number>(settings.connection.port);
  const [portStatus, setPortStatus] = useState<PortApplyStatus>({ kind: "idle" });

  // Keep pendingPort in sync when settings change from outside (e.g. Reset).
  useEffect(() => {
    setPendingPort(settings.connection.port);
    setPortStatus({ kind: "idle" });
  }, [settings.connection.port, isOpen]);

  const applyPort = async () => {
    if (pendingPort === settings.connection.port) return;
    if (!window.electron?.setNetworkPort) {
      setPortStatus({ kind: "error", message: "IPC köprüsü bulunamadı" });
      return;
    }
    setPortStatus({ kind: "applying" });
    try {
      const result = await window.electron.setNetworkPort(pendingPort);
      if (result.ok) {
        updateSettings({ connection: { port: result.port } });
        setPortStatus({ kind: "success", port: result.port });
        // Reset the success indicator after a moment so it doesn't linger.
        setTimeout(() => {
          setPortStatus((s) => (s.kind === "success" ? { kind: "idle" } : s));
        }, 2500);
      } else {
        // Server stayed on the old port; revert the input so the UI matches reality.
        setPendingPort(result.port);
        setPortStatus({ kind: "error", message: result.error || "Port değiştirilemedi" });
      }
    } catch (err) {
      setPortStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Bilinmeyen hata",
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="settings-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header className="settings-header">
          <h2 id="settings-title">⚙ Settings</h2>
          <button
            className="settings-close"
            onClick={onClose}
            aria-label="Close settings"
            type="button"
          >
            ✕
          </button>
        </header>

        <div className="settings-body">
          {/* ─── Network ───────────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">🌐 Network</h3>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Auto-clear on app init</span>
                <span className="settings-row-hint">
                  Agent yeniden bağlandığında listeyi otomatik temizle
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.network.autoClearOnInit}
                onChange={(e) =>
                  updateSettings({ network: { autoClearOnInit: e.target.checked } })
                }
              />
            </label>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Max request history</span>
                <span className="settings-row-hint">
                  Liste {settings.network.maxRequestHistory} request'i geçince eski kayıtlar
                  düşer
                </span>
              </div>
              <input
                type="number"
                min={50}
                max={10000}
                step={50}
                value={settings.network.maxRequestHistory}
                onChange={(e) =>
                  updateSettings({
                    network: {
                      maxRequestHistory: Math.max(50, Number(e.target.value) || 50),
                    },
                  })
                }
              />
            </label>
          </section>

          {/* ─── Console ───────────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">📋 Console</h3>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Auto-clear on app init</span>
                <span className="settings-row-hint">
                  Agent yeniden bağlandığında log'ları otomatik temizle
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.console.autoClearOnInit}
                onChange={(e) =>
                  updateSettings({ console: { autoClearOnInit: e.target.checked } })
                }
              />
            </label>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Default log level</span>
                <span className="settings-row-hint">
                  Açılışta seçili olacak level filtresi
                </span>
              </div>
              <select
                value={settings.console.defaultLogLevel}
                onChange={(e) =>
                  updateSettings({
                    console: { defaultLogLevel: e.target.value as FilterLogLevel },
                  })
                }
              >
                {LOG_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Max log history</span>
                <span className="settings-row-hint">
                  Liste {settings.console.maxLogHistory} log'u geçince eski kayıtlar düşer
                </span>
              </div>
              <input
                type="number"
                min={50}
                max={10000}
                step={50}
                value={settings.console.maxLogHistory}
                onChange={(e) =>
                  updateSettings({
                    console: {
                      maxLogHistory: Math.max(50, Number(e.target.value) || 50),
                    },
                  })
                }
              />
            </label>
          </section>

          {/* ─── Connection ─────────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">🔌 Bağlantı</h3>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Network port</span>
                <span className="settings-row-hint">
                  Değiştir + Apply'a bas → WS server yeni portta yeniden başlar
                  ve mDNS otomatik re-publish olur. Bağlı agent'lar düşer, mDNS
                  ile saniyeler içinde tekrar bulur.
                </span>
                {portStatus.kind === "applying" && (
                  <span className="settings-row-status applying">⏳ Yeni portta başlatılıyor…</span>
                )}
                {portStatus.kind === "success" && (
                  <span className="settings-row-status success">
                    ✓ Port {portStatus.port} olarak güncellendi
                  </span>
                )}
                {portStatus.kind === "error" && (
                  <span className="settings-row-status error">
                    ✗ {portStatus.message}
                  </span>
                )}
              </div>
              <div className="settings-row-port-controls">
                <input
                  type="number"
                  min={1024}
                  max={65535}
                  value={pendingPort}
                  disabled={portStatus.kind === "applying"}
                  onChange={(e) => {
                    const next = Math.max(
                      1024,
                      Math.min(65535, Number(e.target.value) || 5051)
                    );
                    setPendingPort(next);
                    if (portStatus.kind !== "idle") setPortStatus({ kind: "idle" });
                  }}
                />
                <button
                  type="button"
                  className="settings-row-apply"
                  onClick={applyPort}
                  disabled={
                    portStatus.kind === "applying" ||
                    pendingPort === settings.connection.port
                  }
                >
                  {portStatus.kind === "applying" ? "…" : "Apply"}
                </button>
              </div>
            </label>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Auto-detect IP (mDNS)</span>
                <span className="settings-row-hint">
                  Kapatınca desktop mDNS yayınını durdurur — agent manuel wsUrl kullanmak
                  zorunda kalır
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.connection.autoDetectIp}
                onChange={(e) =>
                  updateSettings({ connection: { autoDetectIp: e.target.checked } })
                }
              />
            </label>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Manuel host:port override</span>
                <span className="settings-row-hint">
                  Boş bırakırsan auto-detect kullanılır. Header chip'i de bu değeri gösterir
                  ve "M" rozeti ile manuel olduğunu işaretler.
                </span>
              </div>
              <input
                type="text"
                placeholder="192.168.1.42:5051"
                value={settings.connection.manualWsUrl}
                onChange={(e) =>
                  updateSettings({ connection: { manualWsUrl: e.target.value } })
                }
              />
            </label>
          </section>

          {/* ─── Agents ─────────────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">🛰 Agents</h3>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Network agent enabled</span>
                <span className="settings-row-hint">
                  Kapatınca gelen network event'leri yok sayılır
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.agents.networkEnabled}
                onChange={(e) =>
                  updateSettings({ agents: { networkEnabled: e.target.checked } })
                }
              />
            </label>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Console agent enabled</span>
                <span className="settings-row-hint">
                  Kapatınca gelen console log'ları yok sayılır
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.agents.consoleEnabled}
                onChange={(e) =>
                  updateSettings({ agents: { consoleEnabled: e.target.checked } })
                }
              />
            </label>
          </section>

          {/* ─── UI ─────────────────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">🎨 Görünüm</h3>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Theme</span>
                <ComingSoonTag />
                <span className="settings-row-hint">
                  Şu an sadece koyu tema mevcut
                </span>
              </div>
              <select
                value={settings.ui.theme}
                onChange={(e) =>
                  updateSettings({ ui: { theme: e.target.value as ThemeMode } })
                }
              >
                {THEME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </div>

        <footer className="settings-footer">
          <button
            className="settings-reset"
            onClick={resetSettings}
            type="button"
          >
            Reset to defaults
          </button>
          <button className="settings-done" onClick={onClose} type="button">
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
