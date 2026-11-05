import { useEffect, useState } from "react";
import { useCollections } from "../state/CollectionsContext";
import { TabType, useNetwork } from "../state/NetworkContext";
import { useStores } from "../state/StateContext";
import { ConnectionChip } from "./ConnectionChip";
import { BrandMark, Icon, IconName } from "./Icons";
import { SettingsModal } from "./SettingsModal";
import { TabIndicator } from "./TabIndicator";
import "./TopBar.css";

const TABS: { id: TabType; label: string; icon: IconName }[] = [
  { id: "network", label: "Network", icon: "signal" },
  { id: "console", label: "Console", icon: "terminal" },
  { id: "collections", label: "Collections", icon: "stack" },
  { id: "state", label: "State", icon: "nodes" },
];

const IS_MAC = /mac/i.test(navigator.platform);

export function TopBar() {
  const { state, dispatch } = useNetwork();
  const { state: collections } = useCollections();
  const { stores } = useStores();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const counts: Record<TabType, number> = {
    network: state.requests.length,
    console: state.consoleLogs.length,
    collections: collections.savedRequests.length,
    state: stores.length,
  };

  // Cmd/Ctrl + 1…4 jumps between tabs.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const tab = TABS[Number(e.key) - 1];
      if (!tab) return;
      e.preventDefault();
      dispatch({ type: "SET_ACTIVE_TAB", payload: tab.id });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  return (
    <>
      <header className={`top-bar ${IS_MAC ? "top-bar-mac" : ""}`}>
        <div className="brand">
          <BrandMark />
          <span className="brand-name">
            rexpo<span className="brand-slash">//</span>
            <span className="brand-sub">debugger</span>
          </span>
        </div>

        <nav className="tab-navigation" aria-label="Panels">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              className={`tab-button ${state.activeTab === tab.id ? "active" : ""}`}
              onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: tab.id })}
              title={`${tab.label} (${IS_MAC ? "⌘" : "Ctrl+"}${index + 1})`}
              type="button"
            >
              <Icon name={tab.icon} />
              {tab.label}
              {counts[tab.id] > 0 && (
                <span key={counts[tab.id]} className="tab-count">
                  {counts[tab.id]}
                </span>
              )}
            </button>
          ))}
          <TabIndicator watch={state.activeTab} />
        </nav>

        <div className="top-bar-right">
          <ConnectionChip />
          <button
            className="settings-button"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            type="button"
            aria-label="Open settings"
          >
            <Icon name="gear" />
          </button>
        </div>
      </header>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
