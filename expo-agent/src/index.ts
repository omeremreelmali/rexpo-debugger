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
