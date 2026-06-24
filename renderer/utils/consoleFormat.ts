/**
 * Clean, plain-text formatting for console logs — used by the "Copy" actions so
 * the copied text is exactly the message, with no DOM/markup artifacts (the
 * "[0]" arg indices, viewer spans, indentation) that text-selection picks up.
 */

/** Pretty, multi-line plain text for a single console argument. */
export function formatConsoleArg(arg: any): string {
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean") return String(arg);

  if (arg && typeof arg === "object") {
    if (arg.__type === "Error") {
      return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ""}`;
    }
    if (arg.__type === "Date") return arg.value;
    if (arg.__type === "RegExp") return arg.value;
    if (arg.__type === "Function") return arg.value ?? `function ${arg.name}()`;

    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return "[Circular or Unserializable Object]";
    }
  }

  return String(arg);
}

/** The full message of a log — every argument joined, as the console showed it. */
export function consoleLogToText(log: { args: any[] }): string {
  return log.args.map(formatConsoleArg).join(" ");
}
