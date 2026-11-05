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

export interface ReplayResult {
  ok: boolean;
  message: string;
}

/** What the agent stores instead of the real body when it can't keep it all. */
const PARTIAL_BODY = /\n…\[truncated\]$|^\[(Blob|ArrayBuffer): |^\[unserializable body\]$/;

export function hasPartialBody(body?: string): boolean {
  return Boolean(body && PARTIAL_BODY.test(body));
}

/**
 * Sends a replay command to the agent, and reports whether one received it.
 * A body the agent only captured in part is refused: sending it would hit the
 * server with corrupt data that looks like a real request.
 */
export async function sendReplayCommand(
  payload: ReplayPayload,
  targetClientId?: string
): Promise<ReplayResult> {
  if (!window.electron?.sendCommand) {
    return { ok: false, message: "Replay is not available here" };
  }
  if (!payload.formParts?.length && hasPartialBody(payload.body)) {
    return {
      ok: false,
      message: "Body was truncated at capture. Raise maxBodyLength in initNetworkAgent to replay it.",
    };
  }
  const { delivered } = await window.electron.sendCommand({
    type: "command",
    command: "replay_request",
    targetClientId,
    payload,
  });
  return delivered > 0
    ? { ok: true, message: "Replay sent" }
    : { ok: false, message: "No connected app to replay on" };
}

/**
 * Replays a request exactly as captured, no edits.
 *
 * Multipart requests are replayed from their captured parts — the body snippet
 * is only a human-readable summary and would be meaningless on the wire.
 */
export function replayRequest(request: RequestState): Promise<ReplayResult> {
  const formParts = request.requestFormParts;

  return sendReplayCommand({
    url: request.url,
    method: request.method,
    headers: request.requestHeaders,
    body: formParts?.length ? undefined : request.requestBodySnippet,
    formParts: formParts?.length ? formParts : undefined,
  }, request.sourceClientId);
}
