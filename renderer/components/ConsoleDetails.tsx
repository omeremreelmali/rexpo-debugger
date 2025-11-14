import React, { useMemo } from "react";
import { useNetwork } from "../state/NetworkContext";
import { JsonViewer, TextViewer } from "./JsonViewer";
import "./ConsoleDetails.css";

export function ConsoleDetails() {
  const { state } = useNetwork();

  const selectedLog = useMemo(() => {
    if (!state.selectedConsoleId) return null;
    return state.consoleLogs.find((log) => log.id === state.selectedConsoleId);
  }, [state.consoleLogs, state.selectedConsoleId]);

  if (!selectedLog) {
    return (
      <div className="console-details">
        <div className="console-details-empty">
          <span>Select a console log to view details</span>
        </div>
      </div>
    );
  }

  return (
    <div className="console-details">
      <div className="console-details-header">
        <div className="console-details-title">
          <span className={`level-badge ${selectedLog.level}`}>
            {selectedLog.level.toUpperCase()}
          </span>
          <span className="console-details-timestamp">
            {formatTimestamp(selectedLog.timestamp)}
          </span>
        </div>
      </div>

      <div className="console-details-body">
        {/* Arguments */}
        <div className="console-details-section">
          <div className="console-details-section-title">Message</div>
          <div className="console-details-section-content">
            {selectedLog.args.map((arg, index) => (
              <div key={index} className="console-arg">
                <div className="console-arg-index">[{index}]</div>
                <div className="console-arg-value">
                  {isJsonLike(arg) ? (
                    <JsonViewer data={JSON.stringify(arg)} />
                  ) : (
                    <TextViewer data={formatArgument(arg)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stack trace (for errors/warnings) */}
        {selectedLog.stack && (
          <div className="console-details-section">
            <div className="console-details-section-title">Stack Trace</div>
            <div className="console-details-section-content">
              <pre className="console-stack">{selectedLog.stack}</pre>
            </div>
          </div>
        )}

        {/* Raw data */}
        <div className="console-details-section">
          <div className="console-details-section-title">Raw Data</div>
          <div className="console-details-section-content">
            <JsonViewer data={JSON.stringify(selectedLog)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function isJsonLike(arg: any): boolean {
  if (!arg || typeof arg !== "object") return false;
  if (arg.__type) return false; // Special types
  return true;
}

function formatArgument(arg: any): string {
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean") {
    return String(arg);
  }

  // Handle special serialized types
  if (arg && typeof arg === "object") {
    if (arg.__type === "Error") {
      return `${arg.name}: ${arg.message}\n${arg.stack || ""}`;
    }
    if (arg.__type === "Date") {
      return arg.value;
    }
    if (arg.__type === "RegExp") {
      return arg.value;
    }
    if (arg.__type === "Function") {
      return arg.value;
    }

    // Regular object or array
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return "[Circular or Unserializable Object]";
    }
  }

  return String(arg);
}
