import { useEffect, useRef, useState, useLayoutEffect } from "react";
import "./ContextMenu.css";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  /** When true, the item is rendered as a separator and other fields are ignored. */
  separator?: boolean;
  /** When true, the item is dimmed and unclickable. */
  disabled?: boolean;
  /** When true, the item is rendered with destructive styling. */
  destructive?: boolean;
  onClick?: () => void;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState(position);

  // Close on outside click / Esc
  useEffect(() => {
    const handlePointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Defer to next tick so the very click that opened the menu doesn't close it
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", handlePointer);
    }, 0);
    document.addEventListener("keydown", handleKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Keep the menu inside the viewport — measure after mount and shift left/up if needed.
  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { x, y } = position;
    if (x + rect.width > vw - 8) x = vw - rect.width - 8;
    if (y + rect.height > vh - 8) y = vh - rect.height - 8;
    if (x !== adjusted.x || y !== adjusted.y) setAdjusted({ x, y });
  }, [position, adjusted.x, adjusted.y]);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: adjusted.x, top: adjusted.y }}
      role="menu"
    >
      {items.map((item, idx) =>
        item.separator ? (
          <div key={`sep-${idx}`} className="context-menu-separator" role="separator" />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={`context-menu-item ${item.disabled ? "disabled" : ""} ${
              item.destructive ? "destructive" : ""
            }`}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              item.onClick?.();
              onClose();
            }}
          >
            {item.icon && <span className="context-menu-icon">{item.icon}</span>}
            <span className="context-menu-label">{item.label}</span>
            {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}
