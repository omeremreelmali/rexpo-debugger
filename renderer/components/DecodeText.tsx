import { useEffect, useRef } from "react";

const GLYPHS = "ABCDEF0123456789<>[]{}#$%&*+=-_";
const KEEP = /[\s/:.?&=]/; // Structure stays put, so a URL decodes in place.
const MAX_LENGTH = 180;

function motionAllowed(): boolean {
  return (
    document.documentElement.dataset.fx !== "off" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Text that "decrypts" left to right whenever it changes. The real text is in
 * the DOM until the first animation frame, so a hidden window never shows noise.
 */
export function DecodeText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !text || text.length > MAX_LENGTH || !motionAllowed()) return;

    const duration = Math.min(420, 140 + text.length * 7);
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const revealed = Math.floor(progress * text.length);
      let output = text.slice(0, revealed);
      for (let i = revealed; i < text.length; i++) {
        output += KEEP.test(text[i])
          ? text[i]
          : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = output;
      if (progress < 1) frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(frame);
      el.textContent = text;
    };
  }, [text]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
