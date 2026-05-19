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

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Network port — kept as a raw string so the user can type freely (e.g. clear
  // the field, type "8080" digit by digit) without the value being clamped on
  // every keystroke. Validation + clamping happens only when Apply is pressed.
  const [pendingPortInput, setPendingPortInput] = useState<string>(
    String(settings.connection.port)
  );
  const [portStatus, setPortStatus] = useState<PortApplyStatus>({ kind: "idle" });

  // Reset the input when the modal opens or when the persisted port changes
  // from outside (e.g. Reset to defaults).
  useEffect(() => {
    setPendingPortInput(String(settings.connection.port));
    setPortStatus({ kind: "idle" });
  }, [settings.connection.port, isOpen]);

  // Derived state — single source of truth for "what would Apply send?"
  const parsedPort = parseInt(pendingPortInput, 10);
  const isPortValid =
    Number.isInteger(parsedPort) && parsedPort >= 1024 && parsedPort <= 65535;
  const portHasChanged = isPortValid && parsedPort !== settings.connection.port;
  const portRangeError =
    pendingPortInput.trim() !== "" && !isPortValid
      ? "Port must be between 1024 and 65535"
      : null;

  // Free-typing buffers for the history inputs. Like the port field, these
  // store the raw text so partial values like "5" or "" don't snap to the
  // minimum mid-type. Clamping + commit happens on blur.
  const [reqHistoryInput, setReqHistoryInput] = useState<string>(
    String(settings.network.maxRequestHistory)
  );
  const [logHistoryInput, setLogHistoryInput] = useState<string>(
    String(settings.console.maxLogHistory)
  );

  useEffect(() => {
    setReqHistoryInput(String(settings.network.maxRequestHistory));
  }, [settings.network.maxRequestHistory]);

  useEffect(() => {
    setLogHistoryInput(String(settings.console.maxLogHistory));
  }, [settings.console.maxLogHistory]);

  const commitHistoryValue = (
    raw: string,
    current: number,
    apply: (n: number) => void
  ): string => {
    const parsed = parseInt(raw, 10);
    if (!Number.isInteger(parsed)) return String(current);
    const clamped = Math.max(50, Math.min(10000, parsed));
    apply(clamped);
    return String(clamped);
  };

  const applyPort = async () => {
    if (!portHasChanged) return;
    if (!window.electron?.setNetworkPort) {
      setPortStatus({ kind: "error", message: "IPC bridge not available" });
      return;
    }
    setPortStatus({ kind: "applying" });
    try {
      const result = await window.electron.setNetworkPort(parsedPort);
      if (result.ok) {
        updateSettings({ connection: { port: result.port } });
        setPortStatus({ kind: "success", port: result.port });
        setPendingPortInput(String(result.port));
        // Reset the success indicator after a moment so it doesn't linger.
        setTimeout(() => {
          setPortStatus((s) => (s.kind === "success" ? { kind: "idle" } : s));
        }, 2500);
      } else {
        // Server stayed on the old port; revert the input so the UI matches reality.
        setPendingPortInput(String(result.port));
        setPortStatus({ kind: "error", message: result.error || "Failed to change port" });
      }
    } catch (err) {
      setPortStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error",
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
                  Automatically clear the list when the agent reconnects
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
                  Older entries drop once the list exceeds{" "}
                  {settings.network.maxRequestHistory} requests (50–10000)
                </span>
              </div>
              <input
                type="number"
                inputMode="numeric"
                min={50}
                max={10000}
                step={50}
                value={reqHistoryInput}
                onChange={(e) => setReqHistoryInput(e.target.value)}
                onBlur={() =>
                  setReqHistoryInput(
                    commitHistoryValue(
                      reqHistoryInput,
                      settings.network.maxRequestHistory,
                      (n) => updateSettings({ network: { maxRequestHistory: n } })
                    )
                  )
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
                  Automatically clear logs when the agent reconnects
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
                  Level filter selected by default on startup
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
                  Older entries drop once the list exceeds{" "}
                  {settings.console.maxLogHistory} logs (50–10000)
                </span>
              </div>
              <input
                type="number"
                inputMode="numeric"
                min={50}
                max={10000}
                step={50}
                value={logHistoryInput}
                onChange={(e) => setLogHistoryInput(e.target.value)}
                onBlur={() =>
                  setLogHistoryInput(
                    commitHistoryValue(
                      logHistoryInput,
                      settings.console.maxLogHistory,
                      (n) => updateSettings({ console: { maxLogHistory: n } })
                    )
                  )
                }
              />
            </label>
          </section>

          {/* ─── Connection ─────────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">🔌 Connection</h3>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Network port</span>
                <span className="settings-row-hint">
                  Change + click Apply → WS server restarts on the new port and
                  mDNS auto-republishes. Connected agents disconnect briefly
                  and re-discover via mDNS within seconds.
                </span>
                {portStatus.kind === "applying" && (
                  <span className="settings-row-status applying">⏳ Restarting on new port…</span>
                )}
                {portStatus.kind === "success" && (
                  <span className="settings-row-status success">
                    ✓ Port updated to {portStatus.port}
                  </span>
                )}
                {portStatus.kind === "error" && (
                  <span className="settings-row-status error">
                    ✗ {portStatus.message}
                  </span>
                )}
                {portRangeError && portStatus.kind === "idle" && (
                  <span className="settings-row-status error">
                    ✗ {portRangeError}
                  </span>
                )}
              </div>
              <div className="settings-row-port-controls">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1024}
                  max={65535}
                  value={pendingPortInput}
                  disabled={portStatus.kind === "applying"}
                  onChange={(e) => {
                    // Store raw text — no clamping mid-type. Validation runs
                    // through `parsedPort` / `isPortValid` for the Apply button.
                    setPendingPortInput(e.target.value);
                    if (portStatus.kind !== "idle") setPortStatus({ kind: "idle" });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && portHasChanged) {
                      e.preventDefault();
                      applyPort();
                    }
                  }}
                  placeholder="5051"
                />
                <button
                  type="button"
                  className="settings-row-apply"
                  onClick={applyPort}
                  disabled={portStatus.kind === "applying" || !portHasChanged}
                  title={
                    !isPortValid
                      ? "Port must be between 1024 and 65535"
                      : !portHasChanged
                      ? "Already on this port"
                      : "Restart on the new port"
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
                  When off, the desktop stops publishing the mDNS service —
                  agents must use a manual wsUrl instead
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
                  Leave empty to use auto-detect. The header chip displays this
                  value and shows an "M" badge to indicate the manual override.
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
                  When off, incoming network events are ignored
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
                  When off, incoming console logs are ignored
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
            <h3 className="settings-section-title">🎨 Appearance</h3>

            <label className="settings-row">
              <div className="settings-row-label">
                <span>Theme</span>
                <span className="settings-row-hint">
                  When set to System, follows the operating system appearance
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
