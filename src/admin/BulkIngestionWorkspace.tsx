import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createIngestionBatch,
  deleteIngestionBatch,
  getIngestionBatch,
  processIngestionItem,
  retryIngestionItems,
  uploadIngestionItem,
  type IngestionBatchStatus,
  type IngestionItemStatus
} from "../lib/adminApi";
import {
  BULK_MAX_BATCH_BYTES,
  BULK_MAX_FILE_BYTES,
  BULK_MAX_ITEMS,
  applyDuplicateWarnings,
  canConfirmBulk,
  createBulkDraftItem,
  formatBytes,
  totalDraftBytes,
  type BulkDraftItem
} from "./bulkIngestion";

const SESSION_KEY = "meme-capsule:admin-ingestion-session";
const UPLOAD_CONCURRENCY = 6;
const AI_CONCURRENCY = 3;

const formatSpeed = (bytesPerSec: number) => {
  if (bytesPerSec <= 0 || !Number.isFinite(bytesPerSec)) return "0 KB/s";
  return `${formatBytes(bytesPerSec)}/s`;
};

const formatEta = (seconds: number) => {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return "--";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
};

type BulkIngestionWorkspaceProps = {
  adminToken: string;
  backendMode: boolean;
  onNotice: (message: string) => void;
  onBackendChanged: () => Promise<void> | void;
};

type PersistedItem = Pick<BulkDraftItem, "clientItemId" | "memeId" | "fileName" | "title" | "mimeType" | "byteSize" | "contentHash">;
type PersistedSession = { batchId: string; items: PersistedItem[] };

const readPersistedSession = (): PersistedSession | null => {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    return parsed?.batchId && Array.isArray(parsed.items) ? parsed : null;
  } catch {
    return null;
  }
};

const statusForItem = (item: BulkDraftItem) => {
  if (!item.server) return "READY TO UPLOAD";
  if (item.server.state === "human_ready") return "HUMAN READY (ARCHIVED)";
  if (item.server.upload_state === "failed") return "UPLOAD FAILED";
  if (item.server.upload_state !== "uploaded") return "UPLOADING...";
  if (item.server.state === "processing") return "AI PREPROCESSING";
  if (item.server.state === "retry_wait") return "RETRY WAITING";
  if (item.server.state === "failed") return "AI FAILED";
  return "UPLOADED (DRAFT)";
};

const statusClass = (item: BulkDraftItem) => {
  const status = statusForItem(item);
  if (status.includes("READY")) return "ready";
  if (status.includes("FAILED")) return "failed";
  if (status.includes("PROCESSING") || status.includes("UPLOADING")) return "processing";
  return "queued";
};

const mergeServerStatus = (items: BulkDraftItem[], status: IngestionBatchStatus) =>
  items.map((item) => {
    const server = status.items.find((candidate) => candidate.idempotency_key === item.clientItemId);
    return server
      ? {
          ...item,
          title: server.title || item.title,
          duplicateWarning: server.duplicate_warning ? `Duplicate of existing job ${server.duplicate_warning}.` : item.duplicateWarning,
          server
        }
      : item;
  });

const runBounded = async <T,>(values: T[], worker: (value: T) => Promise<void>, concurrency = 4) => {
  let cursor = 0;
  const runWorker = async () => {
    while (cursor < values.length) {
      const value = values[cursor++];
      await worker(value);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, runWorker));
};

