import { NetworkMessage } from "../types";

/**
 * Agent messages arrive from the network, so nothing about their shape can be
 * trusted. These coerce them to what the UI renders, and drop what can't be.
 */

const text = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : String(value);

const finite = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

function headerMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = typeof entry === "string" ? entry : JSON.stringify(entry) ?? "";
  }
  return result;
}

function formParts(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((part) => part && typeof part === "object")
    .map((part: any) => ({
      name: String(part.name ?? ""),
      kind: part.kind === "file" ? ("file" as const) : ("text" as const),
      value: text(part.value),
      fileName: text(part.fileName),
      mimeType: text(part.mimeType),
      size: finite(part.size),
      uri: text(part.uri),
    }));
}

const LOG_LEVELS = ["log", "info", "warn", "error", "debug"];

export function sanitizeNetworkMessage(raw: any): NetworkMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const now = new Date().toISOString();
  const id = text(raw.id);
  if (!id) return null;
  const sourceClientId = text(raw.sourceClientId);

  if (raw.type === "console") {
    return {
      type: "console",
      id,
      sourceClientId,
      level: LOG_LEVELS.includes(raw.level) ? raw.level : "log",
      args: Array.isArray(raw.args) ? raw.args : [raw.args],
      timestamp: text(raw.timestamp) ?? now,
      stack: text(raw.stack),
    } as NetworkMessage;
  }

  if (raw.type === "request") {
    return {
      type: "request",
      id,
      sourceClientId,
      url: text(raw.url) ?? "",
      method: text(raw.method)?.toUpperCase() ?? "UNKNOWN",
      requestHeaders: headerMap(raw.requestHeaders),
      requestBodySnippet: text(raw.requestBodySnippet),
      requestBodyKind: raw.requestBodyKind === "formdata" ? "formdata" : undefined,
      requestFormParts: formParts(raw.requestFormParts),
      startedAt: text(raw.startedAt) ?? now,
    } as NetworkMessage;
  }

  if (raw.type === "response") {
    return {
      type: "response",
      id,
      sourceClientId,
      url: text(raw.url) ?? "",
      status: finite(raw.status) ?? 0,
      statusText: text(raw.statusText),
      responseHeaders: headerMap(raw.responseHeaders),
      responseBodySnippet: text(raw.responseBodySnippet),
      durationMs: finite(raw.durationMs) ?? 0,
      finishedAt: text(raw.finishedAt) ?? now,
      isError: Boolean(raw.isError),
      errorMessage: text(raw.errorMessage),
    } as NetworkMessage;
  }

  return null;
}
