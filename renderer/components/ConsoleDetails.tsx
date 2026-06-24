import { useMemo, useState } from "react";
import { useNetwork } from "../state/NetworkContext";
import { JsonViewer, TextViewer } from "./JsonViewer";
import { copyToClipboard } from "../utils/curlGenerator";
import { consoleLogToText, formatConsoleArg } from "../utils/consoleFormat";
import "./ConsoleDetails.css";

/** Small inline button that copies plain text and flashes "Copied". */
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="console-copy-btn"
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyToClipboard(text);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }
      }}
      title={`${label} (clean text)`}
    >
      {copied ? "✓ Copied" : `⧉ ${label}`}
    </button>
  );
}

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
        <CopyButton text={consoleLogToText(selectedLog)} label="Copy message" />
      </div>

      <div className="console-details-body">
        {/* Arguments */}
        <div className="console-details-section">
          <div className="console-details-section-title">
            <span>Message</span>
            <CopyButton text={consoleLogToText(selectedLog)} />
          </div>
          <div className="console-details-section-content">
            {selectedLog.args.map((arg, index) => (
              <div key={index} className="console-arg">
                <div className="console-arg-index">[{index}]</div>
                <div className="console-arg-value">
                  {isJsonLike(arg) ? (
                    <JsonViewer data={JSON.stringify(arg)} />
                  ) : (
                    <TextViewer data={formatConsoleArg(arg)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stack trace (for errors/warnings) */}
        {selectedLog.stack && (
          <div className="console-details-section">
            <div className="console-details-section-title">
              <span>Stack Trace</span>
              <CopyButton text={selectedLog.stack} />
            </div>
            <div className="console-details-section-content">
              <pre className="console-stack">{selectedLog.stack}</pre>
            </div>
          </div>
        )}

        {/* Raw data */}
        <div className="console-details-section">
          <div className="console-details-section-title">
            <span>Raw Data</span>
            <CopyButton text={JSON.stringify(selectedLog, null, 2)} label="Copy JSON" />
          </div>
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
