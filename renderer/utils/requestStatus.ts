import { RequestState } from "../types";

/** CSS class for a request's status badge, by status code class. */
export function getStatusClass(request: RequestState): string {
  if (request.isError) return "status-error";
  if (!request.status) return "status-pending";
  if (request.status >= 200 && request.status < 300) return "status-success";
  if (request.status >= 300 && request.status < 400) return "status-redirect";
  if (request.status >= 400 && request.status < 500) return "status-client-error";
  if (request.status >= 500) return "status-server-error";
  return "";
}
