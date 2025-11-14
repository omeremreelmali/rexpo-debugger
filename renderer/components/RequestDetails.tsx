import React, { useState, useMemo } from "react";
import { useNetwork } from "../state/NetworkContext";
import { generateCurlCommand, copyToClipboard } from "../utils/curlGenerator";
import { JsonViewer, TextViewer } from "./JsonViewer";
import "./RequestDetails.css";

type Tab = "overview" | "headers" | "request" | "response" | "timing";

export function RequestDetails() {
  const { state } = useNetwork();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [copySuccess, setCopySuccess] = useState(false);

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
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  if (!selectedRequest) {
    return (
      <div className="request-details-container">
        <div className="no-selection">
          <div className="no-selection-icon">👈</div>
          <p>Select a request from the left</p>
        </div>
      </div>
    );
  }

  const formatJson = (text?: string): string => {
    if (!text) return "";
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return text;
    }
  };

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

  return (
    <div className="request-details-container">
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
      </div>

      <div className="details-content">
        {activeTab === "overview" && (
          <div className="details-section">
            <div className="section-header">
              <h3>General Information</h3>
              <button
                className={`copy-curl-button ${copySuccess ? "success" : ""}`}
                onClick={handleCopyCurl}
                title="Copy as cURL"
              >
                {copySuccess ? "✓ Copied!" : "📋 Copy as cURL"}
              </button>
            </div>
            <div className="info-grid">
              <div className="info-row">
                <span className="info-label">URL:</span>
                <span className="info-value">{selectedRequest.url}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Method:</span>
                <span className="info-value">{selectedRequest.method}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className="info-value">
                  {selectedRequest.isError
                    ? "ERROR"
                    : selectedRequest.status || "Pending"}
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

            <h3 style={{ marginTop: "24px" }}>Response Headers</h3>
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
            {selectedRequest.requestBodySnippet ? (
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
      </div>
    </div>
  );
}
