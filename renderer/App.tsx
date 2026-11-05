import React, { useState, useEffect, useRef, useCallback } from "react";
import { NetworkProvider, useNetwork } from "./state/NetworkContext";
import { SettingsProvider, useSettings } from "./state/SettingsContext";
import { CollectionsProvider } from "./state/CollectionsContext";
import { StateProvider } from "./state/StateContext";
import { ToastProvider, useToast } from "./components/Toast";
import { BootSequence } from "./components/BootSequence";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { FilterBar } from "./components/FilterBar";
import { StatusLine } from "./components/StatusLine";
import { TopBar } from "./components/TopBar";
import { NetworkTable } from "./components/NetworkTable";
import { RequestDetails } from "./components/RequestDetails";
import { ConsoleTable } from "./components/ConsoleTable";
import { ConsoleDetails } from "./components/ConsoleDetails";
import { CollectionsPanel } from "./components/CollectionsPanel";
import { StatePanel } from "./components/StatePanel";
import "./App.css";

const PANEL_WIDTH_STORAGE_KEY = "rexpo-debugger-panel-width";
const MIN_LEFT_PANEL_WIDTH = 300;
const MIN_RIGHT_PANEL_WIDTH = 300;

function AppContent() {
  const { state, dispatch } = useNetwork();
  const { settings } = useSettings();
  const toast = useToast();

  // The server starts on the default port, so move it to the saved one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.electron?.setNetworkPort?.(settings.connection.port).then((result) => {
      if (!result.ok) {
        toast.show(`Port ${settings.connection.port} unavailable: ${result.error}`, "error", 6000);
      }
    });
  }, []);

  // Sync persisted history limits from settings to the network state.
  useEffect(() => {
    dispatch({
      type: "SET_LIMITS",
      payload: {
        maxRequestHistory: settings.network.maxRequestHistory,
        maxLogHistory: settings.console.maxLogHistory,
      },
    });
  }, [settings.network.maxRequestHistory, settings.console.maxLogHistory, dispatch]);

  // Apply the persisted default log level only on first mount so the user's
  // runtime changes to the filter aren't overwritten on subsequent renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    dispatch({ type: "SET_FILTER_LOG_LEVEL", payload: settings.console.defaultLogLevel });
  }, []);

  // RED-157: auto-clear panels when a new agent connects (= app init/reload).
  // We mirror settings into a ref so the listener always reads the live values
  // without being re-bound when settings change.
  const autoClearSettingsRef = useRef(settings);
  useEffect(() => {
    autoClearSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!window.electron?.onSessionStarted) return;
    window.electron.onSessionStarted(() => {
      const current = autoClearSettingsRef.current;
      if (current.network.autoClearOnInit) {
        dispatch({ type: "CLEAR_NETWORK" });
      }
      if (current.console.autoClearOnInit) {
        dispatch({ type: "CLEAR_CONSOLE" });
      }
    });
    return () => window.electron?.removeSessionStartedListener?.();
  }, [dispatch]);

  // RED-160 follow-up: sync the auto-detect (mDNS) toggle to the Electron side
  // so disabling it actually stops the Bonjour publisher.
  useEffect(() => {
    window.electron?.setMdnsEnabled?.(settings.connection.autoDetectIp).catch(() => {
      // ignore IPC errors — desktop will log them
    });
  }, [settings.connection.autoDetectIp]);

  // Theme: apply `data-theme` to <html> whenever settings.ui.theme changes.
  // "system" mode also watches prefers-color-scheme so the UI flips along with
  // the OS appearance while the app is open.
  useEffect(() => {
    const root = document.documentElement;
    const mode = settings.ui.theme;

    if (mode === "dark" || mode === "light") {
      root.setAttribute("data-theme", mode);
      return;
    }

    // "system" — listen to OS changes
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const applySystem = () => {
      root.setAttribute("data-theme", mql.matches ? "light" : "dark");
    };
    applySystem();
    mql.addEventListener("change", applySystem);
    return () => mql.removeEventListener("change", applySystem);
  }, [settings.ui.theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-fx", settings.ui.effects ? "on" : "off");
  }, [settings.ui.effects]);

  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : 50; // Default 50% of viewport
  });
  const [isDragging, setIsDragging] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // Save panel width to localStorage
  useEffect(() => {
    localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, leftPanelWidth.toString());
  }, [leftPanelWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    if (mainContentRef.current) {
      const containerWidth = mainContentRef.current.offsetWidth;
      startWidthRef.current = (leftPanelWidth / 100) * containerWidth;
    }
  }, [leftPanelWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !mainContentRef.current) return;

    const containerWidth = mainContentRef.current.offsetWidth;
    const deltaX = e.clientX - startXRef.current;
    const newWidth = startWidthRef.current + deltaX;

    // Calculate min and max widths in pixels
    const minLeftWidth = MIN_LEFT_PANEL_WIDTH;
    const maxLeftWidth = containerWidth - MIN_RIGHT_PANEL_WIDTH;

    // Clamp the width
    const clampedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth));
    
    // Convert to percentage
    const newPercentage = (clampedWidth / containerWidth) * 100;
    setLeftPanelWidth(newPercentage);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
      <div className="app-container">
        <TopBar />
        {(state.activeTab === "network" || state.activeTab === "console") && <FilterBar />}

      {/* Main Content */}
      <div className="panel-stage" key={state.activeTab}>
        {state.activeTab === "collections" ? (
          <CollectionsPanel />
        ) : state.activeTab === "state" ? (
          <StatePanel />
        ) : (
          <div className="main-content" ref={mainContentRef}>
            <div
              className="left-panel"
              style={{ width: `${leftPanelWidth}%` }}
            >
              {state.activeTab === "network" ? <NetworkTable /> : <ConsoleTable />}
            </div>
            <div
              className={`resizer ${isDragging ? "dragging" : ""}`}
              onMouseDown={handleMouseDown}
            />
            <div
              className="right-panel"
              style={{ width: `${100 - leftPanelWidth}%` }}
            >
              {state.activeTab === "network" ? <RequestDetails /> : <ConsoleDetails />}
            </div>
          </div>
        )}
      </div>

      <StatusLine />
      <BootSequence />
      <div className="crt-overlay" aria-hidden="true" />
    </div>
  );
}

export function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <CollectionsProvider>
          <StateProvider>
            <NetworkProvider>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </NetworkProvider>
          </StateProvider>
        </CollectionsProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}

