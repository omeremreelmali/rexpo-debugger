/**
 * mDNS / Bonjour auto-discovery for the Rexpo Debugger desktop service.
 *
 * The desktop debugger publishes itself as `_rexpo._tcp` on the local network.
 * This module locates that service so the agent can connect without the user
 * hard-coding an IP / port.
 *
 * Requires `react-native-zeroconf` to be installed in the host app and the app
 * to be running as a dev build (Expo Go does not declare `_rexpo._tcp` in its
 * Info.plist, so iOS silently blocks the discovery).
 */

const DEFAULT_SERVICE_TYPE = "rexpo";
const DEFAULT_PROTOCOL = "tcp";
const DEFAULT_DOMAIN = "local.";
const DEFAULT_TIMEOUT_MS = 10000;

export interface DiscoveryOptions {
  /** Service type without the underscore/protocol suffix. Default: "rexpo" */
  serviceType?: string;
  /** Discovery timeout in milliseconds. Default: 10_000 */
  timeoutMs?: number;
  /** Verbose logging */
  debug?: boolean;
}

export interface DiscoveredService {
  url: string;
  host: string;
  port: number;
  name: string;
}

let cached: DiscoveredService | null = null;
let inFlight: Promise<DiscoveredService> | null = null;

function loadZeroconf(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-zeroconf");
    return mod.default || mod;
  } catch {
    return null;
  }
}

function buildWsUrl(host: string, port: number): string {
  // Strip trailing dot that Bonjour likes to append to hostnames.
  const normalized = host.endsWith(".") ? host.slice(0, -1) : host;
  return `ws://${normalized}:${port}`;
}

/**
 * Picks the most-likely-reachable IPv4 from a discovered service.
 *
 * On macOS/Windows it's common to have multiple interfaces advertised over
 * mDNS — typically Wi-Fi + one or more VPN tunnels (utun*, tap*, Tailscale,
 * Cisco AnyConnect, ZeroTier, etc.). bonjour-service announces on every
 * multicast-capable interface, so the resolved service can come back with
 * addresses like ["10.16.26.54", "192.168.1.172"]. If the agent just grabs
 * the first one and that's the VPN, the WebSocket connect attempt is
 * unreachable from the phone's Wi-Fi.
 *
 * Heuristic ranking (lower = more likely the real LAN address):
 *   0  — 192.168.x.x   typical home / SMB Wi-Fi
 *   1  — 172.16-31.x.x private class B
 *   2  — 10.x.x.x      private class A (often LAN, sometimes VPN)
 *   3  — anything else (skipped earlier by the IPv4 regex, but kept for safety)
 *
 * If the candidate list is empty, fall back to the mDNS hostname (e.g.
 * `apple-MacBook-Air.local`) which the OS may resolve to a reachable
 * interface on its own.
 */
function ipv4Rank(addr: string): number {
  if (/^192\.168\./.test(addr)) return 0;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(addr)) return 1;
  if (/^10\./.test(addr)) return 2;
  return 3;
}

function pickAddress(
  service: any,
  log?: (...args: any[]) => void
): string | null {
  const addrs: string[] = service.addresses || [];
  const ipv4 = addrs.filter((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a));

  if (ipv4.length > 0) {
    const ranked = [...ipv4].sort((a, b) => ipv4Rank(a) - ipv4Rank(b));
    if (log && ipv4.length > 1) {
      log(
        `Multiple addresses advertised: ${ipv4.join(", ")} — picking ${ranked[0]}`
      );
    }
    return ranked[0];
  }

  if (addrs.length > 0) return addrs[0];
  return service.host || null;
}

/**
 * Discovers the desktop debugger via mDNS and returns its WebSocket URL.
 * Result is cached for the lifetime of the JS context.
 */
export function discoverDebugger(
  options: DiscoveryOptions = {}
): Promise<DiscoveredService> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  const serviceType = options.serviceType || DEFAULT_SERVICE_TYPE;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const debug = options.debug ?? false;
  const log = (...args: any[]) => {
    if (debug) console.log("[Discovery]", ...args);
  };

  inFlight = new Promise<DiscoveredService>((resolve, reject) => {
    const Zeroconf = loadZeroconf();
    if (!Zeroconf) {
      reject(
        new Error(
          "rexpo-debugger: 'react-native-zeroconf' is not installed. " +
            "Install it with: npx expo install react-native-zeroconf, then rebuild the dev client. " +
            "Or pass `wsUrl` explicitly to skip auto-discovery."
        )
      );
      return;
    }

    let zc: any;
    try {
      zc = new Zeroconf();
    } catch (err) {
      reject(err);
      return;
    }

    let settled = false;
    const cleanup = () => {
      try {
        zc.removeDeviceListeners();
      } catch {
        // ignore
      }
      try {
        zc.stop();
      } catch {
        // ignore
      }
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new Error(
          `rexpo-debugger: mDNS discovery timed out after ${timeoutMs}ms. ` +
            "Make sure the debugger is running on a machine in the same Wi-Fi. " +
            "If your network blocks mDNS, pass `wsUrl` explicitly."
        )
      );
    }, timeoutMs);

    zc.on("resolved", (service: any) => {
      if (settled) return;
      log("resolved:", service?.name, service?.host, service?.port, service?.addresses);

      const host = pickAddress(service, log);
      if (!host || !service?.port) return;

      settled = true;
      clearTimeout(timer);
      cleanup();

      const result: DiscoveredService = {
        url: buildWsUrl(host, service.port),
        host,
        port: service.port,
        name: service.name || serviceType,
      };
      cached = result;
      resolve(result);
    });

    zc.on("error", (err: any) => {
      log("zeroconf error:", err);
      // Don't reject on transient errors — wait for timeout
    });

    log(`scanning for _${serviceType}._${DEFAULT_PROTOCOL} on ${DEFAULT_DOMAIN}`);
    try {
      zc.scan(serviceType, DEFAULT_PROTOCOL, DEFAULT_DOMAIN);
    } catch (err) {
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(err);
    }
  });

  inFlight
    .catch(() => {
      // Ensure subsequent calls can retry instead of getting the rejected promise back.
      inFlight = null;
    })
    .finally(() => {
      if (cached) inFlight = null;
    });

  return inFlight;
}

/**
 * Forget the cached discovery result so the next call triggers a fresh scan
 * (useful after Wi-Fi change or a desktop port restart where the cached URL
 * is no longer valid).
 *
 * Important: we deliberately do NOT clear `inFlight`. A scan currently in
 * progress is something OTHER agents might be `await`ing — killing the
 * reference here would split a single shared scan into multiple concurrent
 * ones, which on some native bridges (iOS NSNetService, Android NsdManager)
 * fights for the same socket and ends in everybody timing out.
 */
export function resetDiscoveryCache(): void {
  cached = null;
}
