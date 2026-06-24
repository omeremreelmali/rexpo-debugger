/**
 * rexpo-debugger
 *
 * Network debugging and console logging tool for Expo and React Native apps.
 * Inspect all network traffic and console logs in real-time with Chrome DevTools-like UI.
 *
 * @packageDocumentation
 */

// Network Agent
export { initNetworkAgent, addAxiosInstance } from "./agent";
export type { InitOptions } from "./agent";

// Console Agent
export { initConsoleAgent, restoreConsole } from "./console-agent";
export type { ConsoleAgentOptions, LogLevel, ConsoleMessage } from "./console-agent";

// State Agent (Redux / Zustand / custom store inspection)
export {
  initStateAgent,
  attachStore,
  attachReduxStore,
  attachZustandStore,
  stopStateAgent,
} from "./state-agent";
export type {
  StateAgentOptions,
  StoreAdapter,
  StateMessage,
} from "./state-agent";

// mDNS auto-discovery (advanced usage)
export { discoverDebugger, resetDiscoveryCache } from "./discovery";
export type { DiscoveryOptions, DiscoveredService } from "./discovery";
