import { useState } from "react";
import "./JsonViewer.css";

interface JsonViewerProps {
  data: string;
  className?: string;
}

export function JsonViewer({ data, className = "" }: JsonViewerProps) {
  let parsedData: any;

  try {
    parsedData = JSON.parse(data);
  } catch (e) {
    // If not valid JSON, fall back to text viewer
    return <TextViewer data={data} className={className} />;
  }

  return (
    <div className={`json-viewer-tree ${className}`}>
      <JsonNode data={parsedData} level={0} name="" />
    </div>
  );
}

interface JsonNodeProps {
  data: any;
  level: number;
  name: string;
  isLast?: boolean;
}

function JsonNode({ data, level, name, isLast = false }: JsonNodeProps) {
  const [collapsed, setCollapsed] = useState(level > 2); // Auto-collapse after level 2

  const type = getType(data);
  const isExpandable = type === "object" || type === "array";
  const isEmpty = isExpandable && Object.keys(data).length === 0;

  const renderValue = () => {
    if (data === null) {
      return <span className="json-null">null</span>;
    }

    switch (type) {
      case "string":
        return <span className="json-string">"{data}"</span>;
      case "number":
        return <span className="json-number">{data}</span>;
      case "boolean":
        return <span className="json-boolean">{String(data)}</span>;
      case "array":
        if (isEmpty) {
          return <span className="json-bracket">[]</span>;
        }
        return (
          <>
            <span className="json-bracket">[</span>
            {collapsed && <span className="json-ellipsis">...</span>}
            <span className="json-bracket">]</span>
            {!collapsed && (
              <span className="json-count"> {data.length} items</span>
            )}
          </>
        );
      case "object":
        if (isEmpty) {
          return <span className="json-bracket">{"{}"}</span>;
        }
        return (
          <>
            <span className="json-bracket">{"{"}</span>
            {collapsed && <span className="json-ellipsis">...</span>}
            <span className="json-bracket">{"}"}</span>
            {!collapsed && (
              <span className="json-count">
                {" "}
                {Object.keys(data).length} keys
              </span>
            )}
          </>
        );
      default:
        return <span>{String(data)}</span>;
    }
  };

  const renderChildren = () => {
    if (collapsed || !isExpandable || isEmpty) return null;

    if (type === "array") {
      return (
        <div className="json-children">
          {data.map((item: any, index: number) => (
            <JsonNode
              key={index}
              data={item}
              level={level + 1}
              name={`[${index}]`}
              isLast={index === data.length - 1}
            />
          ))}
        </div>
      );
    }

    if (type === "object") {
      const entries = Object.entries(data);
      return (
        <div className="json-children">
          {entries.map(([key, value], index) => (
            <JsonNode
              key={key}
              data={value}
              level={level + 1}
              name={key}
              isLast={index === entries.length - 1}
            />
          ))}
        </div>
      );
    }
  };

  return (
    <div className="json-node">
      <div className="json-line">
        {isExpandable && !isEmpty && (
          <button
            className={`json-toggle ${collapsed ? "collapsed" : "expanded"}`}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "▶" : "▼"}
          </button>
        )}
        {!isExpandable && <span className="json-spacer" />}

        {name && (
          <>
            <span className="json-key">"{name}"</span>
            <span className="json-colon">: </span>
          </>
        )}

        {renderValue()}

        {!isLast && level > 0 && <span className="json-comma">,</span>}
      </div>

      {renderChildren()}
    </div>
  );
}

function getType(value: any): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

// Simple component for non-JSON text
export function TextViewer({ data, className = "" }: JsonViewerProps) {
  return <pre className={`text-viewer ${className}`}>{data}</pre>;
}
