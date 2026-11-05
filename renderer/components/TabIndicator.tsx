import { useLayoutEffect, useRef } from "react";

/**
 * Lit underline that slides to the sibling `.tab-button.active`. Render it inside
 * the tab row, and pass whatever selects the active tab as `watch`.
 */
export function TabIndicator({ watch }: { watch: unknown }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const row = el?.parentElement;
    if (!el || !row) return;

    const place = () => {
      const active = row.querySelector<HTMLElement>(".tab-button.active");
      if (!active) return;
      el.style.width = `${active.offsetWidth}px`;
      el.style.transform = `translateX(${active.offsetLeft}px)`;
    };
    place();

    // Tab widths change with live counts, web font loading and window size.
    const observer = new ResizeObserver(place);
    observer.observe(row);
    return () => observer.disconnect();
  }, [watch]);

  return <span ref={ref} className="tab-indicator" aria-hidden="true" />;
}
