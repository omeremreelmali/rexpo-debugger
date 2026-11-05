import { useEffect, useMemo, useState } from "react";
import { useCollections } from "../state/CollectionsContext";
import { useNetwork } from "../state/NetworkContext";
import { useStores } from "../state/StateContext";
import "./StatusLine.css";

const SPARK_BUCKETS = 36;
const SPARK_BUCKET_MS = 5000;
const SPARK_GLYPHS = "▁▂▃▄▅▆▇█";

/** Event rate over the last few minutes as a row of block glyphs. */
function sparkline(timestamps: string[], now: number): string {
  const buckets = new Array<number>(SPARK_BUCKETS).fill(0);
  for (const timestamp of timestamps) {
    const age = now - Date.parse(timestamp);
    const index = SPARK_BUCKETS - 1 - Math.floor(age / SPARK_BUCKET_MS);
    if (age >= 0 && index >= 0) buckets[index] += 1;
  }
  const peak = Math.max(...buckets, 1);
  return buckets
    .map((count) => SPARK_GLYPHS[Math.ceil((count / peak) * (SPARK_GLYPHS.length - 1))])
    .join("");
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

type Stat = { label: string; value: string | number; tone?: "error" | "warn" };

function Stats({ items }: { items: Stat[] }) {
  return (
    <>
      {items.map((item) => (
        <span key={item.label} className={`status-stat ${item.tone ? `tone-${item.tone}` : ""}`}>
          <span className="status-stat-label">{item.label}</span>
          <span key={item.value} className="status-stat-value">
            {item.value}
          </span>
        </span>
      ))}
    </>
  );
}

export function StatusLine() {
  const { state } = useNetwork();
  const { state: collections, collectionNames } = useCollections();
  const { stores } = useStores();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const tab = state.activeTab;

  const networkStats = useMemo<Stat[]>(() => {
    const requests = state.requests;
    const failed = requests.filter((r) => r.isError || (r.status ?? 0) >= 400).length;
    const pending = requests.filter((r) => !r.isError && !r.status).length;
    const durations = requests
      .map((r) => r.durationMs)
      .filter((ms): ms is number => ms !== undefined)
      .sort((a, b) => a - b);
    const stats: Stat[] = [
      { label: "req", value: requests.length },
      { label: "err", value: failed, tone: failed > 0 ? "error" : undefined },
      { label: "pend", value: pending, tone: pending > 0 ? "warn" : undefined },
    ];
    if (durations.length > 0) {
      const avg = durations.reduce((sum, ms) => sum + ms, 0) / durations.length;
      const p95 = durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))];
      stats.push({ label: "avg", value: formatMs(avg) }, { label: "p95", value: formatMs(p95) });
    }
    return stats;
  }, [state.requests]);

  const consoleStats = useMemo<Stat[]>(() => {
    const count = (level: string) => state.consoleLogs.filter((l) => l.level === level).length;
    const errors = count("error");
    const warnings = count("warn");
    return [
      { label: "logs", value: state.consoleLogs.length },
      { label: "err", value: errors, tone: errors > 0 ? "error" : undefined },
      { label: "warn", value: warnings, tone: warnings > 0 ? "warn" : undefined },
      { label: "info", value: count("info") },
    ];
  }, [state.consoleLogs]);

  const stats: Stat[] =
    tab === "network"
      ? networkStats
      : tab === "console"
      ? consoleStats
      : tab === "collections"
      ? [
          { label: "saved", value: collections.savedRequests.length },
          { label: "groups", value: collectionNames.length },
        ]
      : [
          { label: "stores", value: stores.length },
          { label: "snapshots", value: stores.reduce((sum, s) => sum + s.history.length, 0) },
        ];

  const spark =
    tab === "console"
      ? sparkline(state.consoleLogs.map((l) => l.timestamp), now)
      : sparkline(state.requests.map((r) => r.startedAt), now);

  return (
    <footer className={`status-line ${state.isPaused ? "is-paused" : ""}`}>
      <span key={tab} className="status-mode">
        {tab}
      </span>
      <span className="status-capture">
        <span className="status-capture-dot" />
        {state.isPaused ? "paused" : "capture"}
      </span>
      <Stats items={stats} />

      <div className="status-line-right">
        {(tab === "network" || tab === "console") && (
          <span
            className="status-spark"
            title={`${tab === "network" ? "Requests" : "Logs"} per ${
              SPARK_BUCKET_MS / 1000
            }s, last ${(SPARK_BUCKETS * SPARK_BUCKET_MS) / 60000} min`}
          >
            {spark}
          </span>
        )}
        <span className="status-clock">
          {new Date(now).toLocaleTimeString("en-GB", { hour12: false })}
        </span>
      </div>
    </footer>
  );
}
