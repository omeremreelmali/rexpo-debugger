import { RequestState } from "../types";

interface SaveResult {
  ok: boolean;
  cancelled?: boolean;
  fileName?: string;
  error?: string;
}

/**
 * Picks a sensible filename + extension for a captured response.
 *
 * Strategy:
 *  - If the URL path looks like it already has an extension (e.g. /foo/bar.png)
 *    use that base name.
 *  - Otherwise derive an extension from the response Content-Type header.
 *  - Fall back to "response.txt".
 */
function deriveFilename(request: RequestState): { defaultName: string; ext: string } {
  let urlPath = "";
  try {
    urlPath = new URL(request.url).pathname;
  } catch {
    urlPath = "";
  }

  const lastSegment = urlPath.split("/").filter(Boolean).pop() || "";
  const segmentMatch = lastSegment.match(/^(.+)\.([a-zA-Z0-9]{1,5})$/);

  const contentType = (() => {
    const headers = request.responseHeaders || {};
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === "content-type") {
        return headers[key].split(";")[0].trim().toLowerCase();
      }
    }
    return "";
  })();

  const extFromMime: Record<string, string> = {
    "application/json": "json",
    "application/xml": "xml",
    "text/xml": "xml",
    "text/html": "html",
    "text/plain": "txt",
    "text/css": "css",
    "text/javascript": "js",
    "application/javascript": "js",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/webp": "webp",
  };

  let ext = "txt";
  if (segmentMatch) {
    ext = segmentMatch[2].toLowerCase();
  } else if (extFromMime[contentType]) {
    ext = extFromMime[contentType];
  }

  const base = segmentMatch?.[1] || lastSegment || "response";
  // Sanitize for filesystem
  const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "response";
  return { defaultName: `${safeBase}.${ext}`, ext };
}

function buildFilters(ext: string): { name: string; extensions: string[] }[] {
  return [
    { name: ext.toUpperCase(), extensions: [ext] },
    { name: "All files", extensions: ["*"] },
  ];
}

export async function saveResponseToFile(request: RequestState): Promise<SaveResult> {
  if (!request.responseBodySnippet) {
    return { ok: false, error: "Bu request'in response body'si yok" };
  }
  if (!window.electron?.saveResponseToFile) {
    return { ok: false, error: "IPC köprüsü bulunamadı" };
  }

  const { defaultName, ext } = deriveFilename(request);

  // Pretty-print JSON for readability when saving
  let content = request.responseBodySnippet;
  if (ext === "json") {
    try {
      content = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      // body is labeled json but isn't valid — save as-is
    }
  }

  const result = await window.electron.saveResponseToFile({
    defaultName,
    content,
    filters: buildFilters(ext),
  });
  return result;
}
