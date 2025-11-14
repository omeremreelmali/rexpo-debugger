import React, { useMemo } from "react";
import { useNetwork } from "../state/NetworkContext";
import { RequestState } from "../types";
import "./NetworkTable.css";

export function NetworkTable() {
  const { state, dispatch } = useNetwork();

  const filteredRequests = useMemo(() => {
    let filtered = state.requests;

    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter((r) => r.url.toLowerCase().includes(query));
    }

    // Filter by method
    if (state.filterMethod !== "ALL") {
      filtered = filtered.filter((r) => r.method === state.filterMethod);
    }

    // Filter by status
    if (state.filterStatus !== "ALL") {
      filtered = filtered.filter((r) => {
        if (state.filterStatus === "ERR") {
          return r.isError || !r.status;
        }
        if (!r.status) return false;
        const statusStr = Math.floor(r.status / 100);
        return state.filterStatus.startsWith(statusStr.toString());
      });
    }

    return filtered;
  }, [state.requests, state.searchQuery, state.filterMethod, state.filterStatus]);

  const getStatusClass = (request: RequestState): string => {
    if (request.isError || !request.status) return "status-error";
    if (request.status >= 200 && request.status < 300) return "status-success";
    if (request.status >= 300 && request.status < 400) return "status-redirect";
    if (request.status >= 400 && request.status < 500) return "status-client-error";
    if (request.status >= 500) return "status-server-error";
    return "";
  };

  const formatDuration = (ms?: number): string => {
    if (ms === undefined) return "-";
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("en-US", { hour12: false });
    } catch {
      return "-";
    }
  };

  const truncateUrl = (url: string, maxLength: number = 80): string => {
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength) + "...";
  };

  return (
    <div className="network-table-container">
      {filteredRequests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📡</div>
          <p>No network requests yet</p>
          <p className="empty-state-hint">
            Requests from your Expo app will appear here
          </p>
        </div>
      ) : (
        <table className="network-table">
          <thead>
            <tr>
              <th style={{ width: "80px" }}>Method</th>
              <th style={{ width: "80px" }}>Status</th>
              <th style={{ flex: 1 }}>URL</th>
              <th style={{ width: "100px" }}>Duration</th>
              <th style={{ width: "100px" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((request) => (
              <tr
                key={request.id}
                className={`network-row ${
                  state.selectedRequestId === request.id ? "selected" : ""
                }`}
                onClick={() => dispatch({ type: "SELECT_REQUEST", payload: request.id })}
              >
                <td>
                  <span className={`method-badge method-${request.method.toLowerCase()}`}>
                    {request.method}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${getStatusClass(request)}`}>
                    {request.isError
                      ? "ERR"
                      : request.status
                      ? request.status
                      : "..."}
                  </span>
                </td>
                <td className="url-cell" title={request.url}>
                  {truncateUrl(request.url)}
                </td>
                <td>{formatDuration(request.durationMs)}</td>
                <td>{formatTime(request.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

