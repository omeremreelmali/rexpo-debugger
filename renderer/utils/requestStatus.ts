import { RequestState } from "../types";

/** A real status code always wins: older agents flag axios 4xx/5xx as errors. */
export function isTransportError(request: RequestState): boolean {
  return Boolean(request.isError) && !request.status;
}

export function isPending(request: RequestState): boolean {
  return !request.isError && !request.status;
}

/** Text for a request's status badge. */
export function getStatusLabel(request: RequestState): string {
  if (request.status) return String(request.status);
  return request.isError ? "ERR" : "···";
}

/** CSS class for a request's status badge, by status code class. */
export function getStatusClass(request: RequestState): string {
  if (isTransportError(request)) return "status-error";
  if (!request.status) return "status-pending";
  if (request.status >= 200 && request.status < 300) return "status-success";
  if (request.status >= 300 && request.status < 400) return "status-redirect";
  if (request.status >= 400 && request.status < 500) return "status-client-error";
  if (request.status >= 500) return "status-server-error";
  return "";
}
