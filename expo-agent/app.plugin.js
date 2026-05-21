/**
 * Expo config plugin for rexpo-debugger.
 *
 * Injects the iOS / Android permissions required for mDNS / Bonjour service
 * discovery — but ONLY in development / preview builds. Production builds are
 * left untouched so the permissions never reach end users on the App Store.
 *
 * Usage in app.json:
 *
 *   {
 *     "expo": {
 *       "plugins": ["rexpo-debugger"]
 *     }
 *   }
 *
 * Optional config:
 *
 *   ["rexpo-debugger", { "iosLocalNetworkUsageDescription": "Custom string" }]
 */

const {
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
} = require("@expo/config-plugins");

const SERVICE_TYPE = "_rexpo._tcp";
const DEFAULT_IOS_USAGE =
  "Used by rexpo-debugger (dev only) to discover this developer's debugger on the local network.";

function isProductionBuild() {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (profile && profile.toLowerCase() === "production") return true;
  // Fallback for non-EAS builds — only treat NODE_ENV=production as prod when
  // EAS_BUILD_PROFILE is not set, because EAS sets NODE_ENV=production for all
  // profiles including development.
  if (!profile && process.env.NODE_ENV === "production") return true;
  return false;
}

function withRexpoIos(config, props) {
  const usageDescription =
    props.iosLocalNetworkUsageDescription || DEFAULT_IOS_USAGE;

  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSLocalNetworkUsageDescription = usageDescription;

    const existing = Array.isArray(cfg.modResults.NSBonjourServices)
      ? cfg.modResults.NSBonjourServices
      : [];
    if (!existing.includes(SERVICE_TYPE)) {
      cfg.modResults.NSBonjourServices = [...existing, SERVICE_TYPE];
    }
    return cfg;
  });
}

function withRexpoAndroid(config) {
  return withAndroidManifest(config, (cfg) => {
    // `ensurePermissions` mutates the manifest in place and returns a
    // `{ permission: boolean }` map describing what was added — NOT the
    // manifest itself. Assigning that return value to `cfg.modResults`
    // overwrites the manifest with a boolean map, which breaks every
    // subsequent android.manifest mod in the pipeline with:
    //   TypeError: Cannot read properties of undefined (reading 'hasOwnProperty')
    // Discard the return value; the mutation is what we want.
    AndroidConfig.Permissions.ensurePermissions(cfg.modResults, [
      "android.permission.ACCESS_WIFI_STATE",
      "android.permission.CHANGE_WIFI_MULTICAST_STATE",
      "android.permission.INTERNET",
    ]);
    return cfg;
  });
}

/**
 * @param {import('@expo/config-plugins').ConfigPlugin} config
 * @param {{ iosLocalNetworkUsageDescription?: string, force?: boolean }} props
 */
const withRexpoDebugger = (config, props = {}) => {
  // Production safety: skip permission injection entirely in production builds
  // unless explicitly forced.
  if (isProductionBuild() && !props.force) {
    console.log(
      "[rexpo-debugger] Production build detected — skipping permission injection."
    );
    return config;
  }

  config = withRexpoIos(config, props);
  config = withRexpoAndroid(config);
  return config;
};

module.exports = withRexpoDebugger;
