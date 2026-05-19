import { useEffect, useRef, useState } from "react";
import { ConnectionInfo, NetworkInterfaceInfo } from "../types";
import "./ConnectionChip.css";

const SELECTED_INTERFACE_KEY = "rexpo-debugger-selected-interface";

function buildWsUrl(address: string, port: number): string {
  return `ws://${address}:${port}`;
}

export function ConnectionChip() {
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
        <span className="connection-text">Bağlanılıyor...</span>
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

  const primaryUrl = selectedInterface
    ? buildWsUrl(selectedInterface.address, port)
    : `ws://localhost:${port}`;

  return (
    <div className="connection-chip-wrapper" ref={wrapperRef}>
      <button
        className={`connection-chip ${hasMultiple ? "connection-chip-clickable" : ""}`}
        onClick={() => hasMultiple && setIsOpen(!isOpen)}
        title={hasMultiple ? "Tıkla — başka network interface'i seç" : primaryUrl}
        type="button"
      >
        <span className={`connection-dot ${dotClass}`} />
        <span className="connection-text">{primaryUrl}</span>
        {connectedClients > 0 && (
          <span className="connection-count" title={`${connectedClients} cihaz bağlı`}>
            {connectedClients}
          </span>
        )}
        {hasMultiple && <span className="connection-caret">▾</span>}
        <button
          className="connection-copy"
          onClick={(e) => selectedInterface && handleCopy(e, selectedInterface.address)}
          title="URL'yi kopyala"
          type="button"
        >
          {selectedInterface && copiedAddress === selectedInterface.address ? "✓" : "📋"}
        </button>
      </button>

      {isOpen && hasMultiple && (
        <div className="connection-dropdown">
          <div className="connection-dropdown-header">Network interface seç</div>
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
