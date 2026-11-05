import { useState, useMemo } from "react";
import { useNetwork } from "../state/NetworkContext";
import { generateCurlCommand, copyToClipboard } from "../utils/curlGenerator";
import { hasPartialBody, replayRequest } from "../utils/replayRequest";
import { getStatusClass, getStatusLabel } from "../utils/requestStatus";
import { JsonViewer, TextViewer } from "./JsonViewer";
import { FormDataViewer } from "./FormDataViewer";
import { FindInContent } from "./FindInContent";
import { DecodeText } from "./DecodeText";
import { HudEmpty } from "./HudEmpty";
import { Icon } from "./Icons";
import { TabIndicator } from "./TabIndicator";
import { useToast } from "./Toast";
import { UrlText } from "./UrlText";
import "./RequestDetails.css";

type Tab = "overview" | "headers" | "request" | "response" | "timing";

export function RequestDetails() {
  const { state } = useNetwork();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [copySuccess, setCopySuccess] = useState(false);
  const toast = useToast();

  const selectedRequest = useMemo(() => {
    if (!state.selectedRequestId) return null;
    return state.requests.find((r) => r.id === state.selectedRequestId);
  }, [state.selectedRequestId, state.requests]);

  const handleCopyCurl = async () => {
    if (!selectedRequest) return;

    const curlCommand = generateCurlCommand(selectedRequest);
    const success = await copyToClipboard(curlCommand);

    if (success) {
      setCopySuccess(true);
      if (hasPartialBody(selectedRequest.requestBodySnippet)) {
        toast.show("Copied, but the body was truncated at capture", "info");
      }
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleReplay = async () => {
    if (!selectedRequest) return;
    const result = await replayRequest(selectedRequest);
    toast.show(result.message, result.ok ? "success" : "error");
  };

  if (!selectedRequest) {
    return (
      <div className="request-details-container">
        <HudEmpty title="Select a request" hint="Headers, bodies and timing open here. Right-click a row for more actions." />
      </div>
    );
  }

  const isJson = (text?: string): boolean => {
    if (!text) return false;
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "headers", label: "Headers" },
    { id: "request", label: "Request" },
    { id: "response", label: "Response" },
    { id: "timing", label: "Timing" },
  ];

  const headersText = [
    "Request Headers",
    ...Object.entries(selectedRequest.requestHeaders ?? {}).map(([key, value]) => `${key}: ${value}`),
    "",
    "Response Headers",
    ...Object.entries(selectedRequest.responseHeaders ?? {}).map(([key, value]) => `${key}: ${value}`),
  ].join("\n");

  const requestText = selectedRequest.requestFormParts?.length
    ? selectedRequest.requestFormParts.map((part) =>
        [part.name, part.kind, part.value, part.fileName, part.mimeType, part.size, part.uri]
          .filter((value) => value !== undefined)
          .join(": ")
      ).join("\n")
    : selectedRequest.requestBodySnippet ?? "";

  const searchableText = activeTab === "headers"
    ? headersText
    : activeTab === "request"
      ? requestText
      : activeTab === "response"
        ? selectedRequest.responseBodySnippet ?? ""
        : "";

  return (
    <div className="request-details-container">
      <header className="req-hero">
        <div className="req-hero-meta">
          <DecodeText
            text={selectedRequest.method}
            className={`method-badge method-${selectedRequest.method.toLowerCase()}`}
          />
          <DecodeText
            text={getStatusLabel(selectedRequest)}
            className={`status-badge ${getStatusClass(selectedRequest)}`}
          />
          {selectedRequest.statusText && (
            <DecodeText text={selectedRequest.statusText} className="req-hero-text" />
          )}
          {selectedRequest.durationMs !== undefined && (
            <span className="req-hero-dur">{selectedRequest.durationMs.toFixed(0)} ms</span>
          )}
          <div className="req-hero-actions">
            <button
              className="replay-request-button"
              onClick={handleReplay}
              title="Replay this request"
              type="button"
            >
              <Icon name="replay" /> Replay
            </button>
            <button
              className={`copy-curl-button ${copySuccess ? "success" : ""}`}
              onClick={handleCopyCurl}
              title="Copy as cURL"
              type="button"
            >
              <Icon name={copySuccess ? "check" : "code"} />
              {copySuccess ? "Copied" : "Copy as cURL"}
            </button>
          </div>
        </div>
        <div className="req-hero-url">
          <UrlText url={selectedRequest.url} decode />
        </div>
      </header>

      <div className="details-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <TabIndicator watch={activeTab} />
      </div>

      <div className="details-content">
        <FindInContent
          key={`${selectedRequest.id}-${activeTab}`}
          text={searchableText}
          placeholder={`Find in ${activeTab}`}
          enabled={activeTab === "headers" || activeTab === "request" || activeTab === "response"}
        >
        {activeTab === "overview" && (
          <div className="details-section">
            <h3>General Information</h3>
            <div className="info-grid">
              <div className="info-row">
                <span className="info-label">URL:</span>
                <span className="info-value">{selectedRequest.url}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Method:</span>
                <span className="info-value">
                  {selectedRequest.method === "OPTIONS" 
                    ? "OPTIONS (Preflight)" 
                    : selectedRequest.method}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className="info-value">
                  {selectedRequest.status ||
                    (selectedRequest.isError ? "ERROR" : "Pending")}
                  {selectedRequest.statusText &&
                    ` (${selectedRequest.statusText})`}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Duration:</span>
                <span className="info-value">
                  {selectedRequest.durationMs !== undefined
                    ? `${selectedRequest.durationMs.toFixed(2)} ms`
                    : "-"}
                </span>
              </div>
              {selectedRequest.errorMessage && (
                <div className="info-row">
                  <span className="info-label">Error:</span>
                  <span className="info-value error-text">
                    {selectedRequest.errorMessage}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "headers" && (
          <div className="details-section">
            <h3>Request Headers</h3>
            {selectedRequest.requestHeaders ? (
              <div className="headers-list">
                {Object.entries(selectedRequest.requestHeaders).map(
                  ([key, value]) => (
                    <div key={key} className="header-row">
                      <span className="header-key">{key}:</span>
                      <span className="header-value">{value}</span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="empty-message">No request headers</p>
            )}

            <h3>Response Headers</h3>
            {selectedRequest.responseHeaders ? (
              <div className="headers-list">
                {Object.entries(selectedRequest.responseHeaders).map(
                  ([key, value]) => (
                    <div key={key} className="header-row">
                      <span className="header-key">{key}:</span>
                      <span className="header-value">{value}</span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="empty-message">No response headers</p>
            )}
          </div>
        )}

        {activeTab === "request" && (
          <div className="details-section">
            <h3>Request Body</h3>
            {selectedRequest.requestFormParts?.length ? (
              <FormDataViewer
                parts={selectedRequest.requestFormParts}
                sourceClientId={selectedRequest.sourceClientId}
              />
            ) : selectedRequest.requestBodySnippet ? (
              isJson(selectedRequest.requestBodySnippet) ? (
                <JsonViewer data={selectedRequest.requestBodySnippet} />
              ) : (
                <TextViewer data={selectedRequest.requestBodySnippet} />
              )
            ) : (
              <p className="empty-message">No request body</p>
            )}
          </div>
        )}

        {activeTab === "response" && (
          <div className="details-section">
            <h3>Response Body</h3>
            {selectedRequest.responseBodySnippet ? (
              isJson(selectedRequest.responseBodySnippet) ? (
                <JsonViewer data={selectedRequest.responseBodySnippet} />
              ) : (
                <TextViewer data={selectedRequest.responseBodySnippet} />
              )
            ) : (
              <p className="empty-message">No response body yet</p>
            )}
          </div>
        )}

        {activeTab === "timing" && (
          <div className="details-section">
            <h3>Timing Information</h3>
            <div className="info-grid">
              <div className="info-row">
                <span className="info-label">Started:</span>
                <span className="info-value">
                  {new Date(selectedRequest.startedAt).toLocaleString("en-US")}
                </span>
              </div>
              {selectedRequest.finishedAt && (
                <div className="info-row">
                  <span className="info-label">Finished:</span>
                  <span className="info-value">
                    {new Date(selectedRequest.finishedAt).toLocaleString(
                      "en-US"
                    )}
                  </span>
                </div>
              )}
              <div className="info-row">
                <span className="info-label">Total Duration:</span>
                <span className="info-value">
                  {selectedRequest.durationMs !== undefined
                    ? `${selectedRequest.durationMs.toFixed(2)} ms`
                    : "Not completed yet"}
                </span>
              </div>
            </div>
          </div>
        )}
        </FindInContent>
      </div>
    </div>
  );
}
