/**
 * rexpo-debugger
 *
 * Network debugging tool for Expo and React Native apps.
 * Inspect all network traffic in real-time with Chrome DevTools-like UI.
 *
 * @packageDocumentation
 */

export { initNetworkAgent, addAxiosInstance } from "./agent";

// Re-export types for convenience
export type { InitOptions } from "./agent";
