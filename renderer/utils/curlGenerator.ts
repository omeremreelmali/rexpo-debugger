import { RequestState } from "../types";

/**
 * Generates cURL command from request
 */
export function generateCurlCommand(request: RequestState): string {
  const parts: string[] = ["curl"];

  // Method
  if (request.method && request.method !== "GET") {
    parts.push(`-X ${request.method}`);
  }

  // Headers
  if (request.requestHeaders) {
    Object.entries(request.requestHeaders).forEach(([key, value]) => {
      // Skip some automatic headers
      if (!["host", "connection", "content-length"].includes(key.toLowerCase())) {
        parts.push(`-H '${key}: ${value}'`);
      }
    });
  }

  // Body
  if (request.requestBodySnippet) {
    // Pretty format if JSON body
    try {
      const parsed = JSON.parse(request.requestBodySnippet);
      const jsonString = JSON.stringify(parsed);
      parts.push(`-d '${jsonString}'`);
    } catch {
      // Add directly if not JSON
      parts.push(`-d '${request.requestBodySnippet.replace(/'/g, "\\'")}'`);
    }
  }

  // URL (at the end)
  parts.push(`'${request.url}'`);

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

