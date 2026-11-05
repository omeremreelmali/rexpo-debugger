import { Component, ReactNode } from "react";
import { HudEmpty } from "./HudEmpty";

/** Keeps a render bug from blanking the whole window, and offers a way back. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-container">
        <HudEmpty error title="Something went wrong" hint={this.state.error.message} />
        <button
          className="hud-btn"
          style={{ alignSelf: "center", marginBottom: 32 }}
          onClick={() => window.location.reload()}
          type="button"
        >
          Reload
        </button>
      </div>
    );
  }
}
