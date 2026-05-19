import { RequestState } from "../types";

export interface ReplayPayload {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Sends a replay command to the agent. Falls back to no-op if the Electron
 * bridge is not available (e.g. running renderer outside Electron during tests).
 */
export function sendReplayCommand(payload: ReplayPayload): void {
  if (!window.electron?.sendCommand) return;
  window.electron.sendCommand({
    type: "command",
    command: "replay_request",
    payload,
  });
}

/**
 * Replays a request exactly as captured, no edits.
 */
export function replayRequest(request: RequestState): void {
  sendReplayCommand({
    url: request.url,
    method: request.method,
    headers: request.requestHeaders,
    body: request.requestBodySnippet,
  });
}
