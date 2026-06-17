import { useMemo, useState } from "react";
import {
  defaultRequestLabel,
  SavedRequest,
  UNCATEGORIZED_BUCKET,
  useCollections,
} from "../state/CollectionsContext";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { EditReplayModal } from "./EditReplayModal";
import { SaveRequestModal } from "./SaveRequestModal";
import { useToast } from "./Toast";
import { copyToClipboard, generateCurlCommand } from "../utils/curlGenerator";
import { replayRequest } from "../utils/replayRequest";
import { RequestState } from "../types";
import "./CollectionsPanel.css";

type ContextState = { request: SavedRequest; x: number; y: number };

/**
 * Saved-request collections panel — the third tab next to Network and
 * Console. Left: collapsible tree grouped by collection name. Right:
 * details + actions for the selected saved request.
 */
export function CollectionsPanel() {
  const {
    state,
    collectionNames,
    deleteRequest,
    moveRequest,
    createCollection,
    renameCollection,
    deleteCollection,
  } = useCollections();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextState | null>(null);
  const [groupMenu, setGroupMenu] = useState<{
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const [editingRequest, setEditingRequest] = useState<SavedRequest | null>(null);
  const [editAndReplayTarget, setEditAndReplayTarget] = useState<SavedRequest | null>(null);
  const [moveDialog, setMoveDialog] = useState<SavedRequest | null>(null);
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);

  // Group requests by collection name (Uncategorized for unnamed). First-class
  // collections with no requests still appear as empty buckets; only the empty
  // Uncategorized bucket is hidden.
  const grouped = useMemo(() => {
    const groups = new Map<string, SavedRequest[]>();
    // Seed every known collection so empty first-class buckets show up.
    for (const name of collectionNames) groups.set(name, []);
    for (const req of state.savedRequests) {
      const key = req.collectionName?.trim() || UNCATEGORIZED_BUCKET;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(req);
    }
    const ordered: { name: string; items: SavedRequest[] }[] = [];
    for (const name of collectionNames) {
      ordered.push({ name, items: groups.get(name) || [] });
    }
    // Catch any group not in collectionNames (shouldn't happen, defensive)
    for (const [name, items] of groups) {
      if (!ordered.some((g) => g.name === name)) ordered.push({ name, items });
    }
    // Hide the Uncategorized bucket when it holds nothing.
    return ordered.filter(
      (g) => g.name !== UNCATEGORIZED_BUCKET || g.items.length > 0
    );
  }, [state.savedRequests, collectionNames]);

  const selected = selectedId
    ? state.savedRequests.find((r) => r.id === selectedId) || null
    : null;

  const toggleCollapse = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  /** Convert a SavedRequest into a shape replayRequest() understands. */
  const toReplayShape = (req: SavedRequest): RequestState => ({
    id: req.id,
    url: req.url,
    method: req.method,
    requestHeaders: req.headers,
    requestBodySnippet: req.body,
    startedAt: req.createdAt,
  });

  const handleReplay = (req: SavedRequest) => {
    replayRequest(toReplayShape(req));
    toast.show("Replay sent", "success");
  };

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    toast.show(
      ok ? `${label} copied` : "Copy failed",
      ok ? "success" : "error"
    );
  };

  const handleDelete = (req: SavedRequest) => {
    deleteRequest(req.id);
    if (selectedId === req.id) setSelectedId(null);
    toast.show("Saved request silindi", "info");
  };

  const buildContextMenu = (req: SavedRequest): ContextMenuItem[] => [
    {
      id: "replay",
      icon: "🔁",
      label: "Replay",
      onClick: () => handleReplay(req),
    },
    {
      id: "edit-replay",
      icon: "✏️",
      label: "Edit & Replay…",
      onClick: () => setEditAndReplayTarget(req),
    },
    { id: "sep-1", label: "", separator: true },
    {
      id: "edit-meta",
      icon: "📝",
      label: "Rename / edit metadata…",
      onClick: () => setEditingRequest(req),
    },
    {
      id: "move",
      icon: "📂",
      label: "Move to another collection…",
      onClick: () => setMoveDialog(req),
    },
    {
      id: "copy-url",
      icon: "🔗",
      label: "Copy URL",
      onClick: () => void handleCopy(req.url, "URL"),
    },
    {
      id: "copy-curl",
      icon: "📋",
      label: "Copy as cURL",
      onClick: () =>
        void handleCopy(generateCurlCommand(toReplayShape(req)), "cURL komutu"),
    },
    { id: "sep-2", label: "", separator: true },
    {
      id: "delete",
      icon: "🗑",
      label: "Delete",
      destructive: true,
      onClick: () => handleDelete(req),
    },
  ];

  return (
    <div className="collections-panel">
      <div className="collections-left">
        <header className="collections-left-header">
          <h2>📚 Collections</h2>
          <div className="collections-left-header-actions">
            <span className="collections-left-count">
              {state.savedRequests.length} saved
            </span>
            <button
              className="collections-new-btn"
              onClick={() => setNewCollectionOpen(true)}
              title="Create a new collection"
              type="button"
            >
              + New
            </button>
          </div>
        </header>

        {grouped.length === 0 ? (
          <div className="collections-empty">
            <div className="collections-empty-icon">📚</div>
            <p>No saved requests yet.</p>
            <p className="collections-empty-hint">
              Right-click any request in the Network panel and choose{" "}
              <strong>Save request…</strong>, or click <strong>+ New</strong> to
              start a collection.
            </p>
          </div>
        ) : (
          <div className="collections-tree">
            {grouped.map((group) => {
              const isCollapsed = collapsed.has(group.name);
              return (
                <div key={group.name} className="collections-group">
                  <button
                    className="collections-group-header"
                    onClick={() => toggleCollapse(group.name)}
                    onContextMenu={(e) => {
                      if (group.name === UNCATEGORIZED_BUCKET) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setGroupMenu({
                        name: group.name,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    type="button"
                  >
                    <span className="collections-group-caret">
                      {isCollapsed ? "▸" : "▾"}
                    </span>
                    <span className="collections-group-icon">📁</span>
                    <span className="collections-group-name">{group.name}</span>
                    <span className="collections-group-count">
                      {group.items.length}
                    </span>
                  </button>

                  {!isCollapsed && group.items.length === 0 && (
                    <p className="collections-group-empty">
                      Empty — move or save a request here.
                    </p>
                  )}

                  {!isCollapsed && group.items.length > 0 && (
                    <ul className="collections-group-items">
                      {group.items.map((req) => (
                        <li
                          key={req.id}
                          className={`collections-item ${
                            selectedId === req.id ? "selected" : ""
                          }`}
                          onClick={() => setSelectedId(req.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedId(req.id);
                            setContextMenu({
                              request: req,
                              x: e.clientX,
                              y: e.clientY,
                            });
                          }}
                        >
                          <span
                            className={`collections-item-method method-${req.method.toLowerCase()}`}
                          >
                            {req.method.toUpperCase()}
                          </span>
                          <span className="collections-item-name">
                            {defaultRequestLabel(req)}
                          </span>
                          {req.tags && req.tags.length > 0 && (
                            <span className="collections-item-tags">
                              {req.tags.slice(0, 2).map((t) => (
                                <span key={t} className="collections-item-tag">
                                  {t}
                                </span>
                              ))}
                              {req.tags.length > 2 && (
                                <span className="collections-item-tag-more">
                                  +{req.tags.length - 2}
                                </span>
                              )}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="collections-right">
        {selected ? (
          <SavedRequestDetails
            request={selected}
            onReplay={() => handleReplay(selected)}
            onEditReplay={() => setEditAndReplayTarget(selected)}
            onEditMeta={() => setEditingRequest(selected)}
            onMove={() => setMoveDialog(selected)}
            onDelete={() => handleDelete(selected)}
            onCopyUrl={() => void handleCopy(selected.url, "URL")}
            onCopyCurl={() =>
              void handleCopy(
                generateCurlCommand(toReplayShape(selected)),
                "cURL komutu"
              )
            }
          />
        ) : (
          <div className="collections-no-selection">
            <div className="collections-no-selection-icon">👈</div>
            <p>Select a saved request from the left</p>
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          items={buildContextMenu(contextMenu.request)}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {editingRequest && (
        <SaveRequestModal
          source={editingRequest}
          editingId={editingRequest.id}
          onClose={() => setEditingRequest(null)}
        />
      )}

      {editAndReplayTarget && (
        <EditReplayModal
          request={toReplayShape(editAndReplayTarget)}
          savedRequestId={editAndReplayTarget.id}
          onClose={() => setEditAndReplayTarget(null)}
        />
      )}

      {groupMenu && (
        <ContextMenu
          items={[
            {
              id: "rename-collection",
              icon: "✏️",
              label: "Rename collection…",
              onClick: () => setRenameTarget(groupMenu.name),
            },
            {
              id: "delete-collection",
              icon: "🗑",
              label: "Delete collection",
              destructive: true,
              onClick: () => {
                deleteCollection(groupMenu.name);
                toast.show(
                  `"${groupMenu.name}" silindi — istekler Uncategorized'a taşındı`,
                  "info"
                );
              },
            },
          ]}
          position={{ x: groupMenu.x, y: groupMenu.y }}
          onClose={() => setGroupMenu(null)}
        />
      )}

      {newCollectionOpen && (
        <CollectionNameDialog
          title="New collection"
          confirmLabel="Create"
          existingNames={collectionNames}
          onCancel={() => setNewCollectionOpen(false)}
          onConfirm={(name) => {
            createCollection(name);
            toast.show(`Collection "${name}" oluşturuldu`, "success");
            setNewCollectionOpen(false);
          }}
        />
      )}

      {renameTarget && (
        <CollectionNameDialog
          title="Rename collection"
          confirmLabel="Rename"
          initialValue={renameTarget}
          existingNames={collectionNames.filter((n) => n !== renameTarget)}
          onCancel={() => setRenameTarget(null)}
          onConfirm={(name) => {
            renameCollection(renameTarget, name);
            toast.show(`Renamed to "${name}"`, "success");
            setRenameTarget(null);
          }}
        />
      )}

      {moveDialog && (
        <MoveCollectionDialog
          request={moveDialog}
          existingCollections={collectionNames}
          onCancel={() => setMoveDialog(null)}
          onMove={(newName) => {
            moveRequest(moveDialog.id, newName || undefined);
            toast.show(
              newName ? `Moved to ${newName}` : "Moved to Uncategorized",
              "success"
            );
            setMoveDialog(null);
          }}
        />
      )}
    </div>
  );
}

interface SavedRequestDetailsProps {
  request: SavedRequest;
  onReplay: () => void;
  onEditReplay: () => void;
  onEditMeta: () => void;
  onMove: () => void;
  onDelete: () => void;
  onCopyUrl: () => void;
  onCopyCurl: () => void;
}

function SavedRequestDetails({
  request,
  onReplay,
  onEditReplay,
  onEditMeta,
  onMove,
  onDelete,
  onCopyUrl,
  onCopyCurl,
}: SavedRequestDetailsProps) {
  return (
    <div className="saved-details">
      <header className="saved-details-header">
        <div className="saved-details-title-row">
          <span
            className={`collections-item-method method-${request.method.toLowerCase()}`}
          >
            {request.method.toUpperCase()}
          </span>
          <h2>{defaultRequestLabel(request)}</h2>
        </div>
        {request.description && (
          <p className="saved-details-description">{request.description}</p>
        )}
        {request.tags && request.tags.length > 0 && (
          <div className="saved-details-tags">
            {request.tags.map((t) => (
              <span key={t} className="collections-item-tag">
                {t}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="saved-details-actions">
        <button onClick={onReplay} className="saved-details-action primary" type="button">
          🔁 Replay
        </button>
        <button onClick={onEditReplay} className="saved-details-action" type="button">
          ✏️ Edit & Replay…
        </button>
        <button onClick={onEditMeta} className="saved-details-action" type="button">
          📝 Edit metadata
        </button>
        <button onClick={onMove} className="saved-details-action" type="button">
          📂 Move
        </button>
        <button onClick={onCopyUrl} className="saved-details-action" type="button">
          🔗 Copy URL
        </button>
        <button onClick={onCopyCurl} className="saved-details-action" type="button">
          📋 Copy as cURL
        </button>
        <button
          onClick={onDelete}
          className="saved-details-action destructive"
          type="button"
        >
          🗑 Delete
        </button>
      </div>

      <section className="saved-details-section">
        <h3>URL</h3>
        <code className="saved-details-url">{request.url}</code>
      </section>

      {request.headers && Object.keys(request.headers).length > 0 && (
        <section className="saved-details-section">
          <h3>Headers</h3>
          <div className="saved-details-headers">
            {Object.entries(request.headers).map(([k, v]) => (
              <div key={k} className="saved-details-header-row">
                <span className="saved-details-header-key">{k}</span>
                <span className="saved-details-header-value">{v}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {request.body && (
        <section className="saved-details-section">
          <h3>Body</h3>
          <pre className="saved-details-body">{request.body}</pre>
        </section>
      )}

      <section className="saved-details-section saved-details-meta">
        <h3>Metadata</h3>
        <div className="saved-details-meta-row">
          <span>Collection</span>
          <span>{request.collectionName || UNCATEGORIZED_BUCKET}</span>
        </div>
        <div className="saved-details-meta-row">
          <span>Created</span>
          <span>{new Date(request.createdAt).toLocaleString()}</span>
        </div>
        {request.updatedAt && (
          <div className="saved-details-meta-row">
            <span>Updated</span>
            <span>{new Date(request.updatedAt).toLocaleString()}</span>
          </div>
        )}
      </section>
    </div>
  );
}

interface MoveCollectionDialogProps {
  request: SavedRequest;
  existingCollections: string[];
  onCancel: () => void;
  onMove: (newCollection: string) => void;
}

function MoveCollectionDialog({
  request,
  existingCollections,
  onCancel,
  onMove,
}: MoveCollectionDialogProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [existing, setExisting] = useState<string>(
    request.collectionName && existingCollections.includes(request.collectionName)
      ? request.collectionName
      : ""
  );
  const [newName, setNewName] = useState("");

  return (
    <div className="save-request-backdrop" onClick={onCancel}>
      <div
        className="save-request-modal"
        style={{ width: "min(420px, 92vw)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="save-request-header">
          <h2>Move request</h2>
          <button
            className="save-request-close"
            onClick={onCancel}
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="save-request-body">
          <fieldset className="save-request-field save-request-collection">
            <legend className="save-request-label">Target collection</legend>
            <div className="save-request-collection-tabs">
              <button
                type="button"
                className={`save-request-collection-tab ${
                  mode === "existing" ? "active" : ""
                }`}
                onClick={() => setMode("existing")}
              >
                Existing
              </button>
              <button
                type="button"
                className={`save-request-collection-tab ${
                  mode === "new" ? "active" : ""
                }`}
                onClick={() => setMode("new")}
              >
                + New
              </button>
            </div>
            {mode === "existing" ? (
              <select value={existing} onChange={(e) => setExisting(e.target.value)}>
                <option value="">(Uncategorized)</option>
                {existingCollections
                  .filter((n) => n !== UNCATEGORIZED_BUCKET)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Collection name"
                autoFocus
              />
            )}
          </fieldset>
        </div>
        <footer className="save-request-footer">
          <span className="save-request-hint">
            from <strong>{request.collectionName || UNCATEGORIZED_BUCKET}</strong>
          </span>
          <div className="save-request-footer-actions">
            <button className="save-request-cancel" onClick={onCancel} type="button">
              Cancel
            </button>
            <button
              className="save-request-confirm"
              onClick={() => onMove(mode === "new" ? newName.trim() : existing.trim())}
              type="button"
            >
              Move
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

interface CollectionNameDialogProps {
  title: string;
  confirmLabel: string;
  initialValue?: string;
  existingNames: string[];
  onCancel: () => void;
  onConfirm: (name: string) => void;
}

/** Small single-field dialog for creating or renaming a collection. */
function CollectionNameDialog({
  title,
  confirmLabel,
  initialValue = "",
  existingNames,
  onCancel,
  onConfirm,
}: CollectionNameDialogProps) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  const isDuplicate = existingNames.some(
    (n) => n.toLowerCase() === trimmed.toLowerCase()
  );
  const canConfirm = trimmed.length > 0 && !isDuplicate;

  const submit = () => {
    if (canConfirm) onConfirm(trimmed);
  };

  return (
    <div className="save-request-backdrop" onClick={onCancel}>
      <div
        className="save-request-modal"
        style={{ width: "min(420px, 92vw)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="save-request-header">
          <h2>{title}</h2>
          <button
            className="save-request-close"
            onClick={onCancel}
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="save-request-body">
          <label className="save-request-field">
            <span className="save-request-label">Collection name</span>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") onCancel();
              }}
              placeholder="e.g. Auth flows"
              autoFocus
            />
            {isDuplicate && (
              <span className="save-request-optional" style={{ color: "#e06c75" }}>
                A collection with this name already exists.
              </span>
            )}
          </label>
        </div>
        <footer className="save-request-footer">
          <span className="save-request-hint" />
          <div className="save-request-footer-actions">
            <button className="save-request-cancel" onClick={onCancel} type="button">
              Cancel
            </button>
            <button
              className="save-request-confirm"
              onClick={submit}
              type="button"
              disabled={!canConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