export default function BulkIngestionWorkspace({
  adminToken,
  backendMode,
  onNotice,
  onBackendChanged
}: BulkIngestionWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BulkDraftItem[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<IngestionBatchStatus | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [uploadTelemetry, setUploadTelemetry] = useState<{
    bytesUploaded: number;
    totalBytes: number;
    speedBps: number;
    etaSeconds: number;
    isActive: boolean;
  }>({
    bytesUploaded: 0,
    totalBytes: 0,
    speedBps: 0,
    etaSeconds: 0,
    isActive: false
  });
  const activeUploadBytesRef = useRef<Map<string, number>>(new Map());
  const completedUploadBytesRef = useRef<number>(0);
  const uploadStartTimeRef = useRef<number>(0);
  const totalTargetBytesRef = useRef<number>(0);
  const smoothedSpeedRef = useRef<number>(0);
  const itemsRef = useRef(items);
  const batchStatusRef = useRef<IngestionBatchStatus | null>(null);

  const submitted = Boolean(batchId);
  const totalBytes = useMemo(() => totalDraftBytes(items), [items]);
  const invalidCount = useMemo(() => items.filter((item) => item.validationErrors.length > 0).length, [items]);
  const readyCount = batchStatus?.batch.ready_items || 0;
  const failedItems = useMemo(
    () => items.filter((item) => item.server && (item.server.state === "failed" || item.server.upload_state === "failed")),
    [items]
  );

  const saveSession = useCallback((nextBatchId: string | null, nextItems: BulkDraftItem[]) => {
    if (!nextBatchId) {
      window.localStorage.removeItem(SESSION_KEY);
      return;
    }
    const persisted: PersistedSession = {
      batchId: nextBatchId,
      items: nextItems.map(({ clientItemId, memeId, fileName, title, mimeType, byteSize, contentHash }) => ({
        clientItemId,
        memeId,
        fileName,
        title,
        mimeType,
        byteSize,
        contentHash
      }))
    };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(persisted));
  }, []);

  const applyStatus = useCallback((status: IngestionBatchStatus) => {
    batchStatusRef.current = status;
    setBatchStatus(status);
    setItems((current) => mergeServerStatus(current, status));
  }, []);

  const refreshBatch = useCallback(async (id = batchId) => {
    if (!id || !adminToken.trim()) return null;
    const status = await getIngestionBatch(adminToken, id);
    applyStatus(status);
    return status;
  }, [adminToken, applyStatus, batchId]);

  useEffect(() => {
    if (!adminToken.trim() || !backendMode) return;
    const persisted = readPersistedSession();
    if (!persisted) return;
    setIsRestoring(true);
    const restoredItems: BulkDraftItem[] = persisted.items.map((item) => ({
      ...item,
      file: null,
      previewUrl: "",
      validationErrors: [],
      duplicateWarning: null
    }));
    setBatchId(persisted.batchId);
    setItems(restoredItems);
    getIngestionBatch(adminToken, persisted.batchId)
      .then((status) => {
        setBatchStatus(status);
        setItems((current) => mergeServerStatus(current, status));
      })
      .catch(() => onNotice("Saved intake progress could not be loaded. Check that migration 025 is applied, then refresh."))
      .finally(() => setIsRestoring(false));
  }, [adminToken, backendMode, onNotice]);

  useEffect(() => {
    if (batchId) saveSession(batchId, items);
  }, [batchId, items, saveSession]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => {
    itemsRef.current.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  const addFiles = async (fileList: FileList | File[]) => {
    if (submitted && !items.some((item) => !item.server || item.server.upload_state !== "uploaded")) {
      onNotice("This batch has already completed its uploads. Start a new batch before adding files.");
      return;
    }
    const selected = Array.from(fileList);
    if (selected.length === 0) return;
    let nextItems: BulkDraftItem[];
    if (submitted) {
      const pending = items.filter((item) => item.server && item.server.upload_state !== "uploaded");
      if (selected.length > pending.length) {
        onNotice(`Select at most ${pending.length} pending file${pending.length === 1 ? "" : "s"} for this batch.`);
      }
      nextItems = [...items];
      const targetFiles = selected.slice(0, pending.length);
      const drafts = await Promise.all(targetFiles.map((file) => createBulkDraftItem(file)));
      for (const [index, draft] of drafts.entries()) {
        const target = pending[index];
        if (draft.previewUrl && target.previewUrl) URL.revokeObjectURL(target.previewUrl);
        const replacement: BulkDraftItem = {
          ...draft,
          clientItemId: target.clientItemId,
          memeId: target.memeId,
          title: target.title,
          server: target.server
        };
        const targetIndex = nextItems.findIndex((item) => item.clientItemId === target.clientItemId);
        if (targetIndex >= 0) nextItems[targetIndex] = replacement;
        else URL.revokeObjectURL(draft.previewUrl);
      }
    } else {
      const availableSlots = BULK_MAX_ITEMS - items.length;
      if (selected.length > availableSlots) {
        onNotice(`A batch can contain at most ${BULK_MAX_ITEMS} images.`);
      }
      nextItems = [...items];
      const targetFiles = selected.slice(0, Math.max(0, availableSlots));
      const drafts = await Promise.all(targetFiles.map((file) => createBulkDraftItem(file)));
      for (const draft of drafts) {
        if (nextItems.some((item) => item.contentHash === draft.contentHash)) {
          URL.revokeObjectURL(draft.previewUrl);
          continue;
        }
        nextItems.push(draft);
      }
    }
    const withWarnings = applyDuplicateWarnings(nextItems);
    setItems(withWarnings);
    if (withWarnings.some((item) => item.validationErrors.length > 0)) {
      onNotice("Some files need attention before the batch can be confirmed. Video files are rejected in this release.");
    } else if (submitted && batchId) {
      onNotice(`${withWarnings.length} image${withWarnings.length === 1 ? "" : "s"} restored for retry. Resume the batch to continue.`);
    } else {
      onNotice(`${withWarnings.length} image${withWarnings.length === 1 ? "" : "s"} ready for review.`);
    }
  };

  const updateTitle = (clientItemId: string, title: string) => {
    setItems((current) => current.map((item) => item.clientItemId === clientItemId ? { ...item, title } : item));
  };

  const removeItem = (clientItemId: string) => {
    if (submitted) return;
    setItems((current) => {
      const target = current.find((item) => item.clientItemId === clientItemId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return applyDuplicateWarnings(current.filter((item) => item.clientItemId !== clientItemId));
    });
  };

  const uploadOne = useCallback(async (statusItem: IngestionItemStatus, currentItems: BulkDraftItem[]) => {
    let currentStatus: IngestionBatchStatus | null = null;
    const local = currentItems.find((item) => item.clientItemId === statusItem.idempotency_key);
    if (statusItem.upload_state !== "uploaded") {
      if (!local?.file) {
        onNotice(`${local?.fileName || statusItem.original_filename} needs to be re-selected before it can be retried.`);
        return;
      }
      currentStatus = await uploadIngestionItem(
        adminToken,
        statusItem.batch_id,
        statusItem.job_id,
        local.file,
        (loaded) => {
          activeUploadBytesRef.current.set(statusItem.job_id, loaded);
          let activeBytes = 0;
          activeUploadBytesRef.current.forEach((val) => { activeBytes += val; });
          const totalLoaded = completedUploadBytesRef.current + activeBytes;
          const elapsedSec = Math.max(0.2, (Date.now() - uploadStartTimeRef.current) / 1000);
          const rawSpeed = totalLoaded / elapsedSec;
          const smoothedSpeed = smoothedSpeedRef.current === 0 ? rawSpeed : 0.7 * smoothedSpeedRef.current + 0.3 * rawSpeed;
          smoothedSpeedRef.current = smoothedSpeed;
          const remainingBytes = Math.max(0, totalTargetBytesRef.current - totalLoaded);
          const eta = smoothedSpeed > 0 ? Math.ceil(remainingBytes / smoothedSpeed) : 0;
          setUploadTelemetry({
            bytesUploaded: totalLoaded,
            totalBytes: totalTargetBytesRef.current,
            speedBps: smoothedSpeed,
            etaSeconds: eta,
            isActive: true
          });
        }
      );
      completedUploadBytesRef.current += local.file.size;
      activeUploadBytesRef.current.delete(statusItem.job_id);
      applyStatus(currentStatus);
    }
  }, [adminToken, applyStatus, onNotice]);

  const processAiOne = useCallback(async (statusItem: IngestionItemStatus) => {
    if (statusItem.state !== "human_ready" && statusItem.state !== "failed") {
      const currentStatus = await processIngestionItem(adminToken, statusItem.job_id);
      applyStatus(currentStatus);
    }
  }, [adminToken, applyStatus]);

  const processItems = async (status: IngestionBatchStatus) => {
    const pendingUploads = status.items.filter((item) => item.upload_state !== "uploaded");
    const totalUploadBytes = pendingUploads.reduce((sum, it) => sum + (it.byte_size || 0), 0);
    completedUploadBytesRef.current = 0;
    activeUploadBytesRef.current.clear();
    smoothedSpeedRef.current = 0;
    uploadStartTimeRef.current = Date.now();
    totalTargetBytesRef.current = totalUploadBytes;

    if (pendingUploads.length > 0) {
      if (totalUploadBytes > 0) {
        setUploadTelemetry({
          bytesUploaded: 0,
          totalBytes: totalUploadBytes,
          speedBps: 0,
          etaSeconds: 0,
          isActive: true
        });
      }

      await runBounded(pendingUploads, async (item) => {
        try {
          await uploadOne(item, itemsRef.current);
        } catch (error) {
          onNotice(error instanceof Error ? error.message : `Could not upload ${item.original_filename}.`);
        }
      }, UPLOAD_CONCURRENCY);

      setUploadTelemetry((prev) => ({ ...prev, isActive: false }));
      onNotice("All files uploaded as drafts. Running background AI evaluations...");
    }

    const latestStatus = await refreshBatch(status.batch.id).catch(() => batchStatusRef.current || status);
    const pendingAi = (latestStatus?.items || []).filter(
      (item) => item.upload_state === "uploaded" && item.state !== "human_ready" && item.state !== "failed"
    );

    if (pendingAi.length > 0) {
      await runBounded(pendingAi, async (item) => {
        try {
          await processAiOne(item);
        } catch (error) {
          // AI errors captured per item
        }
      }, AI_CONCURRENCY);
    }

    const finalStatus = await refreshBatch(status.batch.id).catch(() => null);
    if (finalStatus?.batch.status === "complete") {
      onNotice(`Batch complete. ${finalStatus.batch.ready_items} images are ready for human curation.`);
      await onBackendChanged();
    } else if (finalStatus?.batch.failed_items) {
      onNotice(`${finalStatus.batch.failed_items} item${finalStatus.batch.failed_items === 1 ? "" : "s"} failed. Retry only the failed items after correcting the issue.`);
    }
  };

  const confirmBatch = async () => {
    if (!backendMode || !adminToken.trim()) {
      onNotice("Connect the Admin backend with an API token before confirming a durable batch.");
      return;
    }
    if (!canConfirmBulk(items)) {
      onNotice("Resolve invalid files and re-select any missing files before confirming the batch.");
      return;
    }
    if (totalBytes > BULK_MAX_BATCH_BYTES) {
      onNotice(`The batch exceeds the ${Math.round(BULK_MAX_BATCH_BYTES / (1024 * 1024))} MiB total limit.`);
      return;
    }
    if (items.some((item) => item.duplicateWarning) && !window.confirm("Duplicate content warnings are present. Upload these items anyway?")) return;

    setIsWorking(true);
    try {
      const idempotencyKey = `batch-${crypto.randomUUID()}`;
      const status = await createIngestionBatch(adminToken, {
        idempotency_key: idempotencyKey,
        items: items.map((item) => ({
          idempotency_key: item.clientItemId,
          meme_id: item.memeId,
          original_filename: item.fileName,
          title: item.title.trim() || item.fileName,
          content_hash: item.contentHash,
          byte_size: item.byteSize,
          mime_type: item.mimeType,
          media_type: "image"
        }))
      });
      setBatchId(status.batch.id);
      applyStatus(status);
      onNotice(`Batch ${status.batch.id} created. Uploading with ${UPLOAD_CONCURRENCY} concurrent workers.`);
      await processItems(status);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to create the ingestion batch.");
    } finally {
      setIsWorking(false);
    }
  };

  const resumeBatch = async () => {
    if (!batchId) return;
    setIsWorking(true);
    try {
      const status = await refreshBatch();
      if (status) await processItems(status);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to resume the ingestion batch.");
    } finally {
      setIsWorking(false);
    }
  };

  const retryFailed = async () => {
    if (!adminToken.trim() || failedItems.length === 0) return;
    setIsWorking(true);
    try {
      const result = await retryIngestionItems(adminToken, failedItems.map((item) => item.server!.job_id));
      const status = result.batches.find((candidate) => candidate.batch.id === batchId) || result.batches[0];
      if (status) {
        applyStatus(status);
        await processItems(status);
      }
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to reset failed ingestion items.");
    } finally {
      setIsWorking(false);
    }
  };

  const purgeCurrentBatch = async () => {
    if (!batchId || !adminToken.trim()) return;
    if (!window.confirm(`Are you sure you want to purge batch ${batchId}? This will cancel pending uploads and delete uncurated draft rows.`)) {
      return;
    }
    setIsWorking(true);
    try {
      await deleteIngestionBatch(adminToken, batchId);
      items.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      setItems([]);
      setBatchId(null);
      setBatchStatus(null);
      saveSession(null, []);
      onNotice(`Batch ${batchId} purged successfully.`);
      await onBackendChanged();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Failed to purge batch.");
    } finally {
      setIsWorking(false);
    }
  };

  const startNewBatch = () => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setItems([]);
    setBatchId(null);
    setBatchStatus(null);
    saveSession(null, []);
    onNotice("New bulk intake batch ready.");
  };

  return (
    <section className="bulk-ingestion-panel brutalist-border brutalist-shadow-black-lg" aria-labelledby="bulk-ingestion-heading">
      <div className="bulk-ingestion-heading">
        <div>
          <p className="bulk-kicker">PHASE 4 / DURABLE INTAKE</p>
          <h3 id="bulk-ingestion-heading">Bulk Add Memes</h3>
          <p className="bulk-description">Review image files first. Upload creates private draft metadata, then both advisory AI evaluations must succeed before the item is promoted to archived and unlocked for human curation.</p>
        </div>
        <div className="bulk-limits" aria-label="Bulk intake limits">
          <strong>{items.length}/{BULK_MAX_ITEMS}</strong>
          <span>{formatBytes(totalBytes)} / {formatBytes(BULK_MAX_BATCH_BYTES)}</span>
          {batchStatus?.storage_usage && (
            <span style={{ fontSize: "11px", color: "var(--tertiary, #00bb77)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }} title="R2 Storage Utilization calculated from D1 intake metadata">
              📦 R2: {formatBytes(batchStatus.storage_usage.total_bytes)} ({batchStatus.storage_usage.total_files} items)
            </span>
          )}
        </div>
      </div>

      {uploadTelemetry.isActive && (
        <div
          className="bulk-telemetry-bar brutalist-border-sm"
          style={{
            margin: "12px 0",
            padding: "10px 14px",
            background: "var(--surface-container-high, #1e1e1e)",
            color: "var(--on-surface, #fff)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
            fontSize: "12px",
            fontFamily: "monospace",
            borderLeft: "6px solid var(--primary, #00f0ff)"
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--primary, #00f0ff)" }}>bolt</span>
            <strong>UPLOAD SPEED:</strong> {formatSpeed(uploadTelemetry.speedBps)}
          </div>
          <div>
            <strong>BANDWIDTH:</strong> {formatBytes(uploadTelemetry.bytesUploaded)} / {formatBytes(uploadTelemetry.totalBytes)} (
            {uploadTelemetry.totalBytes > 0 ? Math.round((uploadTelemetry.bytesUploaded / uploadTelemetry.totalBytes) * 100) : 0}%)
          </div>
          <div style={{ color: "var(--secondary, #ffe600)", fontWeight: 700 }}>
            <strong>ETA:</strong> {formatEta(uploadTelemetry.etaSeconds)}
          </div>
        </div>
      )}

      {!backendMode && (
        <div className="bulk-blocked" role="status">Connect backend mode to create a durable batch. Local draft mode does not upload bulk files.</div>
      )}

      <div
        className={`bulk-dropzone ${isDragging ? "is-dragging" : ""} ${submitted ? "is-locked" : ""}`}
        onDragOver={(event) => { event.preventDefault(); if (!submitted) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); if (!submitted) void addFiles(event.dataTransfer.files); }}
      >
        <span className="material-symbols-outlined" aria-hidden="true">photo_library</span>
        <strong>{submitted ? `BATCH ${batchId}` : "DROP IMAGES HERE"}</strong>
        <span>{submitted ? "This batch is locked; resume or retry its durable progress below." : "or choose multiple PNG, JPEG, GIF, WebP, or AVIF files"}</span>
        {(!submitted || items.some((item) => item.server && item.server.upload_state !== "uploaded")) && <button type="button" className="brutalist-border-sm bulk-choose-button" onClick={() => inputRef.current?.click()}>{submitted ? "Re-select pending files" : "Choose images"}</button>}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" multiple hidden onChange={(event) => { void addFiles(event.target.files || []); event.target.value = ""; }} />
      </div>

      {isRestoring && <p className="bulk-progress-note">Restoring saved server progress…</p>}
      {invalidCount > 0 && <p className="bulk-error-summary" role="alert">{invalidCount} file{invalidCount === 1 ? "" : "s"} need attention before confirmation.</p>}

      {items.length > 0 && (
        <div className="bulk-review-table" role="region" aria-label="Bulk image review" tabIndex={0}>
          <div className="bulk-review-header"><span>Preview / filename</span><span>Title</span><span>Size / type</span><span>Stable ID / state</span><span>Action</span></div>
          {items.map((item) => (
            <article className="bulk-review-row" key={item.clientItemId}>
              <div className="bulk-file-cell">
                {item.previewUrl ? <img src={item.previewUrl} alt="" /> : <div className="bulk-no-preview" aria-hidden="true">IMG</div>}
                <div><strong title={item.fileName}>{item.fileName}</strong><small>{item.contentHash.slice(0, 16)}…</small></div>
              </div>
              <label className="bulk-title-cell"><span className="sr-only">Title for {item.fileName}</span><input className="brutalist-input" value={item.title} disabled={submitted} onChange={(event) => updateTitle(item.clientItemId, event.target.value)} /></label>
              <div className="bulk-meta-cell"><strong>{formatBytes(item.byteSize)}</strong><span>{item.mimeType || "unknown"}</span>{item.validationErrors.map((error) => <em key={error}>{error}</em>)}</div>
              <div className="bulk-state-cell"><code>{item.memeId}</code><span className={`bulk-state ${statusClass(item)}`}>{statusForItem(item)}</span>{item.duplicateWarning && <em className="bulk-warning">⚠ {item.duplicateWarning}</em>}{item.server?.error_message && <em className="bulk-error">{item.server.error_message}</em>}<div className="bulk-ai-states">{(item.server?.evaluations || []).map((evaluation) => <span key={evaluation.judge_key}>{evaluation.judge_key.toUpperCase()}: {evaluation.state}</span>)}</div></div>
              <div className="bulk-item-actions">{!submitted && <button type="button" className="brutalist-border-sm bulk-remove-button" onClick={() => removeItem(item.clientItemId)}>Remove</button>}</div>
            </article>
          ))}
        </div>
      )}

      <div className="bulk-actions">
        {!submitted ? (
          <button
            type="button"
            className="btn-primary brutalist-border brutalist-shadow-black brutalist-interactive"
            disabled={isWorking || !canConfirmBulk(items) || totalBytes > BULK_MAX_BATCH_BYTES || !backendMode}
            onClick={() => void confirmBatch()}
          >
            {isWorking ? "Uploading…" : "Confirm & Upload Batch"}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="brutalist-border-sm bulk-secondary-button"
              disabled={isWorking}
              onClick={() => void resumeBatch()}
            >
              {isWorking ? "Processing…" : "Resume pending items"}
            </button>
            {failedItems.length > 0 && (
              <button
                type="button"
                className="brutalist-border-sm bulk-retry-button"
                disabled={isWorking}
                onClick={() => void retryFailed()}
              >
                Retry failed ({failedItems.length})
              </button>
            )}
            <button
              type="button"
              className="brutalist-border-sm bulk-secondary-button"
              disabled={isWorking}
              onClick={startNewBatch}
            >
              Start new batch
            </button>
            <button
              type="button"
              className="brutalist-border-sm bulk-retry-button"
              style={{ background: "var(--danger, #ff3366)", color: "#fff" }}
              disabled={isWorking}
              onClick={() => void purgeCurrentBatch()}
            >
              🗑️ Purge Batch
            </button>
          </>
        )}
      </div>

      {batchStatus && <div className="bulk-batch-footer"><strong>Batch status: {batchStatus.batch.status.toUpperCase()}</strong><span>{readyCount}/{batchStatus.batch.total_items} human-ready</span><span>{batchStatus.batch.failed_items} failed</span><span>Refresh-safe server progress is stored in D1. Failed local uploads need the file selected again.</span></div>}
      <p className="bulk-footnote">Images only · max {formatBytes(BULK_MAX_FILE_BYTES)} per file · no upload publishes content or creates a human vote.</p>
    </section>
  );
}
