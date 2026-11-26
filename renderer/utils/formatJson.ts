/**
 * Re-indents JSON text without parsing its values, so the output keeps every
 * number exactly as written. A JSON.parse/stringify round trip would turn
 * 9007199254740993 into 9007199254740992 and 10.50 into 10.5, which silently
 * changes what a replayed request sends.
 *
 * Returns the input unchanged when it is not valid JSON.
 */
export function formatJsonLossless(input: string, indent = 2): string {
  if (!input.trim()) return input;
  try {
    JSON.parse(input);
  } catch {
    return input;
  }

  const pad = (depth: number) => "\n" + " ".repeat(depth * indent);
  let out = "";
  let depth = 0;
  let inString = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += input[++i] ?? "";
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    switch (ch) {
      case '"':
        inString = true;
        out += ch;
        break;
      case "{":
      case "[": {
        // Keep empty containers on one line: {} and [].
        let j = i + 1;
        while (j < input.length && /\s/.test(input[j])) j++;
        const close = ch === "{" ? "}" : "]";
        if (input[j] === close) {
          out += ch + close;
          i = j;
        } else {
          depth++;
          out += ch + pad(depth);
        }
        break;
      }
      case "}":
      case "]":
        depth--;
        out += pad(depth) + ch;
        break;
      case ",":
        out += "," + pad(depth);
        break;
      case ":":
        out += ": ";
        break;
      case " ":
      case "\t":
      case "\n":
      case "\r":
        break;
      default:
        out += ch;
    }
  }
  return out;
}
