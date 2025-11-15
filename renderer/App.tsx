import React from "react";
import { NetworkProvider, useNetwork } from "./state/NetworkContext";
import { FilterBar } from "./components/FilterBar";
import { NetworkTable } from "./components/NetworkTable";
import { RequestDetails } from "./components/RequestDetails";
import { ConsoleTable } from "./components/ConsoleTable";
import { ConsoleDetails } from "./components/ConsoleDetails";
import "./App.css";

function AppContent() {
  const { state, dispatch } = useNetwork();

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
        <div className="main-content">
          <div className="left-panel">
          {state.activeTab === "network" ? <NetworkTable /> : <ConsoleTable />}
          </div>
          <div className="right-panel">
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

