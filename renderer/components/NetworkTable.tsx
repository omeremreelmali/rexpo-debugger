import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useNetwork } from "../state/NetworkContext";
import { useSettings } from "../state/SettingsContext";
import { RequestState } from "../types";
import { copyToClipboard, generateCurlCommand } from "../utils/curlGenerator";
import { replayRequest } from "../utils/replayRequest";
import { saveResponseToFile } from "../utils/saveResponse";
import { getStatusClass } from "../utils/requestStatus";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { EditReplayModal } from "./EditReplayModal";
import { SaveRequestModal } from "./SaveRequestModal";
import { useToast } from "./Toast";
import { HudEmpty } from "./HudEmpty";
import { Icon } from "./Icons";
import { UrlText } from "./UrlText";
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
  const [saveTarget, setSaveTarget] = useState<RequestState | null>(null);
  const mountedAt = useRef(Date.now());

  const copyWithToast = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    toast.show(ok ? `${label} copied` : "Copy failed", ok ? "success" : "error");
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

  const maxDuration = useMemo(
    () => Math.max(1, ...filteredRequests.map((r) => r.durationMs ?? 0)),
    [filteredRequests]
  );

  const getRowClass = (request: RequestState): string => {
    if (request.isError || (request.status ?? 0) >= 500) return "row-error";
    if ((request.status ?? 0) >= 400) return "row-warn";
    return "";
  };

  const getDurationClass = (ms: number): string => {
    if (ms >= 1000) return "very-slow";
    if (ms >= 300) return "slow";
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
        icon: <Icon name="link" />,
        label: "Copy URL",
        onClick: () => void copyWithToast(request.url, "URL"),
      },
      {
        id: "copy-curl",
        icon: <Icon name="code" />,
        label: "Copy as cURL",
        onClick: () =>
          void copyWithToast(generateCurlCommand(request), "cURL komutu"),
      },
      {
        id: "copy-json",
        icon: <Icon name="braces" />,
        label: "Copy as JSON",
        onClick: () =>
          void copyWithToast(JSON.stringify(request, null, 2), "Request JSON"),
      },
      {
        id: "save-response",
        icon: <Icon name="download" />,
        label: "Save response…",
        disabled: !hasResponseBody,
        onClick: async () => {
          const result = await saveResponseToFile(request);
          if (result.cancelled) return;
          if (result.ok) {
            toast.show(`Response saved: ${result.fileName ?? ""}`, "success");
          } else {
            toast.show(result.error || "Failed to save", "error");
          }
        },
      },
      { id: "sep-1", label: "", separator: true },
      {
        id: "replay",
        icon: <Icon name="replay" />,
        label: "Replay",
        onClick: () => {
          replayRequest(request);
          toast.show("Replay sent", "success");
        },
      },
      {
        id: "edit-replay",
        icon: <Icon name="edit" />,
        label: "Edit & Replay…",
        onClick: () => setEditTarget(request),
      },
      {
        id: "save-request",
        icon: <Icon name="stack" />,
        label: "Save to collection…",
        onClick: () => setSaveTarget(request),
      },
      { id: "sep-2", label: "", separator: true },
      {
        id: "delete",
        icon: <Icon name="trash" />,
        label: "Delete request",
        destructive: true,
        onClick: () => dispatch({ type: "DELETE_REQUEST", payload: request.id }),
      },
      {
        id: "clear-all",
        icon: <Icon name="sweep" />,
        label: "Clear all requests",
        destructive: true,
        onClick: () => dispatch({ type: "CLEAR_NETWORK" }),
      },
    ];
  };

  return (
    <div className="network-table-container">
      {!settings.agents.networkEnabled ? (
        <HudEmpty
          error
          title="Network agent disabled"
          hint="Settings → Agents → Network agent enabled"
        />
      ) : filteredRequests.length === 0 ? (
        <HudEmpty
          radar={state.requests.length === 0}
          title={state.requests.length === 0 ? "Awaiting signal" : "No requests match the filter"}
          hint={
            state.requests.length === 0
              ? "Requests from your Expo app will appear here."
              : "Loosen the search, method or status filter."
          }
        />
      ) : (
        <div className="network-table-scope">
          <table className="network-table">
            <thead>
              <tr>
                <th className="col-method">Method</th>
                <th className="col-status">Status</th>
                <th>URL</th>
                <th className="col-duration">Duration</th>
                <th className="col-time">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request, index) => (
                <tr
                  key={request.id}
                  style={{ "--i": index } as CSSProperties}
                  className={`network-row ${getRowClass(request)} ${
                    state.selectedRequestId === request.id ? "selected" : ""
                  } ${Date.parse(request.startedAt) > mountedAt.current ? "is-fresh" : ""}`}
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
                        : "···"}
                    </span>
                  </td>
                  <td className="url-cell" title={request.url}>
                    <UrlText url={request.url} />
                  </td>
                  <td className="col-duration dur-cell">
                    {formatDuration(request.durationMs)}
                    {request.durationMs === undefined && !request.isError && !request.status && (
                      <span className="dur-track is-pending" />
                    )}
                    {request.durationMs !== undefined && (
                      <span className="dur-track">
                        <span
                          className={`dur-fill ${getDurationClass(request.durationMs)}`}
                          style={{ width: `${Math.sqrt(request.durationMs / maxDuration) * 100}%` }}
                        />
                      </span>
                    )}
                  </td>
                  <td className="col-time">{formatTime(request.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {saveTarget && (
        <SaveRequestModal
          source={saveTarget}
          onClose={() => setSaveTarget(null)}
        />
      )}
    </div>
  );
}
