/**
 * Parses a `curl` command string into the request fields we can save/replay.
 *
 * Handles the flags people actually paste from browser devtools and API docs:
 * -X/--request, -H/--header, -d/--data(-raw/-binary/-ascii/-urlencode),
 * --url, -u/--user (→ Basic auth), -b/--cookie, -A/--user-agent, -e/--referer,
 * -G/--get. Value-less flags (--compressed, -L, -k, -s, …) are ignored.
 *
 * The tokenizer respects single quotes, double quotes (with escapes),
 * $'…' ANSI-C quoting, and backslash-newline line continuations.
 */

export interface ParsedCurlRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export type ParseCurlResult =
  | { ok: true; request: ParsedCurlRequest }
  | { ok: false; error: string };

function tokenize(s: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let has = false;
  let i = 0;
  const n = s.length;
  const push = () => {
    if (has) {
      tokens.push(cur);
      cur = "";
      has = false;
    }
  };

  while (i < n) {
    const c = s[i];

    // Backslash: line continuation or escaped char (outside quotes)
    if (c === "\\") {
      if (i + 1 < n && (s[i + 1] === "\n" || s[i + 1] === "\r")) {
        i += 2; // drop "\<newline>" — acts as a separator
        continue;
      }
      if (i + 1 < n) {
        cur += s[i + 1];
        has = true;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (c === "'") {
      has = true;
      i++;
      while (i < n && s[i] !== "'") cur += s[i++];
      if (i >= n) throw new Error("Unterminated single quote (')");
      i++;
      continue;
    }

    if (c === '"') {
      has = true;
      i++;
      while (i < n && s[i] !== '"') {
        if (s[i] === "\\" && i + 1 < n) {
          const nx = s[i + 1];
          if (nx === '"' || nx === "\\" || nx === "$" || nx === "`") {
            cur += nx;
            i += 2;
            continue;
          }
        }
        cur += s[i++];
      }
      if (i >= n) throw new Error('Unterminated double quote (")');
      i++;
      continue;
    }

    // $'…' ANSI-C quoting (common for bodies with newlines)
    if (c === "$" && i + 1 < n && s[i + 1] === "'") {
      has = true;
      i += 2;
      const esc: Record<string, string> = {
        n: "\n",
        t: "\t",
        r: "\r",
        "\\": "\\",
        "'": "'",
        '"': '"',
      };
      while (i < n && s[i] !== "'") {
        if (s[i] === "\\" && i + 1 < n) {
          const nx = s[i + 1];
          cur += esc[nx] ?? nx;
          i += 2;
          continue;
        }
        cur += s[i++];
      }
      if (i >= n) throw new Error("Unterminated $'…' quote");
      i++;
      continue;
    }

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      push();
      i++;
      continue;
    }

    cur += c;
    has = true;
    i++;
  }
  push();
  return tokens;
}

function setHeader(headers: Record<string, string>, raw: string) {
  const idx = raw.indexOf(":");
  if (idx < 0) {
    const k = raw.trim();
    if (k) headers[k] = "";
    return;
  }
  const k = raw.slice(0, idx).trim();
  const v = raw.slice(idx + 1).trim();
  if (k) headers[k] = v;
}

function toBase64(input: string): string {
  try {
    return btoa(input);
  } catch {
    return input;
  }
}

export function parseCurlCommand(input: string): ParseCurlResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Paste a cURL command first." };

  let tokens: string[];
  try {
    tokens = tokenize(trimmed);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Must start with `curl` (or a path ending in /curl) — otherwise it's not a
  // cURL command and we'd happily parse garbage into a bogus request.
  if (!tokens.length || !/(^|\/)curl$/i.test(tokens[0])) {
    return { ok: false, error: "Doesn't look like a cURL command (must start with `curl`)." };
  }
  tokens = tokens.slice(1);
  if (!tokens.length)
    return { ok: false, error: "Nothing after `curl` to parse." };

  let method = "";
  let url = "";
  const headers: Record<string, string> = {};
  const dataParts: string[] = [];
  let getWithData = false;

  for (let i = 0; i < tokens.length; i++) {
    let flag = tokens[i];
    let inlineVal: string | null = null;
    if (flag.startsWith("--") && flag.includes("=")) {
      const eq = flag.indexOf("=");
      inlineVal = flag.slice(eq + 1);
      flag = flag.slice(0, eq);
    }
    const val = (): string =>
      inlineVal !== null ? inlineVal : (tokens[++i] ?? "");

    switch (flag) {
      case "-X":
      case "--request":
        method = val().toUpperCase();
        break;
      case "-H":
      case "--header":
        setHeader(headers, val());
        break;
      case "-d":
      case "--data":
      case "--data-raw":
      case "--data-ascii":
      case "--data-binary":
      case "--data-urlencode":
        dataParts.push(val());
        break;
      case "--url":
        url = val();
        break;
      case "-u":
      case "--user":
        headers["Authorization"] = "Basic " + toBase64(val());
        break;
      case "-b":
      case "--cookie":
        headers["Cookie"] = val();
        break;
      case "-A":
      case "--user-agent":
        headers["User-Agent"] = val();
        break;
      case "-e":
      case "--referer":
        headers["Referer"] = val();
        break;
      case "-G":
      case "--get":
        getWithData = true;
        break;
      // Known value-less flags — ignore.
      case "--compressed":
      case "-L":
      case "--location":
      case "-k":
      case "--insecure":
      case "-s":
      case "--silent":
      case "-i":
      case "--include":
      case "-v":
      case "--verbose":
      case "-f":
      case "--fail":
      case "-S":
      case "--show-error":
      case "-#":
      case "--progress-bar":
      case "--no-buffer":
        break;
      default:
        // Unknown flag → ignore (don't consume a value). Bare token → URL.
        if (!flag.startsWith("-") && !url) url = flag;
    }
  }

  if (!url) return { ok: false, error: "No URL found in the command." };

  let body: string | undefined =
    dataParts.length > 0 ? dataParts.join("&") : undefined;

  if (getWithData && body) {
    url += (url.includes("?") ? "&" : "?") + body;
    body = undefined;
  }
  if (!method) method = body ? "POST" : "GET";

  return { ok: true, request: { method, url, headers, body } };
}
