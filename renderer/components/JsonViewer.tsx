import "./JsonViewer.css";

interface JsonViewerProps {
  data: string;
  className?: string;
}

export function JsonViewer({ data, className = "" }: JsonViewerProps) {
  const syntaxHighlight = (json: string): string => {
    if (!json) return "";

    // Try to parse and format if it's valid JSON
    try {
      const obj = JSON.parse(json);
      json = JSON.stringify(obj, null, 2);
    } catch (e) {
      // If not valid JSON, return as-is
      return json;
    }

    // Syntax highlighting using regex
    json = json
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "json-number";
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = "json-key";
          } else {
            cls = "json-string";
          }
        } else if (/true|false/.test(match)) {
          cls = "json-boolean";
        } else if (/null/.test(match)) {
          cls = "json-null";
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  const highlightedJson = syntaxHighlight(data);

  return (
    <pre
      className={`json-viewer ${className}`}
      dangerouslySetInnerHTML={{ __html: highlightedJson }}
    />
  );
}

// Simple component for non-JSON text
export function TextViewer({ data, className = "" }: JsonViewerProps) {
  return <pre className={`text-viewer ${className}`}>{data}</pre>;
}
