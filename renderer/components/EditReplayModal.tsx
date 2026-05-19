import { useEffect, useMemo, useState } from "react";
import { RequestState } from "../types";
import { sendReplayCommand } from "../utils/replayRequest";
import "./EditReplayModal.css";

interface EditReplayModalProps {
  request: RequestState;
  onClose: () => void;
}

interface HeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
const SENSITIVE_HEADER_NAMES = [
  "authorization",
  "cookie",
  "x-api-key",
  "x-auth-token",
];

let rowCounter = 0;
const nextRowId = () => `h-${++rowCounter}`;

function headersToRows(headers?: Record<string, string>): HeaderRow[] {
  if (!headers) return [];
  return Object.entries(headers).map(([key, value]) => ({
    id: nextRowId(),
    key,
    value,
    enabled: true,
  }));
}

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (!row.enabled) continue;
    const key = row.key.trim();
    if (!key) continue;
    result[key] = row.value;
  }
  return result;
}

function isSensitive(headerName: string): boolean {
  return SENSITIVE_HEADER_NAMES.includes(headerName.toLowerCase());
}

function tryPrettyJson(input: string): string {
  if (!input) return "";
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

export function EditReplayModal({ request, onClose }: EditReplayModalProps) {
  const [method, setMethod] = useState(request.method.toUpperCase());
  const [url, setUrl] = useState(request.url);
  const [headers, setHeaders] = useState<HeaderRow[]>(() =>
    headersToRows(request.requestHeaders)
  );
  const [body, setBody] = useState<string>(() => tryPrettyJson(request.requestBodySnippet || ""));
  const [revealedHeaderIds, setRevealedHeaderIds] = useState<Set<string>>(new Set());

  // Detect JSON body validity for live feedback
  const bodyValidation = useMemo(() => {
    if (!body.trim()) return { isJson: false, error: null as string | null };
    try {
      JSON.parse(body);
      return { isJson: true, error: null };
    } catch (err) {
      return { isJson: false, error: (err as Error).message };
    }
  }, [body]);

  const hasBody = useMemo(
    () => ["POST", "PUT", "PATCH", "DELETE"].includes(method),
    [method]
  );

  // Close on Esc
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const addHeader = () => {
    setHeaders((prev) => [...prev, { id: nextRowId(), key: "", value: "", enabled: true }]);
  };

  const updateHeader = (id: string, patch: Partial<HeaderRow>) => {
    setHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...patch } : h))
    );
  };

  const removeHeader = (id: string) => {
    setHeaders((prev) => prev.filter((h) => h.id !== id));
  };

  const toggleReveal = (id: string) => {
    setRevealedHeaderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const prettifyBody = () => setBody(tryPrettyJson(body));

  const handleSend = () => {
    sendReplayCommand({
      url: url.trim(),
      method,
      headers: rowsToHeaders(headers),
      body: hasBody ? body : undefined,
    });
    onClose();
  };

  const canSend = url.trim().length > 0 && (!hasBody || !body.trim() || bodyValidation.isJson || !looksLikeJson(body));

  return (
    <div
      className="edit-replay-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="edit-replay-modal" role="dialog" aria-modal="true">
        <header className="edit-replay-header">
          <div>
            <h2>Edit &amp; Replay</h2>
            <p className="edit-replay-source">
              from{" "}
              <span className="edit-replay-source-method">{request.method.toUpperCase()}</span>{" "}
              <span className="edit-replay-source-url">{request.url}</span>
            </p>
          </div>
          <button className="edit-replay-close" onClick={onClose} aria-label="Close" type="button">
            ✕
          </button>
        </header>

        <div className="edit-replay-body">
          {/* Method + URL */}
          <div className="edit-replay-row edit-replay-method-row">
            <select
              className="edit-replay-method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              className="edit-replay-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/endpoint?query=value"
              spellCheck={false}
            />
          </div>

          {/* Headers */}
          <section className="edit-replay-section">
            <header className="edit-replay-section-header">
              <h3>Headers</h3>
              <button
                type="button"
                className="edit-replay-section-add"
                onClick={addHeader}
              >
                + Add header
              </button>
            </header>

            {headers.length === 0 ? (
              <p className="edit-replay-empty">No headers — click "Add header" to add one.</p>
            ) : (
              <div className="edit-replay-headers">
                {headers.map((h) => {
                  const sensitive = isSensitive(h.key);
                  const revealed = revealedHeaderIds.has(h.id);
                  return (
                    <div key={h.id} className={`edit-replay-header-row ${!h.enabled ? "disabled" : ""}`}>
                      <input
                        type="checkbox"
                        checked={h.enabled}
                        onChange={(e) => updateHeader(h.id, { enabled: e.target.checked })}
                        title={h.enabled ? "Disable" : "Enable"}
                      />
                      <input
                        className="edit-replay-header-key"
                        type="text"
                        value={h.key}
                        onChange={(e) => updateHeader(h.id, { key: e.target.value })}
                        placeholder="Header name"
                        spellCheck={false}
                      />
                      <input
                        className="edit-replay-header-value"
                        type={sensitive && !revealed ? "password" : "text"}
                        value={h.value}
                        onChange={(e) => updateHeader(h.id, { value: e.target.value })}
                        placeholder="value"
                        spellCheck={false}
                      />
                      {sensitive && (
                        <button
                          type="button"
                          className="edit-replay-header-reveal"
                          onClick={() => toggleReveal(h.id)}
                          title={revealed ? "Hide" : "Show"}
                        >
                          {revealed ? "🙈" : "👁"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="edit-replay-header-remove"
                        onClick={() => removeHeader(h.id)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Body */}
          {hasBody && (
            <section className="edit-replay-section">
              <header className="edit-replay-section-header">
                <h3>Body</h3>
                <div className="edit-replay-body-actions">
                  {body.trim() && looksLikeJson(body) && (
                    <button
                      type="button"
                      className="edit-replay-section-add"
                      onClick={prettifyBody}
                    >
                      Pretty-print JSON
                    </button>
                  )}
                </div>
              </header>
              <textarea
                className="edit-replay-body-input"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{"key":"value"}'
                spellCheck={false}
                rows={10}
              />
              {body.trim() && looksLikeJson(body) && !bodyValidation.isJson && (
                <p className="edit-replay-body-error">
                  ⚠ Geçersiz JSON: {bodyValidation.error}
                </p>
              )}
            </section>
          )}
        </div>

        <footer className="edit-replay-footer">
          <button className="edit-replay-cancel" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="edit-replay-send"
            onClick={handleSend}
            type="button"
            disabled={!canSend}
            title={
              !canSend
                ? hasBody && looksLikeJson(body) && !bodyValidation.isJson
                  ? "JSON body geçersiz"
                  : "URL boş"
                : "Gönder"
            }
          >
            ▶ Send
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Heuristic — body looks like it's meant to be JSON (starts with { or [). */
function looksLikeJson(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}
