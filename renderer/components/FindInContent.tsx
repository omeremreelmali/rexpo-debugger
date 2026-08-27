import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import "./FindInContent.css";

type FindInContentProps = {
  text: string;
  children: ReactNode;
  placeholder?: string;
  className?: string;
  enabled?: boolean;
};

type TextPart = { text: string; matchIndex?: number };

function splitMatches(text: string, query: string): TextPart[] {
  if (!query) return [{ text }];

  const parts: TextPart[] = [];
  const haystack = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  let cursor = 0;
  let matchIndex = 0;

  while (cursor < text.length) {
    const foundAt = haystack.indexOf(needle, cursor);
    if (foundAt === -1) break;
    if (foundAt > cursor) parts.push({ text: text.slice(cursor, foundAt) });
    parts.push({
      text: text.slice(foundAt, foundAt + query.length),
      matchIndex,
    });
    matchIndex += 1;
    cursor = foundAt + query.length;
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export function FindInContent({
  text,
  children,
  placeholder = "Find in content",
  className = "",
  enabled = true,
}: FindInContentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const matchRefs = useRef<Array<HTMLElement | null>>([]);
  const parts = useMemo(() => splitMatches(text, query), [text, query]);
  const matchCount = useMemo(
    () => parts.reduce((count, part) => count + (part.matchIndex === undefined ? 0 : 1), 0),
    [parts]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (enabled && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setIsOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        setIsOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, text]);

  useEffect(() => {
    if (!query || matchCount === 0) return;
    matchRefs.current[activeIndex]?.scrollIntoView({ block: "center" });
  }, [activeIndex, matchCount, query]);

  const move = (direction: 1 | -1) => {
    if (matchCount === 0) return;
    setActiveIndex((current) => (current + direction + matchCount) % matchCount);
  };

  return (
    <div className={`find-in-content ${className}`}>
      {enabled && !isOpen && (
        <button
          type="button"
          className="find-open-button"
          onClick={() => {
            setIsOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          title="Find in content (Cmd/Ctrl+F)"
        >
          ⌕ Find
        </button>
      )}
      {isOpen && (
        <div className="find-bar">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                move(event.shiftKey ? -1 : 1);
              }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
          />
          <span className="find-count">
            {query ? (matchCount ? `${activeIndex + 1} / ${matchCount}` : "No results") : "0 / 0"}
          </span>
          <button type="button" onClick={() => move(-1)} disabled={!matchCount} title="Previous match (Shift+Enter)">↑</button>
          <button type="button" onClick={() => move(1)} disabled={!matchCount} title="Next match (Enter)">↓</button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setQuery("");
            }}
            title="Close (Escape)"
          >
            ×
          </button>
        </div>
      )}

      {query ? (
        <pre className="find-results" aria-live="polite">
          {parts.map((part, index) =>
            part.matchIndex === undefined ? (
              <span key={index}>{part.text}</span>
            ) : (
              <mark
                key={index}
                ref={(element) => { matchRefs.current[part.matchIndex!] = element; }}
                className={part.matchIndex === activeIndex ? "active" : ""}
              >
                {part.text}
              </mark>
            )
          )}
        </pre>
      ) : (
        children
      )}
    </div>
  );
}
