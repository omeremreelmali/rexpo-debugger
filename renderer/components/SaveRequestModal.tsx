import { useEffect, useMemo, useState } from "react";
import { RequestState } from "../types";
import {
  SavedRequest,
  useCollections,
  UNCATEGORIZED_BUCKET,
} from "../state/CollectionsContext";
import { useToast } from "./Toast";
import "./SaveRequestModal.css";

interface SaveRequestModalProps {
  /** Source — either an in-flight network row, or an existing saved request being edited. */
  source: RequestState | SavedRequest;
  /** When true the modal edits the saved entry in place instead of creating a new one. */
  editingId?: string;
  onClose: () => void;
}

/**
 * "Save request…" modal — opened from the network row context menu, and also
 * used as the "Edit metadata" form for an already-saved request.
 *
 * All fields are optional. The user can save a request with nothing filled in
 * and it'll land in the "Uncategorized" bucket with an auto-derived label.
 */
export function SaveRequestModal({ source, editingId, onClose }: SaveRequestModalProps) {
  const { state, saveRequest, updateRequest, collectionNames } = useCollections();
  const toast = useToast();

  // Determine seed values. When editing, we read from the SavedRequest.
  // When creating, we read from the in-flight RequestState.
  const isEdit = Boolean(editingId);

  const seedHeaders = isEdit
    ? (source as SavedRequest).headers
    : (source as RequestState).requestHeaders;
  const seedBody = isEdit
    ? (source as SavedRequest).body
    : (source as RequestState).requestBodySnippet;
  const seedName = isEdit ? (source as SavedRequest).name ?? "" : "";
  const seedCollection = isEdit ? (source as SavedRequest).collectionName ?? "" : "";
  const seedTags = isEdit
    ? ((source as SavedRequest).tags ?? []).join(", ")
    : "";
  const seedDescription = isEdit ? (source as SavedRequest).description ?? "" : "";

  const [name, setName] = useState(seedName);
  const [collectionMode, setCollectionMode] = useState<"existing" | "new">(
    isEdit && seedCollection && !collectionNames.includes(seedCollection)
      ? "new"
      : "existing"
  );
  const [collectionExisting, setCollectionExisting] = useState<string>(
    seedCollection || ""
  );
  const [collectionNew, setCollectionNew] = useState<string>(
    isEdit && seedCollection && !collectionNames.includes(seedCollection)
      ? seedCollection
      : ""
  );
  const [tagsInput, setTagsInput] = useState(seedTags);
  const [description, setDescription] = useState(seedDescription);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const resolvedCollection = useMemo(() => {
    const raw =
      collectionMode === "new" ? collectionNew.trim() : collectionExisting.trim();
    return raw || undefined; // undefined → Uncategorized bucket
  }, [collectionMode, collectionNew, collectionExisting]);

  const parsedTags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsInput]
  );

  const handleSave = () => {
    const payload = {
      name: name.trim() || undefined,
      collectionName: resolvedCollection,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      description: description.trim() || undefined,
      method: source.method,
      url: source.url,
      headers: seedHeaders,
      body: seedBody,
    };

    if (isEdit && editingId) {
      updateRequest(editingId, payload);
      toast.show("Saved request güncellendi", "success");
    } else {
      saveRequest(payload);
      toast.show(
        resolvedCollection
          ? `Kaydedildi: ${resolvedCollection}`
          : "Kaydedildi: Uncategorized",
        "success"
      );
    }
    onClose();
  };

  // Collection options for the dropdown — include existing names and any
  // currently-saved ones, plus "(Uncategorized)" as the empty bucket.
  const existingOptions = useMemo(() => {
    // Show every distinct collection plus the empty bucket. The empty value
    // means "Uncategorized".
    const opts: { value: string; label: string }[] = [
      { value: "", label: "(Uncategorized)" },
    ];
    for (const name of collectionNames) {
      if (name === UNCATEGORIZED_BUCKET) continue; // we already added the empty option
      opts.push({ value: name, label: name });
    }
    return opts;
  }, [collectionNames]);

  return (
    <div
      className="save-request-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="save-request-modal" role="dialog" aria-modal="true">
        <header className="save-request-header">
          <div>
            <h2>{isEdit ? "Edit saved request" : "Save request"}</h2>
            <p className="save-request-source">
              <span className="save-request-source-method">
                {source.method.toUpperCase()}
              </span>{" "}
              <span className="save-request-source-url">{source.url}</span>
            </p>
          </div>
          <button
            className="save-request-close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </header>

        <div className="save-request-body">
          <label className="save-request-field">
            <span className="save-request-label">
              Name <span className="save-request-optional">(opsiyonel)</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn. Login - happy path"
              autoFocus
            />
          </label>

          <fieldset className="save-request-field save-request-collection">
            <legend className="save-request-label">
              Collection <span className="save-request-optional">(opsiyonel)</span>
            </legend>

            <div className="save-request-collection-tabs">
              <button
                type="button"
                className={`save-request-collection-tab ${
                  collectionMode === "existing" ? "active" : ""
                }`}
                onClick={() => setCollectionMode("existing")}
              >
                Existing
              </button>
              <button
                type="button"
                className={`save-request-collection-tab ${
                  collectionMode === "new" ? "active" : ""
                }`}
                onClick={() => setCollectionMode("new")}
              >
                + New
              </button>
            </div>

            {collectionMode === "existing" ? (
              <select
                value={collectionExisting}
                onChange={(e) => setCollectionExisting(e.target.value)}
              >
                {existingOptions.map((o) => (
                  <option key={o.value || "__uncat__"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={collectionNew}
                onChange={(e) => setCollectionNew(e.target.value)}
                placeholder="örn. Auth flows"
              />
            )}
          </fieldset>

          <label className="save-request-field">
            <span className="save-request-label">
              Tags <span className="save-request-optional">(opsiyonel, virgülle ayır)</span>
            </span>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="örn. auth, smoke-test, regression"
            />
            {parsedTags.length > 0 && (
              <div className="save-request-tag-preview">
                {parsedTags.map((tag) => (
                  <span key={tag} className="save-request-tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </label>

          <label className="save-request-field">
            <span className="save-request-label">
              Description <span className="save-request-optional">(opsiyonel)</span>
            </span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu request ne yapar / ne zaman kullanılır?"
            />
          </label>
        </div>

        <footer className="save-request-footer">
          <span className="save-request-hint">
            {state.savedRequests.length} kayıtlı request • {collectionNames.length}{" "}
            koleksiyon
          </span>
          <div className="save-request-footer-actions">
            <button
              className="save-request-cancel"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="save-request-confirm"
              onClick={handleSave}
              type="button"
            >
              {isEdit ? "Update" : "Save"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
