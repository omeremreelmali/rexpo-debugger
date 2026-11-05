/**
 * Monoline icon set. Square caps and mitered joins on a 16px grid, so icons
 * sit on the same pixel rhythm as the monospace type around them.
 */
const PATHS = {
  signal: "M1.5 8.5h3l2-5.5 2.5 10.5 2-5h3.5",
  terminal: "M2 3h12v10H2z M4.5 6l2 2-2 2 M8 10.5h3.5",
  stack: "M8 2l6 3-6 3-6-3z M2 8l6 3 6-3 M2 11l6 3 6-3",
  nodes: "M6.5 1.5h3v3h-3z M2 11h3v3H2z M11 11h3v3h-3z M8 4.5V8 M3.5 11V8h9v3",
  gear: "M8 1.5l5.6 3.25v6.5L8 14.5l-5.6-3.25v-6.5z M8 6a2 2 0 1 1 0 4a2 2 0 0 1 0-4z",
  pause: "M5 3v10 M11 3v10",
  play: "M4.5 3l8 5-8 5z",
  trash: "M2.5 4h11 M6 4V2h4v2 M4 4l.7 9.5h6.6L12 4 M6.7 6.5V11 M9.3 6.5V11",
  sweep: "M13.5 2.5l-5 5 M7 6.5l2.5 2.5-1.5 5L2 8z",
  search: "M7 2.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 0 1 0-9z M10.5 10.5l3 3",
  link: "M6.5 9.5l3-3 M7 4.5L8.5 3a2.8 2.8 0 0 1 4 4L11 8.5 M9 11.5L7.5 13a2.8 2.8 0 0 1-4-4L5 7.5",
  copy: "M5.5 5.5h8v8h-8z M10.5 5.5v-3h-8v8h3",
  code: "M5 4.5L1.5 8 5 11.5 M11 4.5L14.5 8 11 11.5 M9.5 2.5l-3 11",
  braces:
    "M6 2.5H5A1.5 1.5 0 0 0 3.5 4v2.5L2 8l1.5 1.5V12A1.5 1.5 0 0 0 5 13.5h1 M10 2.5h1A1.5 1.5 0 0 1 12.5 4v2.5L14 8l-1.5 1.5V12a1.5 1.5 0 0 1-1.5 1.5h-1",
  download: "M8 2v8 M4.5 6.5L8 10l3.5-3.5 M2.5 13.5h11",
  replay: "M3 8a5 5 0 1 0 1.5-3.5L2.5 6.5 M2.5 2.5v4h4",
  edit: "M10.5 2.5L13.5 5.5 6 13l-3.5.5L3 10z",
  note: "M3.5 2h9v12h-9z M6 5.5h4 M6 8h4 M6 10.5h2.5",
  folder: "M2 3.5h4.5L8 5.5h6v8H2z",
  move: "M2 3.5h4.5L8 5.5h6v8H2z M5.5 9.5h5 M8.5 7.5l2 2-2 2",
  eye: "M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z M8 6.2a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 0 1 0-3.6z",
  eyeOff:
    "M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z M8 6.2a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 0 1 0-3.6z M3 13L13 3",
  x: "M3.5 3.5l9 9 M12.5 3.5l-9 9",
  check: "M3 8.5L6.5 12 13 4.5",
  plus: "M8 3v10 M3 8h10",
  warning: "M8 2.5L14.5 13.5h-13z M8 6.5V10 M8 11.5v.5",
  info: "M2.5 2.5h11v11h-11z M8 7.5v3.5 M8 5v.5",
  arrowLeft: "M13 8H3 M7 4L3 8l4 4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The Rexpo "R" monogram from assets/icon.svg, drawn in the accent color. */
export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="240 260 590 590"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="brand-stroke"
        pathLength={1}
        d="M310 332 H588 a126 126 0 0 1 0 252 H460 l180 180"
        stroke="currentColor"
        strokeWidth="86"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <circle className="brand-dot" cx="744" cy="332" r="64" fill="currentColor" />
    </svg>
  );
}
