import { FormDataPart } from "../types";
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
}

/**
 * Renders a captured `multipart/form-data` body: one row per field, with file
 * parts showing their name, mime type, size and device-local uri.
 *
 * File contents are never transferred — only the metadata the app passed to
 * `FormData.append()`.
 */
export function FormDataViewer({ parts }: FormDataViewerProps) {
  const fileCount = parts.filter((part) => part.kind === "file").length;
  const textCount = parts.length - fileCount;

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
        {parts.map((part, index) => (
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
              </div>
            ) : (
              <pre className="formdata-value">{part.value ?? ""}</pre>
            )}
          </div>
        ))}
      </div>

      {fileCount > 0 && (
        <p className="formdata-note">
          File contents stay on the device — only metadata is captured.
        </p>
      )}
    </div>
  );
}
