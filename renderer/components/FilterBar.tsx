import React from "react";
import { useNetwork } from "../state/NetworkContext";
import { FilterMethod, FilterStatus } from "../types";
import "./FilterBar.css";

export function FilterBar() {
  const { state, dispatch } = useNetwork();

  const methods: FilterMethod[] = [
    "ALL",
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
  ];
  const statuses: FilterStatus[] = ["ALL", "2xx", "3xx", "4xx", "5xx", "ERR"];

  return (
    <div className="filter-bar">
      <div className="filter-bar-left">
        <h1 className="app-title">🔍 Rexpo Network Inspector</h1>
        <span className="connection-status">
          WebSocket: <span className="status-active">ws://localhost:5051</span>
        </span>
      </div>

      <div className="filter-bar-center">
        <input
          type="text"
          className="search-input"
          placeholder="Search by URL..."
          value={state.searchQuery}
          onChange={(e) =>
            dispatch({ type: "SET_SEARCH", payload: e.target.value })
          }
        />

        <div className="filter-group">
          <label>Method:</label>
          <select
            value={state.filterMethod}
            onChange={(e) =>
              dispatch({
                type: "SET_FILTER_METHOD",
                payload: e.target.value as FilterMethod,
              })
            }
          >
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select
            value={state.filterStatus}
            onChange={(e) =>
              dispatch({
                type: "SET_FILTER_STATUS",
                payload: e.target.value as FilterStatus,
              })
            }
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-bar-right">
        <button
          className={`pause-button ${state.isPaused ? "paused" : ""}`}
          onClick={() => dispatch({ type: "TOGGLE_PAUSE" })}
        >
          {state.isPaused ? "▶️ Resume" : "⏸️ Pause"}
        </button>
        <button
          className="clear-button"
          onClick={() => dispatch({ type: "CLEAR_ALL" })}
        >
          🗑️ Clear
        </button>
        <span className="request-count">{state.requests.length} requests</span>
      </div>
    </div>
  );
}
