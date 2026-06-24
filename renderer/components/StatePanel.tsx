import { useState } from "react";
import { StoreSnapshot, useStores } from "../state/StateContext";
import "./StatePanel.css";

/**
 * State Inspector tab — left: list of tracked stores; right: a collapsible,
 * searchable JSON tree of the selected store's latest snapshot. View-only.
 */
export function StatePanel() {
  const { stores, clear } = useStores();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const selected =
    (selectedId && stores.find((s) => s.storeId === selectedId)) ||
    stores[0] ||
    null;

  return (
    <div className="state-panel">
      <div className="state-left">
        <header className="state-left-header">
          <h2>🧩 State</h2>
          {stores.length > 0 && (
            <button
              className="state-clear-btn"
              onClick={clear}
              type="button"
              title="Clear the store list"
            >
              Clear
            </button>
          )}
        </header>

        {stores.length === 0 ? (
          <div className="state-empty">
            <div className="state-empty-icon">🧩</div>
            <p>No stores connected.</p>
            <p className="state-empty-hint">
              In your app, call <code>initStateAgent()</code> then{" "}
              <code>attachZustandStore(useStore)</code> or{" "}
              <code>attachReduxStore(store)</code>.
            </p>
          </div>
        ) : (
          <ul className="state-store-list">
            {stores.map((s) => (
              <li
                key={s.storeId}
                className={`state-store-item ${
                  selected?.storeId === s.storeId ? "selected" : ""
                }`}
                onClick={() => setSelectedId(s.storeId)}
              >
                <span className={`state-lib-badge lib-${s.lib}`}>{s.lib}</span>
                <span className="state-store-name">{s.name}</span>
                {s.canSet && (
                  <span className="state-canset" title="Writable (editing coming soon)">
                    ✎
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="state-right">
        {selected ? (
          <StoreDetails store={selected} query={query} onQuery={setQuery} />
        ) : (
          <div className="state-no-selection">
            <div className="state-no-selection-icon">👈</div>
            <p>Select a store</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StoreDetails({
  store,
  query,
  onQuery,
}: {
  store: StoreSnapshot;
  query: string;
  onQuery: (q: string) => void;
}) {
  const q = query.trim().toLowerCase();
  return (
    <div className="store-details">
      <header className="store-details-header">
        <div className="store-details-title">
          <span className={`state-lib-badge lib-${store.lib}`}>{store.lib}</span>
          <h2>{store.name}</h2>
        </div>
        <span className="store-details-updated">
          updated {new Date(store.at).toLocaleTimeString()}
        </span>
      </header>

      <div className="store-search-row">
        <input
          className="store-search"
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter keys / values…"
          spellCheck={false}
        />
        {query && (
          <button className="store-search-clear" onClick={() => onQuery("")} type="button">
            ✕
          </button>
        )}
      </div>

      <div className="json-tree">
        <JsonNode keyLabel={null} value={store.state} depth={0} query={q} />
      </div>
    </div>
  );
}

// ─── JSON tree ───────────────────────────────────────────────────────────────

type Classified =
  | { kind: "leaf"; text: string; cls: string }
  | {
      kind: "container";
      open: string;
      close: string;
      entries: [string, any][];
      summary: string;
    };

function isMarker(v: any): v is { __rexpo: string; [k: string]: any } {
  return v !== null && typeof v === "object" && typeof v.__rexpo === "string";
}

function classify(value: any): Classified {
  if (value === null) return { kind: "leaf", text: "null", cls: "j-null" };
  const t = typeof value;
  if (t === "string") return { kind: "leaf", text: `"${value}"`, cls: "j-string" };
  if (t === "number") return { kind: "leaf", text: String(value), cls: "j-number" };
  if (t === "boolean") return { kind: "leaf", text: String(value), cls: "j-boolean" };

  if (isMarker(value)) {
    switch (value.__rexpo) {
      case "function":
        return { kind: "leaf", text: `ƒ ${value.name}()`, cls: "j-marker" };
      case "circular":
        return { kind: "leaf", text: "[Circular]", cls: "j-marker" };
      case "truncated":
        return {
          kind: "leaf",
          text: value.more ? `… (+${value.more} more)` : "…",
          cls: "j-marker",
        };
      case "undefined":
        return { kind: "leaf", text: "undefined", cls: "j-marker" };
      case "bigint":
        return { kind: "leaf", text: `${value.value}n`, cls: "j-number" };
      case "symbol":
        return { kind: "leaf", text: value.value, cls: "j-marker" };
      case "date":
        return { kind: "leaf", text: value.value, cls: "j-special" };
      case "regexp":
        return { kind: "leaf", text: value.value, cls: "j-special" };
      case "error":
        return { kind: "leaf", text: `${value.name}: ${value.message}`, cls: "j-error" };
      case "unserializable":
        return { kind: "leaf", text: "[Unserializable]", cls: "j-marker" };
      case "map": {
        const entries = Object.entries(value.entries ?? {});
        return {
          kind: "container",
          open: "Map {",
          close: "}",
          entries,
          summary: `${entries.length}`,
        };
      }
      case "set": {
        const entries = (value.values ?? []).map(
          (v: any, i: number) => [String(i), v] as [string, any]
        );
        return {
          kind: "container",
          open: "Set [",
          close: "]",
          entries,
          summary: `${entries.length}`,
        };
      }
      default:
        return { kind: "leaf", text: String(value.__rexpo), cls: "j-marker" };
    }
  }

  if (Array.isArray(value)) {
    return {
      kind: "container",
      open: "[",
      close: "]",
      entries: value.map((v, i) => [String(i), v] as [string, any]),
      summary: `${value.length}`,
    };
  }

  if (t === "object") {
    const entries = Object.entries(value);
    return { kind: "container", open: "{", close: "}", entries, summary: `${entries.length}` };
  }

  return { kind: "leaf", text: String(value), cls: "j-marker" };
}

/** Whether a node (or any descendant) matches the search query. */
function subtreeMatches(keyLabel: string | null, value: any, q: string): boolean {
  if (!q) return true;
  if (keyLabel && keyLabel.toLowerCase().includes(q)) return true;
  const node = classify(value);
  if (node.kind === "leaf") return node.text.toLowerCase().includes(q);
  return node.entries.some(([k, v]) => subtreeMatches(k, v, q));
}

function JsonNode({
  keyLabel,
  value,
  depth,
  query,
}: {
  keyLabel: string | null;
  value: any;
  depth: number;
  query: string;
}) {
  const node = classify(value);
  // Auto-expand top levels; when searching, expand everything on the path.
  const [open, setOpen] = useState(depth < 2);
  const expanded = query ? true : open;

  if (query && !subtreeMatches(keyLabel, value, query)) return null;

  if (node.kind === "leaf") {
    return (
      <div className="json-row" style={{ paddingLeft: depth * 14 }}>
        {keyLabel !== null && <span className="json-key">{keyLabel}:</span>}
        <span className={`json-leaf ${node.cls}`}>{node.text}</span>
      </div>
    );
  }

  const visibleEntries = query
    ? node.entries.filter(([k, v]) => subtreeMatches(k, v, query))
    : node.entries;

  return (
    <div className="json-branch">
      <div
        className="json-row json-row-toggle"
        style={{ paddingLeft: depth * 14 }}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="json-caret">{expanded ? "▾" : "▸"}</span>
        {keyLabel !== null && <span className="json-key">{keyLabel}:</span>}
        <span className="json-bracket">
          {node.open}
          {!expanded && (
            <span className="json-collapsed-summary">
              {node.summary}
              {node.close}
            </span>
          )}
        </span>
      </div>
      {expanded && (
        <div className="json-children">
          {visibleEntries.length === 0 ? (
            <div className="json-row json-empty" style={{ paddingLeft: (depth + 1) * 14 }}>
              (empty)
            </div>
          ) : (
            visibleEntries.map(([k, v]) => (
              <JsonNode key={k} keyLabel={k} value={v} depth={depth + 1} query={query} />
            ))
          )}
          <div className="json-row" style={{ paddingLeft: depth * 14 }}>
            <span className="json-bracket">{node.close}</span>
          </div>
        </div>
      )}
    </div>
  );
}
