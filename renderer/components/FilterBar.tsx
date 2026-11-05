import { useEffect, useRef } from "react";
import { useNetwork } from "../state/NetworkContext";
import { FilterMethod, FilterStatus, FilterLogLevel } from "../types";
import { Icon } from "./Icons";
import "./FilterBar.css";

const METHODS: FilterMethod[] = ["ALL", "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];
const STATUSES: FilterStatus[] = ["ALL", "2xx", "3xx", "4xx", "5xx", "ERR"];
const LOG_LEVELS: FilterLogLevel[] = ["ALL", "log", "info", "warn", "error", "debug"];

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (next: T) => void;
  format?: (option: T) => string;
}) {
  return (
    <div className="filter-group" role="group" aria-label={label}>
      <span className="filter-group-label">{label}</span>
      <div className="filter-chips">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`filter-chip ${value === option ? "active" : ""}`}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {format ? format(option) : option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterBar() {
  const { state, dispatch } = useNetwork();
  const searchRef = useRef<HTMLInputElement>(null);

  const isNetworkTab = state.activeTab === "network";
  const itemCount = isNetworkTab ? state.requests.length : state.consoleLogs.length;
  const itemLabel = isNetworkTab ? "requests" : "logs";

  // "/" focuses the search box from anywhere that isn't already a text field.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="filter-bar">
      <label className="search-field">
        <span className="search-prompt">$ grep</span>
        <input
          ref={searchRef}
          type="text"
          className="search-input"
          placeholder={isNetworkTab ? "url…" : "console logs…"}
          spellCheck={false}
          value={state.searchQuery}
          onChange={(e) => dispatch({ type: "SET_SEARCH", payload: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Escape") e.currentTarget.blur();
          }}
        />
        <kbd className="search-kbd">/</kbd>
      </label>

      {isNetworkTab ? (
        <>
          <ChipGroup
            label="method"
            options={METHODS}
            value={state.filterMethod}
            onChange={(payload) => dispatch({ type: "SET_FILTER_METHOD", payload })}
            format={(m) => (m === "OPTIONS" ? "OPT" : m === "DELETE" ? "DEL" : m)}
          />
          <ChipGroup
            label="status"
            options={STATUSES}
            value={state.filterStatus}
            onChange={(payload) => dispatch({ type: "SET_FILTER_STATUS", payload })}
          />
        </>
      ) : (
        <ChipGroup
          label="level"
          options={LOG_LEVELS}
          value={state.filterLogLevel}
          onChange={(payload) => dispatch({ type: "SET_FILTER_LOG_LEVEL", payload })}
          format={(level) => level.toUpperCase()}
        />
      )}

      <div className="filter-bar-right">
        <span className="request-count">
          {itemCount} {itemLabel}
        </span>
        <button
          className={`hud-btn pause-button ${state.isPaused ? "paused" : ""}`}
          onClick={() => dispatch({ type: "TOGGLE_PAUSE" })}
          type="button"
        >
          <Icon name={state.isPaused ? "play" : "pause"} />
          {state.isPaused ? "Resume" : "Pause"}
        </button>
        <button
          className="hud-btn clear-button"
          onClick={() => dispatch({ type: isNetworkTab ? "CLEAR_NETWORK" : "CLEAR_CONSOLE" })}
          type="button"
        >
          <Icon name="trash" />
          Clear
        </button>
      </div>
    </div>
  );
}
