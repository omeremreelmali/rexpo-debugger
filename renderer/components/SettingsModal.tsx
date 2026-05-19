import { useEffect, useRef } from "react";
import { useSettings, ThemeMode } from "../state/SettingsContext";
import { FilterLogLevel } from "../types";
import "./SettingsModal.css";

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
 * A small inline tag that flags a setting as not yet wired to runtime behaviour.
 * The setting is still persisted to localStorage — it will be wired by the
 * referenced issue.
 */
function PendingTag({ issue }: { issue: string }) {
  return (
    <span className="setting-pending" title={`Davranış ${issue} ile gelecek`}>
      {issue}
    </span>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const dialogRef = useRef<HTMLDivElement>(null);

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
                <PendingTag issue="RED-157" />
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
                <PendingTag issue="RED-157" />
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
                <PendingTag issue="RED-160 follow-up" />
              </div>
              <input
                type="number"
                min={1024}
                max={65535}
                value={settings.connection.port}
                onChange={(e) =>
                  updateSettings({
                    connection: {
                      port: Math.max(1024, Math.min(65535, Number(e.target.value) || 5051)),
                    },
                  })
                }
              />
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
                <PendingTag issue="RED-158" />
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
                <PendingTag issue="RED-158" />
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
                <PendingTag issue="RED-160 follow-up" />
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
