import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { FilterLogLevel } from "../types";

const STORAGE_KEY = "rexpo-debugger-settings";

export type ThemeMode = "dark" | "light" | "system";

/**
 * The full settings shape persisted to localStorage.
 *
 * Some fields are already wired to live behaviour (see NetworkContext, App).
 * Others are shell-only placeholders that will be wired by their own issues:
 *   - autoClearOnInit (Network + Console) → RED-157
 *   - agents.networkEnabled / consoleEnabled → RED-158
 *   - connection.port (live restart) → future RED-160 follow-up
 *   - ui.theme (full light/dark) → future RED-160 follow-up
 *   - connection.autoDetectIp toggle (currently always-on) → future RED-160
 */
export interface DebuggerSettings {
  network: {
    autoClearOnInit: boolean;
    maxRequestHistory: number;
  };
  console: {
    autoClearOnInit: boolean;
    maxLogHistory: number;
    defaultLogLevel: FilterLogLevel;
  };
  connection: {
    port: number;
    autoDetectIp: boolean;
    manualWsUrl: string;
  };
  agents: {
    networkEnabled: boolean;
    consoleEnabled: boolean;
  };
  ui: {
    theme: ThemeMode;
  };
}

export const DEFAULT_SETTINGS: DebuggerSettings = {
  network: {
    autoClearOnInit: true,
    maxRequestHistory: 1000,
  },
  console: {
    autoClearOnInit: true,
    maxLogHistory: 1000,
    defaultLogLevel: "ALL",
  },
  connection: {
    port: 5051,
    autoDetectIp: true,
    manualWsUrl: "",
  },
  agents: {
    networkEnabled: true,
    consoleEnabled: true,
  },
  ui: {
    theme: "dark",
  },
};

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

interface SettingsContextValue {
  settings: DebuggerSettings;
  updateSettings: (patch: DeepPartial<DebuggerSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function mergeDeep<T>(base: T, patch: DeepPartial<T>): T {
  if (patch === null || patch === undefined) return base;
  if (typeof patch !== "object" || Array.isArray(patch)) return patch as T;
  const result: any = { ...base };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const baseVal = (base as any)?.[key];
    const patchVal = (patch as any)[key];
    if (
      patchVal !== null &&
      typeof patchVal === "object" &&
      !Array.isArray(patchVal) &&
      typeof baseVal === "object"
    ) {
      result[key] = mergeDeep(baseVal, patchVal);
    } else if (patchVal !== undefined) {
      result[key] = patchVal;
    }
  }
  return result as T;
}

function loadSettings(): DebuggerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // Merge with defaults so newly-added fields get sensible values.
    return mergeDeep(DEFAULT_SETTINGS, parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DebuggerSettings>(() => loadSettings());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn("[Settings] Failed to persist:", err);
    }
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSettings: (patch) => setSettings((prev) => mergeDeep(prev, patch)),
      resetSettings: () => setSettings(DEFAULT_SETTINGS),
    }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used inside <SettingsProvider>");
  }
  return ctx;
}
