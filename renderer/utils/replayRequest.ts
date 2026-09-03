import { FormDataPart, RequestState } from "../types";

export interface ReplayPayload {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  /**
   * Multipart parts. When set, the agent rebuilds a FormData on the device
   * (re-reading each file from its local uri) instead of sending `body`.
   */
  formParts?: FormDataPart[];
}

/**
 * Sends a replay command to the agent. Falls back to no-op if the Electron
 * bridge is not available (e.g. running renderer outside Electron during tests).
 */
export function sendReplayCommand(payload: ReplayPayload, targetClientId?: string): void {
  if (!window.electron?.sendCommand) return;
  window.electron.sendCommand({
    type: "command",
    command: "replay_request",
    targetClientId,
    payload,
  });
}

/**
 * Replays a request exactly as captured, no edits.
 *
 * Multipart requests are replayed from their captured parts — the body snippet
 * is only a human-readable summary and would be meaningless on the wire.
 */
export function replayRequest(request: RequestState): void {
  const formParts = request.requestFormParts;

  sendReplayCommand({
    url: request.url,
    method: request.method,
    headers: request.requestHeaders,
    body: formParts?.length ? undefined : request.requestBodySnippet,
    formParts: formParts?.length ? formParts : undefined,
  }, request.sourceClientId);
}
