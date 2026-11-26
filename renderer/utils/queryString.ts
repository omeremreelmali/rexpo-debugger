/**
 * Splits and rebuilds URLs for the Edit & Replay form without normalising them.
 *
 * The URL API is not used on purpose: it reports `null` as the origin of
 * custom schemes (myapp://host/path), and URLSearchParams re-encodes every
 * value (ids=1,2,3 becomes ids=1%2C2%2C3), so an untouched request would be
 * sent differently from how the app sent it. Each parameter keeps its original
 * text and is written back verbatim unless its key or value was edited.
 */

export interface QueryParam {
  key: string;
  value: string;
  /** The segment as it appeared in the URL, e.g. "ids=1,2,3" or "flag". */
  raw?: string;
  /** Decoded key and value at parse time; an edit makes them differ. */
  originalKey?: string;
  originalValue?: string;
}

function decodePart(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, " "));
  } catch {
    return text;
  }
}

/**
 * Encodes only what would change the meaning of a query: the separators, "+",
 * "%", whitespace and non-ASCII. Characters such as , : / @ stay readable.
 */
function encodePart(text: string, isKey: boolean): string {
  const encoded = encodeURIComponent(text).replace(
    /%(2C|3A|2F|40|24|3B|5B|5D|7C|3D)/gi,
    (match, hex: string) => (isKey && hex.toUpperCase() === "3D" ? match : decodeURIComponent(match))
  );
  return encoded;
}

/** Splits a URL into the part before "?" (with any #fragment) and its params. */
export function splitUrl(input: string): { base: string; params: QueryParam[] } {
  if (!input) return { base: "", params: [] };
  const hashIdx = input.indexOf("#");
  const queryIdx = input.indexOf("?");
  if (queryIdx < 0 || (hashIdx >= 0 && hashIdx < queryIdx)) {
    return { base: input, params: [] };
  }

  const hash = hashIdx >= 0 ? input.slice(hashIdx) : "";
  const search = input.slice(queryIdx + 1, hashIdx >= 0 ? hashIdx : undefined);
  const params: QueryParam[] = [];
  for (const segment of search.split("&")) {
    if (!segment) continue;
    const eq = segment.indexOf("=");
    const key = decodePart(eq < 0 ? segment : segment.slice(0, eq));
    const value = eq < 0 ? "" : decodePart(segment.slice(eq + 1));
    params.push({ key, value, raw: segment, originalKey: key, originalValue: value });
  }
  return { base: input.slice(0, queryIdx) + hash, params };
}

/** Rebuilds a URL from its base and params; untouched params keep their text. */
export function joinUrl(base: string, params: QueryParam[]): string {
  const segments = params
    .filter((p) => p.key.trim().length > 0)
    .map((p) => {
      if (p.raw !== undefined && p.key === p.originalKey && p.value === p.originalValue) {
        return p.raw;
      }
      const key = encodePart(p.key.trim(), true);
      // A bare flag (?debug) stays bare while it has no value.
      const wasFlag = p.raw !== undefined && !p.raw.includes("=");
      return p.value === "" && wasFlag ? key : `${key}=${encodePart(p.value, false)}`;
    });
  if (segments.length === 0) return base;

  const hashIdx = base.indexOf("#");
  const path = hashIdx >= 0 ? base.slice(0, hashIdx) : base;
  const hash = hashIdx >= 0 ? base.slice(hashIdx) : "";
  return `${path}?${segments.join("&")}${hash}`;
}
