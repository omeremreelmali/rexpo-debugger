import React, { useMemo } from "react";
import { useNetwork } from "../state/NetworkContext";
import { ConsoleLog } from "../types";
import "./ConsoleTable.css";

export function ConsoleTable() {
  const { state, dispatch } = useNetwork();

  const filteredLogs = useMemo(() => {
    let logs = state.consoleLogs;

    // Filter by log level
    if (state.filterLogLevel !== "ALL") {
      logs = logs.filter((log) => log.level === state.filterLogLevel);
    }

    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      logs = logs.filter((log) => {
        const argsText = log.args.map(arg => formatArg(arg)).join(" ").toLowerCase();
        return argsText.includes(query);
      });
    }

    return logs;
  }, [state.consoleLogs, state.filterLogLevel, state.searchQuery]);

  const handleLogClick = (id: string) => {
    dispatch({ type: "SELECT_CONSOLE", payload: id });
  };

  return (
    <div className="console-table">
      <div className="console-header">
        <div className="console-header-cell level">Level</div>
        <div className="console-header-cell message">Message</div>
        <div className="console-header-cell timestamp">Time</div>
      </div>
      <div className="console-body">
        {filteredLogs.length === 0 ? (
          <div className="console-empty">
            <span>No console logs yet</span>
            <small>Console logs will appear here as they are generated</small>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`console-row ${
                state.selectedConsoleId === log.id ? "selected" : ""
              } level-${log.level}`}
              onClick={() => handleLogClick(log.id)}
            >
              <div className="console-cell level">
                <span className={`level-badge ${log.level}`}>
                  {log.level.toUpperCase()}
                </span>
              </div>
              <div className="console-cell message">
                {formatArgs(log.args)}
              </div>
              <div className="console-cell timestamp">
                {formatTime(log.timestamp)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatArgs(args: any[]): string {
  return args.map(arg => formatArg(arg)).join(" ");
}

function formatArg(arg: any): string {
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
  
  // Handle special serialized types
  if (arg && typeof arg === "object") {
    if (arg.__type === "Error") {
      return `${arg.name}: ${arg.message}`;
    }
    if (arg.__type === "Date") {
      return arg.value;
    }
    if (arg.__type === "RegExp") {
      return arg.value;
    }
    if (arg.__type === "Function") {
      return `function ${arg.name}()`;
    }
    
    // Regular object or array
    try {
      return JSON.stringify(arg);
    } catch {
      return "[Object]";
    }
  }
  
  return String(arg);
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

