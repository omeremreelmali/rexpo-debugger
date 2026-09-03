import { useEffect, useRef, useState } from "react";
import { FileTransferMessage, FormDataPart } from "../types";
import "./FormDataViewer.css";

/** Human-readable byte count. Sizes are only known when the platform reports them. */
function formatBytes(bytes?: number): string | null {
  if (bytes === undefined || !isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface FormDataViewerProps {
  parts: FormDataPart[];
  /** Route file actions back to the agent that originally captured the request. */
  sourceClientId?: string;
}

type FileAction = "preview" | "save" | "open";
type FileUiState = { loading?: FileAction; previewUrl?: string; mimeType?: string; message?: string; error?: string };
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Renders a captured `multipart/form-data` body: one row per field, with file
 * parts showing their name, mime type, size and device-local uri.
 *
 * File bytes transfer only after an explicit Preview, Save or Open action,
 * with a hard 5 MB limit enforced on both agent and desktop.
 */
export function FormDataViewer({ parts, sourceClientId }: FormDataViewerProps) {
  const [fileStates, setFileStates] = useState<Record<number, FileUiState>>({});
  const pending = useRef(new Map<string, { index: number; action: FileAction }>());
  const fileCount = parts.filter((part) => part.kind === "file").length;
  const textCount = parts.length - fileCount;

  useEffect(() => {
    const unsubscribe = window.electron.onFileTransfer((message: FileTransferMessage) => {
      const request = pending.current.get(message.transferId);
      if (!request) return;
      pending.current.delete(message.transferId);
      const { index, action } = request;

      if (message.status === "error") {
        setFileStates((current) => ({ ...current, [index]: { error: message.error || "File operation failed" } }));
        return;
      }
      // Kept for compatibility with older agents. Current desktop file actions
      // always request the bytes and open them locally.
      if (message.status === "opened") return;
      if (!message.base64) return;

      if (action === "save" || action === "open") {
        void window.electron.saveBinaryFile({
          defaultName: message.fileName || parts[index]?.fileName || "upload.bin",
          base64: message.base64,
          mimeType: message.mimeType,
          openAfterSave: action === "open",
        }).then((result) => {
          setFileStates((current) => ({
            ...current,
            [index]: result.ok
              ? { message: action === "open" ? `Opened ${result.filePath}` : `Saved to ${result.filePath}` }
              : result.cancelled ? {} : { error: result.error || "Save failed" },
          }));
        });
      } else {
        const mimeType = message.mimeType || "application/octet-stream";
        setFileStates((current) => ({
          ...current,
          [index]: { previewUrl: `data:${mimeType};base64,${message.base64}`, mimeType },
        }));
      }
    });
    return unsubscribe;
  }, [parts]);

  const runFileAction = (part: FormDataPart, index: number, action: FileAction) => {
    if (!part.uri) return;
    const transferId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    pending.current.set(transferId, { index, action });
    setFileStates((current) => ({ ...current, [index]: { loading: action } }));
    window.electron.sendCommand({
      type: "command",
      command: "request_file",
      targetClientId: sourceClientId,
      payload: {
        transferId,
        uri: part.uri!,
        fileName: part.fileName,
        mimeType: part.mimeType,
        maxBytes: MAX_FILE_BYTES,
      },
    });
  };

  return (
    <div className="formdata-viewer">
      <div className="formdata-summary">
        <span className="formdata-summary-type">multipart/form-data</span>
        <span className="formdata-summary-counts">
          {parts.length} part{parts.length === 1 ? "" : "s"}
          {fileCount > 0 && ` · ${fileCount} file${fileCount === 1 ? "" : "s"}`}
          {textCount > 0 && ` · ${textCount} field${textCount === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="formdata-list">
        {parts.map((part, index) => {
          const fileState = fileStates[index] || {};
          return (
          <div
            key={`${part.name}-${index}`}
            className={`formdata-row formdata-row-${part.kind}`}
          >
            <div className="formdata-row-head">
              <span className={`formdata-badge formdata-badge-${part.kind}`}>
                {part.kind === "file" ? "FILE" : "TEXT"}
              </span>
              <span className="formdata-name">{part.name}</span>
            </div>

            {part.kind === "file" ? (
              <div className="formdata-file">
                <div className="formdata-filename">
                  {part.fileName || "(unnamed file)"}
                </div>
                <div className="formdata-meta">
                  {part.mimeType && (
                    <span className="formdata-chip">{part.mimeType}</span>
                  )}
                  {formatBytes(part.size) && (
                    <span className="formdata-chip">{formatBytes(part.size)}</span>
                  )}
                </div>
                {part.uri && (
                  <div className="formdata-uri" title={part.uri}>
                    {part.uri}
                  </div>
                )}
                {part.uri && (
                  <div className="formdata-actions">
                    <button type="button" onClick={() => runFileAction(part, index, "preview")} disabled={!!fileState.loading}>
                      {fileState.loading === "preview" ? "Loading…" : "Preview"}
                    </button>
                    <button type="button" onClick={() => runFileAction(part, index, "save")} disabled={!!fileState.loading}>
                      {fileState.loading === "save" ? "Transferring…" : "Save to Desktop"}
                    </button>
                    <button type="button" onClick={() => runFileAction(part, index, "open")} disabled={!!fileState.loading}>
                      {fileState.loading === "open" ? "Transferring…" : "Open on Device"}
                    </button>
                  </div>
                )}
                {fileState.error && <div className="formdata-file-error">{fileState.error}</div>}
                {fileState.message && <div className="formdata-file-message">{fileState.message}</div>}
                {fileState.previewUrl && fileState.mimeType?.startsWith("image/") && (
                  <img className="formdata-preview-image" src={fileState.previewUrl} alt={part.fileName || part.name} />
                )}
                {fileState.previewUrl && fileState.mimeType === "application/pdf" && (
                  <iframe className="formdata-preview-pdf" src={fileState.previewUrl} title={part.fileName || part.name} />
                )}
              </div>
            ) : (
              <pre className="formdata-value">{part.value ?? ""}</pre>
            )}
          </div>
          );
        })}
      </div>

      {fileCount > 0 && (
        <p className="formdata-note">
          Files transfer only when you choose Preview, Save to Desktop or Open on Device (5 MB limit).
        </p>
      )}
    </div>
  );
}
