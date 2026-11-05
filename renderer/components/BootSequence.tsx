import { useEffect, useState } from "react";
import { version } from "../../package.json";
import { useSettings } from "../state/SettingsContext";
import { DecodeText } from "./DecodeText";
import { BrandMark } from "./Icons";

const SESSION_KEY = "rexpo-debugger-booted";
const LINE_DELAY_MS = 130;
const HOLD_MS = 320;
const FADE_MS = 220;

function shouldBoot(effects: boolean): boolean {
  if (!effects) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    return !sessionStorage.getItem(SESSION_KEY);
  } catch {
    return false;
  }
}

/**
 * One-shot boot log, shown once per app launch. The listener line reports the
 * real port and interface count. Click or press any key to skip; turn it off
 * with Settings → Appearance → Effects & animations.
 */
export function BootSequence() {
  const { settings } = useSettings();
  const [phase, setPhase] = useState<"running" | "leaving" | "done">(() =>
    shouldBoot(settings.ui.effects) ? "running" : "done"
  );
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (phase !== "running") return;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Storage unavailable: the boot log just plays again next time.
    }

    let cancelled = false;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    const run = async () => {
      const info = await window.electron?.getConnectionInfo?.().catch(() => null);
      if (cancelled) return;
      const log = [
        "network probe mounted",
        "console tap mounted",
        "state inspector mounted",
        info
          ? `ws listener on :${info.port} (${info.interfaces.length} iface)`
          : "ws listener unavailable",
      ];
      log.forEach((line, i) => after(LINE_DELAY_MS * (i + 1), () => setLines((l) => [...l, line])));
      after(LINE_DELAY_MS * log.length + HOLD_MS, () => setPhase("leaving"));
    };
    void run();

    const skip = () => setPhase("leaving");
    window.addEventListener("keydown", skip);
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("keydown", skip);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const id = window.setTimeout(() => setPhase("done"), FADE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      className={`boot-screen ${phase === "leaving" ? "is-leaving" : ""}`}
      onClick={() => setPhase("leaving")}
      aria-hidden="true"
    >
      <div className="boot-log">
        <div className="boot-title">
          <span className="boot-mark">
            <BrandMark size={20} />
          </span>
          <DecodeText text="rexpo//debugger" />
          <small>v{version}</small>
        </div>
        {lines.map((line) => (
          <div key={line} className="boot-line">
            <span className="boot-line-ok">[ ok ]</span>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
