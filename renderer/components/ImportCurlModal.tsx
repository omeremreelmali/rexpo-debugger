import { useEffect, useMemo, useState } from "react";
import { parseCurlCommand, ParsedCurlRequest } from "../utils/curlParser";
import "./SaveRequestModal.css";
import "./ImportCurlModal.css";

interface ImportCurlModalProps {
  onCancel: () => void;
  /** Called with the parsed request when the user confirms the import. */
  onParsed: (request: ParsedCurlRequest) => void;
}

/**
 * "Import from cURL" — paste a curl command, see a live parse preview, then
 * hand the parsed request off to the Save dialog for naming / collection.
 */
export function ImportCurlModal({ onCancel, onParsed }: ImportCurlModalProps) {
  const [text, setText] = useState("");

  const result = useMemo(() => parseCurlCommand(text), [text]);
  const touched = text.trim().length > 0;
  const ok = result.ok;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      // Cmd/Ctrl+Enter imports
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && result.ok) {
        onParsed(result.request);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, onParsed, result]);

  return (
    <div
      className="save-request-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="save-request-modal"
        style={{ width: "min(640px, 94vw)" }}
        role="dialog"
        aria-modal="true"
      >
        <header className="save-request-header">
          <div>
            <h2>Import from cURL</h2>
            <p className="save-request-source">
              Paste a <code>curl</code> command — headers, body and method are
              parsed automatically.
            </p>
          </div>
          <button
            className="save-request-close"
            onClick={onCancel}
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="save-request-body">
          <label className="save-request-field">
            <span className="save-request-label">cURL command</span>
            <textarea
              className="import-curl-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"curl 'https://api.example.com/users' \\\n  -H 'Authorization: Bearer …' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"name\":\"Ada\"}'"}
              spellCheck={false}
              rows={8}
              autoFocus
            />
          </label>

          {touched && !ok && (
            <p className="import-curl-error">⚠ {result.error}</p>
          )}

          {ok && (
            <div className="import-curl-preview">
              <div className="import-curl-preview-line">
                <span
                  className={`collections-item-method method-${result.request.method.toLowerCase()}`}
                >
                  {result.request.method}
                </span>
                <span className="import-curl-preview-url">
                  {result.request.url}
                </span>
              </div>
              <div className="import-curl-preview-meta">
                {Object.keys(result.request.headers).length} header
                {Object.keys(result.request.headers).length === 1 ? "" : "s"}
                {result.request.body ? " · has body" : " · no body"}
              </div>
            </div>
          )}
        </div>

        <footer className="save-request-footer">
          <span className="save-request-hint">⌘/Ctrl + Enter to import</span>
          <div className="save-request-footer-actions">
            <button
              className="save-request-cancel"
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
            <button
              className="save-request-confirm"
              onClick={() => result.ok && onParsed(result.request)}
              type="button"
              disabled={!ok}
            >
              Import →
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
