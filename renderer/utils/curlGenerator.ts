import { FormDataPart, RequestState } from "../types";

/** Escapes a value for use inside single quotes in a POSIX shell */
function shellQuote(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

/** Turns a device-local uri into a path curl can read with `-F name=@path` */
function localPath(part: FormDataPart): string {
  const uri = part.uri || "";
  if (uri.startsWith("file://")) {
    try {
      return decodeURIComponent(uri.slice("file://".length));
    } catch {
      return uri.slice("file://".length);
    }
  }
  // No local uri captured — leave an obvious placeholder to fill in
  return uri || `/path/to/${part.fileName || "file"}`;
}

/**
 * Generates cURL command from request
 */
export function generateCurlCommand(request: RequestState): string {
  const parts: string[] = ["curl"];
  const formParts = request.requestFormParts;
  const isMultipart = !!formParts?.length;

  // Method
  if (request.method && request.method !== "GET") {
    parts.push(`-X ${request.method}`);
  }

  // Headers
  if (request.requestHeaders) {
    // curl generates its own multipart boundary, so the captured content-type
    // (which carries the original boundary) has to go.
    const skipped = ["host", "connection", "content-length"];
    if (isMultipart) skipped.push("content-type");

    Object.entries(request.requestHeaders).forEach(([key, value]) => {
      // Skip some automatic headers
      if (!skipped.includes(key.toLowerCase())) {
        parts.push(`-H '${shellQuote(`${key}: ${value}`)}'`);
      }
    });
  }

  // Body
  if (isMultipart) {
    formParts!.forEach((part) => {
      if (part.kind === "file") {
        const typeSuffix = part.mimeType ? `;type=${part.mimeType}` : "";
        parts.push(
          `-F '${shellQuote(`${part.name}=@${localPath(part)}${typeSuffix}`)}'`
        );
      } else {
        parts.push(`-F '${shellQuote(`${part.name}=${part.value ?? ""}`)}'`);
      }
    });
  } else if (request.requestBodySnippet) {
    // Pretty format if JSON body
    try {
      const parsed = JSON.parse(request.requestBodySnippet);
      const jsonString = JSON.stringify(parsed);
      parts.push(`-d '${shellQuote(jsonString)}'`);
    } catch {
      // Add directly if not JSON
      parts.push(`-d '${shellQuote(request.requestBodySnippet)}'`);
    }
  }

  // URL (at the end)
  parts.push(`'${shellQuote(request.url)}'`);

  return parts.join(" \\\n  ");
}

/**
 * Copies to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    
    // Fallback: Old method
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch (fallbackError) {
      console.error("Fallback copy also failed:", fallbackError);
      return false;
    }
  }
}

