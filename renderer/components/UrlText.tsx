import { DecodeText } from "./DecodeText";

function UrlPart({ text, className, decode }: { text: string; className: string; decode: boolean }) {
  return decode ? <DecodeText text={text} className={className} /> : <span className={className}>{text}</span>;
}

/**
 * Renders a URL with the origin and query dimmed, so the path stands out.
 * `decode` plays the decrypt effect; leave it off for table rows.
 */
export function UrlText({ url, decode = false }: { url: string; decode?: boolean }) {
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)?([^?#]*)(.*)$/i.exec(url);
  if (!match) return <span className="url-path">{url}</span>;
  const [, origin, path, query] = match;
  return (
    <>
      {origin && <UrlPart text={origin} className="url-origin" decode={decode} />}
      <UrlPart text={path} className="url-path" decode={decode} />
      {query && <UrlPart text={query} className="url-query" decode={decode} />}
    </>
  );
}
