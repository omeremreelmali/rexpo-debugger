import { ReactNode } from "react";
import { DecodeText } from "./DecodeText";

/** Shared empty / idle state: a blinking prompt line, optionally over a radar. */
export function HudEmpty({
  title,
  hint,
  radar = false,
  error = false,
}: {
  title: string;
  hint?: ReactNode;
  radar?: boolean;
  error?: boolean;
}) {
  return (
    <div className={`hud-empty ${error ? "is-error" : ""}`}>
      {radar && (
        <div className="hud-radar" aria-hidden="true">
          <span className="hud-radar-sweep" />
          <span className="hud-radar-blip" />
          <span className="hud-radar-blip" />
        </div>
      )}
      <p className="hud-empty-title">
        <DecodeText text={title} />
      </p>
      {hint && <p className="hud-empty-hint">{hint}</p>}
    </div>
  );
}
