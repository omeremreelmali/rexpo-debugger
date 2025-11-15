import React, { useState, useEffect, useRef, useCallback } from "react";
import { NetworkProvider, useNetwork } from "./state/NetworkContext";
import { FilterBar } from "./components/FilterBar";
import { NetworkTable } from "./components/NetworkTable";
import { RequestDetails } from "./components/RequestDetails";
import { ConsoleTable } from "./components/ConsoleTable";
import { ConsoleDetails } from "./components/ConsoleDetails";
import "./App.css";

const PANEL_WIDTH_STORAGE_KEY = "rexpo-debugger-panel-width";
const MIN_LEFT_PANEL_WIDTH = 300;
const MIN_RIGHT_PANEL_WIDTH = 300;

function AppContent() {
  const { state, dispatch } = useNetwork();
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
        <FilterBar />
      
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${state.activeTab === "network" ? "active" : ""}`}
          onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: "network" })}
        >
          <span className="tab-icon">🌐</span>
          Network
          {state.requests.length > 0 && (
            <span className="tab-count">{state.requests.length}</span>
          )}
        </button>
        <button
          className={`tab-button ${state.activeTab === "console" ? "active" : ""}`}
          onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: "console" })}
        >
          <span className="tab-icon">📋</span>
          Console
          {state.consoleLogs.length > 0 && (
            <span className="tab-count">{state.consoleLogs.length}</span>
          )}
        </button>
      </div>

      {/* Main Content */}
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
    </div>
  );
}

export function App() {
  return (
    <NetworkProvider>
      <AppContent />
    </NetworkProvider>
  );
}

