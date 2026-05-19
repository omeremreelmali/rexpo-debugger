import { useEffect, useMemo, useState } from "react";
import { RequestState } from "../types";
import { sendReplayCommand } from "../utils/replayRequest";
import "./EditReplayModal.css";

interface EditReplayModalProps {
  request: RequestState;
  onClose: () => void;
}

interface KeyValueRow {
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
const nextRowId = (prefix = "h") => `${prefix}-${++rowCounter}`;

function headersToRows(headers?: Record<string, string>): KeyValueRow[] {
  if (!headers) return [];
  return Object.entries(headers).map(([key, value]) => ({
    id: nextRowId("h"),
    key,
    value,
    enabled: true,
  }));
}

function rowsToHeaders(rows: KeyValueRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (!row.enabled) continue;
    const key = row.key.trim();
    if (!key) continue;
    result[key] = row.value;
  }
  return result;
}

/**
 * Splits a URL into a base part (scheme + host + path) and an array of query
 * parameters. The fragment (#…) is preserved as part of the base.
 *
 * Falls back to "everything before the first ?" when URL parsing fails (e.g.
 * relative URLs captured from in-app routing).
 */
function parseUrl(input: string): {
  base: string;
  params: KeyValueRow[];
} {
  if (!input) return { base: "", params: [] };
  try {
    const u = new URL(input);
    const params: KeyValueRow[] = [];
    u.searchParams.forEach((value, key) => {
      params.push({ id: nextRowId("q"), key, value, enabled: true });
    });
    const base = `${u.origin}${u.pathname}${u.hash}`;
    return { base, params };
  } catch {
    // relative URL or unparseable — split naively on first ?
    const qIdx = input.indexOf("?");
    if (qIdx < 0) return { base: input, params: [] };
    const base = input.slice(0, qIdx);
    const search = new URLSearchParams(input.slice(qIdx + 1));
    const params: KeyValueRow[] = [];
    search.forEach((value, key) => {
      params.push({ id: nextRowId("q"), key, value, enabled: true });
    });
    return { base, params };
  }
}

function buildUrl(base: string, params: KeyValueRow[]): string {
  const active = params.filter((p) => p.enabled && p.key.trim().length > 0);
  if (active.length === 0) return base;
  const search = new URLSearchParams();
  for (const p of active) {
    search.append(p.key.trim(), p.value);
  }
  // Preserve fragment if base already has one (URLSearchParams string doesn't include ?)
  const hashIdx = base.indexOf("#");
  if (hashIdx >= 0) {
    return `${base.slice(0, hashIdx)}?${search.toString()}${base.slice(hashIdx)}`;
  }
  return `${base}?${search.toString()}`;
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
  const initialParsed = useMemo(() => parseUrl(request.url), [request.url]);
  const [method, setMethod] = useState(request.method.toUpperCase());
  const [baseUrl, setBaseUrl] = useState(initialParsed.base);
  const [queryParams, setQueryParams] = useState<KeyValueRow[]>(initialParsed.params);
  const [headers, setHeaders] = useState<KeyValueRow[]>(() =>
    headersToRows(request.requestHeaders)
  );
  const [body, setBody] = useState<string>(() => tryPrettyJson(request.requestBodySnippet || ""));
  const [revealedHeaderIds, setRevealedHeaderIds] = useState<Set<string>>(new Set());

  // Live preview of the resolved URL — what we'll actually send.
  const resolvedUrl = useMemo(
    () => buildUrl(baseUrl.trim(), queryParams),
    [baseUrl, queryParams]
  );

  // If the user pastes a full URL (with ?key=value) into the base field, peel
  // the query string off into the table on blur.
  const onBaseUrlBlur = () => {
    if (baseUrl.includes("?")) {
      const reparsed = parseUrl(baseUrl);
      setBaseUrl(reparsed.base);
      setQueryParams((prev) => [...prev, ...reparsed.params]);
    }
  };

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
    setHeaders((prev) => [
      ...prev,
      { id: nextRowId("h"), key: "", value: "", enabled: true },
    ]);
  };

  const updateHeader = (id: string, patch: Partial<KeyValueRow>) => {
    setHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...patch } : h))
    );
  };

  const removeHeader = (id: string) => {
    setHeaders((prev) => prev.filter((h) => h.id !== id));
  };

  const addQueryParam = () => {
    setQueryParams((prev) => [
      ...prev,
      { id: nextRowId("q"), key: "", value: "", enabled: true },
    ]);
  };

  const updateQueryParam = (id: string, patch: Partial<KeyValueRow>) => {
    setQueryParams((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const removeQueryParam = (id: string) => {
    setQueryParams((prev) => prev.filter((p) => p.id !== id));
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
      url: resolvedUrl,
      method,
      headers: rowsToHeaders(headers),
      body: hasBody ? body : undefined,
    });
    onClose();
  };

  const canSend =
    baseUrl.trim().length > 0 &&
    (!hasBody || !body.trim() || bodyValidation.isJson || !looksLikeJson(body));

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
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              onBlur={onBaseUrlBlur}
              placeholder="https://api.example.com/endpoint"
              spellCheck={false}
            />
          </div>

          {/* Resolved URL preview */}
          {queryParams.some((p) => p.enabled && p.key.trim()) && (
            <p className="edit-replay-resolved-url">
              <span className="edit-replay-resolved-label">Final URL:</span>{" "}
              <span className="edit-replay-resolved-value">{resolvedUrl}</span>
            </p>
          )}

          {/* Query params */}
          <section className="edit-replay-section">
            <header className="edit-replay-section-header">
              <h3>Query params</h3>
              <button
                type="button"
                className="edit-replay-section-add"
                onClick={addQueryParam}
              >
                + Add param
              </button>
            </header>

            {queryParams.length === 0 ? (
              <p className="edit-replay-empty">
                No query params — click "Add param" to add one.
              </p>
            ) : (
              <div className="edit-replay-headers">
                {queryParams.map((p) => (
                  <div
                    key={p.id}
                    className={`edit-replay-header-row ${!p.enabled ? "disabled" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(e) => updateQueryParam(p.id, { enabled: e.target.checked })}
                      title={p.enabled ? "Disable" : "Enable"}
                    />
                    <input
                      className="edit-replay-header-key"
                      type="text"
                      value={p.key}
                      onChange={(e) => updateQueryParam(p.id, { key: e.target.value })}
                      placeholder="param"
                      spellCheck={false}
                    />
                    <input
                      className="edit-replay-header-value"
                      type="text"
                      value={p.value}
                      onChange={(e) => updateQueryParam(p.id, { value: e.target.value })}
                      placeholder="value"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="edit-replay-header-remove"
                      onClick={() => removeQueryParam(p.id)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

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
                  ⚠ Invalid JSON: {bodyValidation.error}
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
                  ? "JSON body is invalid"
                  : "URL is empty"
                : "Send"
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
