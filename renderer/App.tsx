import React from "react";
import { NetworkProvider } from "./state/NetworkContext";
import { FilterBar } from "./components/FilterBar";
import { NetworkTable } from "./components/NetworkTable";
import { RequestDetails } from "./components/RequestDetails";
import "./App.css";

export function App() {
  return (
    <NetworkProvider>
      <div className="app-container">
        <FilterBar />
        <div className="main-content">
          <div className="left-panel">
            <NetworkTable />
          </div>
          <div className="right-panel">
            <RequestDetails />
          </div>
        </div>
      </div>
    </NetworkProvider>
  );
}

