import { useMemo, useState } from "react";
import { useNetwork } from "../state/NetworkContext";
import { useSettings } from "../state/SettingsContext";
import { RequestState } from "../types";
import { copyToClipboard, generateCurlCommand } from "../utils/curlGenerator";
import { replayRequest } from "../utils/replayRequest";
import { saveResponseToFile } from "../utils/saveResponse";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { EditReplayModal } from "./EditReplayModal";
import { useToast } from "./Toast";
import "./NetworkTable.css";

interface ContextMenuState {
  request: RequestState;
  x: number;
  y: number;
}

export function NetworkTable() {
  const { state, dispatch } = useNetwork();
  const { settings } = useSettings();
  const toast = useToast();
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [editTarget, setEditTarget] = useState<RequestState | null>(null);

  const copyWithToast = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    toast.show(ok ? `${label} kopyalandı` : `Kopyalama başarısız`, ok ? "success" : "error");
  };

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

  const handleContextMenu = (e: React.MouseEvent, request: RequestState) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ request, x: e.clientX, y: e.clientY });
  };

  const closeMenu = () => setMenu(null);

  const buildMenuItems = (request: RequestState): ContextMenuItem[] => {
    const hasResponseBody = Boolean(request.responseBodySnippet);
    return [
      {
        id: "copy-url",
        icon: "🔗",
        label: "Copy URL",
        onClick: () => void copyWithToast(request.url, "URL"),
      },
      {
        id: "copy-curl",
        icon: "📋",
        label: "Copy as cURL",
        onClick: () =>
          void copyWithToast(generateCurlCommand(request), "cURL komutu"),
      },
      {
        id: "copy-json",
        icon: "🧾",
        label: "Copy as JSON",
        onClick: () =>
          void copyWithToast(JSON.stringify(request, null, 2), "Request JSON"),
      },
      {
        id: "save-response",
        icon: "💾",
        label: "Save response…",
        disabled: !hasResponseBody,
        onClick: async () => {
          const result = await saveResponseToFile(request);
          if (result.cancelled) return;
          if (result.ok) {
            toast.show(`Response kaydedildi: ${result.fileName ?? ""}`, "success");
          } else {
            toast.show(result.error || "Kaydetme başarısız", "error");
          }
        },
      },
      { id: "sep-1", label: "", separator: true },
      {
        id: "replay",
        icon: "🔁",
        label: "Replay",
        onClick: () => {
          replayRequest(request);
          toast.show("Replay gönderildi", "success");
        },
      },
      {
        id: "edit-replay",
        icon: "✏️",
        label: "Edit & Replay…",
        onClick: () => setEditTarget(request),
      },
      { id: "sep-2", label: "", separator: true },
      {
        id: "delete",
        icon: "🗑",
        label: "Delete request",
        destructive: true,
        onClick: () => dispatch({ type: "DELETE_REQUEST", payload: request.id }),
      },
      {
        id: "clear-all",
        icon: "🧹",
        label: "Clear all requests",
        destructive: true,
        onClick: () => dispatch({ type: "CLEAR_NETWORK" }),
      },
    ];
  };

  return (
    <div className="network-table-container">
      {!settings.agents.networkEnabled ? (
        <div className="empty-state">
          <div className="empty-state-icon">🚫</div>
          <p>Network agent disabled</p>
          <p className="empty-state-hint">
            Settings → Agents → Network agent enabled
          </p>
        </div>
      ) : filteredRequests.length === 0 ? (
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
                onContextMenu={(e) => handleContextMenu(e, request)}
              >
                <td>
                  <span className={`method-badge method-${request.method.toLowerCase()}`}>
                    {request.method === "OPTIONS" ? "Preflight" : request.method}
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

      {menu && (
        <ContextMenu
          items={buildMenuItems(menu.request)}
          position={{ x: menu.x, y: menu.y }}
          onClose={closeMenu}
        />
      )}

      {editTarget && (
        <EditReplayModal
          request={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
