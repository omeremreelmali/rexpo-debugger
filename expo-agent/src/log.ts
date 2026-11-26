/**
 * Logging for the agents themselves.
 *
 * The console methods are captured when this module loads, before the console
 * agent patches them, so the agents' own messages never come back to the
 * desktop as if the app had logged them.
 *
 * Nothing here uses console.error: in React Native that opens a red LogBox
 * toast. Real agent malfunctions go to console.warn. Failing to reach the
 * desktop is not a malfunction — it is what happens whenever the inspector is
 * closed — so it prints one short line per outage, with details only in debug
 * mode.
 */

const original = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
};

export interface AgentLogger {
  setDebug(enabled: boolean): void;
  /** Detail shown only with `debug: true`. */
  debug(...args: any[]): void;
  /** Desktop unreachable: one line per outage, details only in debug mode. */
  unreachable(...args: any[]): void;
  /** Call once connected, so the next outage is reported again. */
  connected(): void;
  /** Something in the agent itself went wrong. */
  error(...args: any[]): void;
}

export function createAgentLogger(tag?: string): AgentLogger {
  let debugMode = false;
  let outageReported = false;
  const withTag = (args: any[]) => (tag ? [tag, ...args] : args);

  return {
    setDebug(enabled) {
      debugMode = enabled;
    },
    debug(...args) {
      if (debugMode) original.log(...withTag(args));
    },
    unreachable(...args) {
      if (debugMode) {
        original.log(...withTag(args));
      } else if (!outageReported) {
        original.log(
          ...withTag([
            "Desktop inspector not reachable; retrying in the background. Pass debug: true for details.",
          ])
        );
      }
      outageReported = true;
    },
    connected() {
      outageReported = false;
    },
    error(...args) {
      original.warn(...withTag(args));
    },
  };
}
