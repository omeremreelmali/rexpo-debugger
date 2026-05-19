import { useEffect, useRef, useState } from "react";
import { ConnectionInfo, NetworkInterfaceInfo } from "../types";
import { useSettings } from "../state/SettingsContext";
import "./ConnectionChip.css";

const SELECTED_INTERFACE_KEY = "rexpo-debugger-selected-interface";

function buildWsUrl(address: string, port: number): string {
  return `ws://${address}:${port}`;
}

/**
 * Normalizes a user-typed override like "192.168.1.42:5051", "ws://host:5051",
 * or "host:5051" into a full ws:// URL. Returns null if the input cannot be
 * reasonably parsed.
 */
function normalizeManualWsUrl(raw: string, fallbackPort: number): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let value = trimmed;
  if (!/^wss?:\/\//i.test(value)) value = `ws://${value}`;
  try {
    const u = new URL(value);
    const host = u.hostname;
    if (!host) return null;
    const port = u.port || String(fallbackPort);
    return `ws://${host}:${port}`;
  } catch {
    return null;
  }
}

export function ConnectionChip() {
  const { settings } = useSettings();
  const [info, setInfo] = useState<ConnectionInfo | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(() =>
    localStorage.getItem(SELECTED_INTERFACE_KEY)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.electron) return;

    window.electron.getConnectionInfo().then(setInfo);
    window.electron.onConnectionStateChanged(setInfo);

    return () => {
      window.electron.removeConnectionStateListener();
    };
  }, []);

  // Settings-driven manual override takes priority over auto-detected IPs.
  const manualUrl = normalizeManualWsUrl(
    settings.connection.manualWsUrl,
    info?.port ?? settings.connection.port
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  if (!info) {
    return (
      <div className="connection-chip connection-chip-loading">
        <span className="connection-dot connection-dot-idle" />
        <span className="connection-text">Connecting…</span>
      </div>
    );
  }

  const { interfaces, port, connectedClients } = info;
  const hasInterfaces = interfaces.length > 0;
  const hasMultiple = interfaces.length > 1;

  // Determine which interface to show as primary
  const selectedInterface: NetworkInterfaceInfo | null = (() => {
    if (!hasInterfaces) return null;
    if (selectedAddress) {
      const found = interfaces.find((i) => i.address === selectedAddress);
      if (found) return found;
    }
    return interfaces[0];
  })();

  const dotClass = !hasInterfaces
    ? "connection-dot-error"
    : connectedClients > 0
    ? "connection-dot-active"
    : "connection-dot-listening";

  const handleSelect = (iface: NetworkInterfaceInfo) => {
    setSelectedAddress(iface.address);
    localStorage.setItem(SELECTED_INTERFACE_KEY, iface.address);
    setIsOpen(false);
  };

  const handleCopy = async (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(buildWsUrl(address, port));
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const primaryUrl = manualUrl
    ? manualUrl
    : selectedInterface
    ? buildWsUrl(selectedInterface.address, port)
    : `ws://localhost:${port}`;

  return (
    <div className="connection-chip-wrapper" ref={wrapperRef}>
      <button
        className={`connection-chip ${hasMultiple && !manualUrl ? "connection-chip-clickable" : ""}`}
        onClick={() => hasMultiple && !manualUrl && setIsOpen(!isOpen)}
        title={
          manualUrl
            ? `Manual override (Settings → Connection → Manual host:port): ${primaryUrl}`
            : hasMultiple
            ? "Click to pick a different network interface"
            : primaryUrl
        }
        type="button"
      >
        <span className={`connection-dot ${dotClass}`} />
        {manualUrl && <span className="connection-manual-badge">M</span>}
        <span className="connection-text">{primaryUrl}</span>
        {connectedClients > 0 && (
          <span className="connection-count" title={`${connectedClients} client${connectedClients === 1 ? "" : "s"} connected`}>
            {connectedClients}
          </span>
        )}
        {hasMultiple && !manualUrl && <span className="connection-caret">▾</span>}
        <button
          className="connection-copy"
          onClick={(e) => selectedInterface && handleCopy(e, selectedInterface.address)}
          title="URL'yi kopyala"
          type="button"
        >
          {selectedInterface && copiedAddress === selectedInterface.address ? "✓" : "📋"}
        </button>
      </button>

      {isOpen && hasMultiple && !manualUrl && (
        <div className="connection-dropdown">
          <div className="connection-dropdown-header">Pick network interface</div>
          {interfaces.map((iface) => {
            const isSelected = selectedInterface?.address === iface.address;
            return (
              <div
                key={iface.address}
                className={`connection-dropdown-item ${
                  isSelected ? "connection-dropdown-item-selected" : ""
                }`}
                onClick={() => handleSelect(iface)}
              >
                <div className="connection-dropdown-main">
                  <span className="connection-dropdown-name">{iface.name}</span>
                  <span className="connection-dropdown-address">
                    {buildWsUrl(iface.address, port)}
                  </span>
                </div>
                <button
                  className="connection-copy"
                  onClick={(e) => handleCopy(e, iface.address)}
                  title="URL'yi kopyala"
                  type="button"
                >
                  {copiedAddress === iface.address ? "✓" : "📋"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
