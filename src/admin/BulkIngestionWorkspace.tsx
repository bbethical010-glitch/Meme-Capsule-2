import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createIngestionBatch,
  deleteIngestionBatch,
  getIngestionBatch,
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
  onOpenVault?: () => void;
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

const uploadStateLabel = (item: BulkDraftItem) => {
  if (!item.server) return "READY TO UPLOAD";
  if (item.server.upload_state === "uploading") return "UPLOADING...";
  if (item.server.upload_state === "uploaded") return "✓ UPLOADED (DRAFT)";
  if (item.server.upload_state === "failed") return "UPLOAD FAILED";
  return "PENDING";
};

const uploadStateClass = (item: BulkDraftItem) => {
  if (!item.server) return "badge-pending";
  if (item.server.upload_state === "uploading") return "badge-uploading";
  if (item.server.upload_state === "uploaded") return "badge-uploaded";
  if (item.server.upload_state === "failed") return "badge-failed";
  return "badge-pending";
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

const runBounded = async <T,>(values: T[], worker: (value: T) => Promise<void>, concurrency = 6) => {
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
  onBackendChanged,
  onOpenVault
}: BulkIngestionWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BulkDraftItem[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<IngestionBatchStatus | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [brokenPreviews, setBrokenPreviews] = useState<Set<string>>(new Set());
  const [uploadTelemetry, setUploadTelemetry] = useState<{
    bytesUploaded: number;
    totalBytes: number;
    speedBps: number;
    etaSeconds: number;
    isActive: boolean;
    isComplete: boolean;
  }>({
    bytesUploaded: 0,
    totalBytes: 0,
    speedBps: 0,
    etaSeconds: 0,
    isActive: false,
    isComplete: false
  });
  const activeUploadBytesRef = useRef<Map<string, number>>(new Map());
  const completedUploadBytesRef = useRef<number>(0);
  const uploadStartTimeRef = useRef<number>(0);
  const totalTargetBytesRef = useRef<number>(0);
  const smoothedSpeedRef = useRef<number>(0);
  const lastSampleRef = useRef<{ time: number; loaded: number }>({ time: 0, loaded: 0 });
  const itemsRef = useRef(items);
  const batchStatusRef = useRef<IngestionBatchStatus | null>(null);

  const submitted = Boolean(batchId);
  const totalBytes = useMemo(() => totalDraftBytes(items), [items]);
  const invalidCount = useMemo(() => items.filter((item) => item.validationErrors.length > 0).length, [items]);

  // Decoupled upload counts - strictly file and media ingestion
  const uploadedCount = useMemo(
    () => items.filter((item) => item.server?.upload_state === "uploaded").length,
    [items]
  );
  const failedUploadItems = useMemo(
    () => items.filter((item) => item.server && item.server.upload_state === "failed"),
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
    if (!backendMode || !adminToken.trim()) return;
    const persisted = readPersistedSession();
    if (!persisted?.batchId) return;

    setIsRestoring(true);
    setBatchId(persisted.batchId);
    getIngestionBatch(adminToken, persisted.batchId)
      .then((serverStatus) => {
        const hydrated = persisted.items.map((item) => ({
          ...item,
          file: null,
          previewUrl: "",
          validationErrors: [],
          duplicateWarning: null
        }));
        setItems(mergeServerStatus(hydrated, serverStatus));
        applyStatus(serverStatus);
        const upCount = serverStatus.items.filter((it) => it.upload_state === "uploaded").length;
        if (upCount === serverStatus.items.length && upCount > 0) {
          setUploadTelemetry({
            bytesUploaded: serverStatus.batch.total_bytes,
            totalBytes: serverStatus.batch.total_bytes,
            speedBps: 0,
            etaSeconds: 0,
            isActive: true,
            isComplete: true
          });
        }
        onNotice(`Restored intake session for batch ${persisted.batchId}.`);
      })
      .catch(() => onNotice("Saved intake progress could not be loaded."))
      .finally(() => setIsRestoring(false));
  }, [adminToken, backendMode, onNotice, applyStatus]);

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
      onNotice("This batch has already completed its uploads. Click 'Start new batch' to add more memes.");
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
          server: target.server
        };
        const replaceIndex = nextItems.findIndex((item) => item.clientItemId === target.clientItemId);
        if (replaceIndex >= 0) nextItems[replaceIndex] = replacement;
      }
    } else {
      const remainingSlots = Math.max(0, BULK_MAX_ITEMS - items.length);
      if (selected.length > remainingSlots) {
        onNotice(`Only ${remainingSlots} more image${remainingSlots === 1 ? "" : "s"} can be added to this batch.`);
      }
      const acceptedFiles = selected.slice(0, remainingSlots);
      const drafts = await Promise.all(acceptedFiles.map((file) => createBulkDraftItem(file)));
      nextItems = [...items];
      for (const draft of drafts) {
        const collision = nextItems.find((candidate) => candidate.clientItemId === draft.clientItemId);
        if (collision) {
          draft.clientItemId = `${draft.clientItemId}-${crypto.randomUUID().slice(0, 8)}`;
          draft.memeId = `intake-${crypto.randomUUID().replace(/-/g, "")}`;
        }
        nextItems.push(draft);
      }
    }
    const withWarnings = applyDuplicateWarnings(nextItems);
    setItems(withWarnings);
    if (withWarnings.some((item) => item.validationErrors.length > 0)) {
      onNotice("Some files need attention before the batch can be confirmed. Video files are rejected in bulk intake.");
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

          const now = Date.now();
          const lastSample = lastSampleRef.current;
          const dt = (now - lastSample.time) / 1000;
          if (dt >= 0.25 || lastSample.time === 0) {
            const dBytes = totalLoaded - lastSample.loaded;
            const instantSpeed = dt > 0 ? Math.max(0, dBytes / dt) : 0;
            const smoothed = smoothedSpeedRef.current === 0
              ? instantSpeed
              : 0.25 * instantSpeed + 0.75 * smoothedSpeedRef.current;
            smoothedSpeedRef.current = smoothed;
            lastSampleRef.current = { time: now, loaded: totalLoaded };
          }

          const remainingBytes = Math.max(0, totalTargetBytesRef.current - totalLoaded);
          const eta = smoothedSpeedRef.current > 1024 ? Math.ceil(remainingBytes / smoothedSpeedRef.current) : 0;
          setUploadTelemetry({
            bytesUploaded: totalLoaded,
            totalBytes: totalTargetBytesRef.current,
            speedBps: smoothedSpeedRef.current,
            etaSeconds: eta,
            isActive: true,
            isComplete: false
          });
        }
      );
      completedUploadBytesRef.current += local.file.size;
      activeUploadBytesRef.current.delete(statusItem.job_id);
      applyStatus(currentStatus);
    }
  }, [adminToken, applyStatus, onNotice]);

  const uploadBatchFiles = async (status: IngestionBatchStatus) => {
    const pendingUploads = status.items.filter((item) => item.upload_state !== "uploaded");
    const totalUploadBytes = pendingUploads.reduce((sum, it) => sum + (it.byte_size || 0), 0);
    completedUploadBytesRef.current = 0;
    activeUploadBytesRef.current.clear();
    smoothedSpeedRef.current = 0;
    uploadStartTimeRef.current = Date.now();
    totalTargetBytesRef.current = totalUploadBytes;
    lastSampleRef.current = { time: Date.now(), loaded: 0 };

    if (pendingUploads.length > 0) {
      setUploadTelemetry({
        bytesUploaded: 0,
        totalBytes: totalUploadBytes,
        speedBps: 0,
        etaSeconds: 0,
        isActive: true,
        isComplete: false
      });

      await runBounded(pendingUploads, async (item) => {
        try {
          await uploadOne(item, itemsRef.current);
        } catch (error) {
          onNotice(error instanceof Error ? error.message : `Could not upload ${item.original_filename}.`);
        }
      }, UPLOAD_CONCURRENCY);

      const latestStatus = await refreshBatch(status.batch.id).catch(() => batchStatusRef.current || status);
      const uploaded = latestStatus?.items.filter((it) => it.upload_state === "uploaded").length || 0;
      const total = latestStatus?.items.length || status.items.length;

      // STICKY CONFIRMATION - stays permanently visible after completion
      setUploadTelemetry((prev) => ({
        ...prev,
        bytesUploaded: prev.totalBytes,
        speedBps: 0,
        etaSeconds: 0,
        isActive: true,
        isComplete: true
      }));

      if (uploaded === total) {
        onNotice(`✓ All ${total} memes successfully uploaded to Cloudflare R2 and registered as Drafts in D1.`);
      } else {
        onNotice(`${uploaded} of ${total} memes uploaded. Any failed network files can be retried.`);
      }

      await onBackendChanged();
      return latestStatus;
    }
    return status;
  };

  const confirmBatch = async () => {
    if (!backendMode || !adminToken.trim()) {
      onNotice("Connect the Admin backend with an API token before confirming a batch.");
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
      onNotice(`Batch ${status.batch.id} created. Uploading ${items.length} files to Cloudflare R2...`);
      await uploadBatchFiles(status);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to create the ingestion batch.");
    } finally {
      setIsWorking(false); // Controls immediately unlocked once files are in R2 and D1 drafts!
    }
  };

  const resumeBatch = async () => {
    if (!batchId) return;
    setIsWorking(true);
    try {
      const status = await refreshBatch();
      if (status) await uploadBatchFiles(status);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to resume the ingestion batch.");
    } finally {
      setIsWorking(false);
    }
  };

  const retryFailedUploads = async () => {
    if (!adminToken.trim() || failedUploadItems.length === 0) return;
    setIsWorking(true);
    try {
      const result = await retryIngestionItems(adminToken, failedUploadItems.map((item) => item.server!.job_id));
      const status = result.batches.find((candidate) => candidate.batch.id === batchId) || result.batches[0];
      if (status) {
        applyStatus(status);
        await uploadBatchFiles(status);
      }
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to reset failed upload items.");
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
      setBrokenPreviews(new Set());
      saveSession(null, []);
      setUploadTelemetry({
        bytesUploaded: 0,
        totalBytes: 0,
        speedBps: 0,
        etaSeconds: 0,
        isActive: false,
        isComplete: false
      });
      onNotice(`Batch ${batchId} purged successfully.`);
      await onBackendChanged();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Failed to purge batch.");
    } finally {
      setIsWorking(false);
    }
  };

  const purgeAllStaleBatches = async () => {
    if (!adminToken.trim()) return;
    if (!window.confirm("Purge all stale and incomplete intake batches from D1 and R2? This completely wipes abandoned drafts and resets the database intake tables.")) {
      return;
    }
    setIsWorking(true);
    try {
      const res = await deleteIngestionBatch(adminToken, "all_stale");
      onNotice(`✓ Cleared ${res.purged_jobs_count || 0} orphaned/stale intake jobs across D1.`);
      await onBackendChanged();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Failed to purge stale batches.");
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
    setBrokenPreviews(new Set());
    setUploadTelemetry({
      bytesUploaded: 0,
      totalBytes: 0,
      speedBps: 0,
      etaSeconds: 0,
      isActive: false,
      isComplete: false
    });
    saveSession(null, []);
    onNotice("Ready for fresh meme upload batch.");
  };

  return (
    <section className="bulk-ingestion-panel brutalist-border brutalist-shadow-black-lg" aria-labelledby="bulk-ingestion-heading">
      <div className="bulk-ingestion-heading">
        <div>
          <p className="bulk-kicker">INGESTION & UPLOAD PIPELINE</p>
          <h3 id="bulk-ingestion-heading">Bulk Add Memes</h3>
          <p className="bulk-description">
            Drag or select images to upload directly to Cloudflare R2 and register as D1 Drafts. Upload completes immediately upon media and draft confirmation. AI and human curation occur independently downstream.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {submitted ? (
            <button
              type="button"
              className="brutalist-border-sm bulk-secondary-button"
              style={{ fontSize: "11px", padding: "4px 8px" }}
              onClick={startNewBatch}
              title="Clear current session and start a brand new upload batch"
            >
              Start Fresh Batch
            </button>
          ) : (
            <button
              type="button"
              className="brutalist-border-sm bulk-secondary-button"
              style={{ fontSize: "11px", padding: "4px 8px", color: "var(--danger, #ff3366)" }}
              onClick={() => void purgeAllStaleBatches()}
              title="Purge all incomplete or orphaned intake batches from D1 and R2"
            >
              🧹 Wipe Stale Intake
            </button>
          )}
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
      </div>

      {uploadTelemetry.isActive && (
        <div
          className={`bulk-telemetry-container brutalist-border-sm ${uploadTelemetry.isComplete ? "is-complete" : ""}`}
          role="status"
          aria-live="polite"
        >
          <div className="bulk-telemetry-header">
            <div className="bulk-telemetry-metric">
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: uploadTelemetry.isComplete ? "var(--tertiary, #00bb77)" : "var(--primary, #00f0ff)" }}>
                {uploadTelemetry.isComplete ? "check_circle" : "bolt"}
              </span>
              <strong>{uploadTelemetry.isComplete ? "UPLOAD COMPLETE:" : "UPLOAD SPEED:"}</strong>{" "}
              {uploadTelemetry.isComplete ? "All files saved to R2 & D1 Drafts" : formatSpeed(uploadTelemetry.speedBps)}
            </div>
            <div className="bulk-telemetry-metric">
              <strong>BANDWIDTH:</strong> {formatBytes(uploadTelemetry.bytesUploaded)} / {formatBytes(uploadTelemetry.totalBytes)} (
              {uploadTelemetry.totalBytes > 0 ? Math.round((uploadTelemetry.bytesUploaded / uploadTelemetry.totalBytes) * 100) : 0}%)
            </div>
            {!uploadTelemetry.isComplete && (
              <div className="bulk-telemetry-metric" style={{ color: "var(--secondary, #ffe600)", fontWeight: 700 }}>
                <strong>ETA:</strong> {formatEta(uploadTelemetry.etaSeconds)}
              </div>
            )}
          </div>
          <div className="bulk-progress-track">
            <div
              className={`bulk-progress-fill ${uploadTelemetry.isComplete ? "is-complete" : ""}`}
              style={{
                width: `${uploadTelemetry.totalBytes > 0 ? Math.min(100, Math.round((uploadTelemetry.bytesUploaded / uploadTelemetry.totalBytes) * 100)) : 0}%`
              }}
            />
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
        <span>{submitted ? "This batch is active; start a new batch or review uploaded items below." : "or choose multiple PNG, JPEG, GIF, WebP, AVIF, or HEIC files"}</span>
        {(!submitted || items.some((item) => item.server && item.server.upload_state !== "uploaded")) && (
          <button type="button" className="brutalist-border-sm bulk-choose-button" onClick={() => inputRef.current?.click()}>
            {submitted ? "Re-select pending files" : "Choose images"}
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/heic,image/heif,.heic,.heif,.bmp" multiple hidden onChange={(event) => { void addFiles(event.target.files || []); event.target.value = ""; }} />
      </div>

      {isRestoring && <p className="bulk-progress-note">Restoring saved server progress…</p>}
      {invalidCount > 0 && <p className="bulk-error-summary" role="alert">{invalidCount} file{invalidCount === 1 ? "" : "s"} need attention before confirmation.</p>}

      {items.length > 0 && (
        <div className="bulk-review-table" role="region" aria-label="Bulk image review" tabIndex={0}>
          <div className="bulk-review-header">
            <span>Preview / filename</span>
            <span>Title</span>
            <span>Size / type</span>
            <span>Stable ID / Upload Status</span>
            <span>Action</span>
          </div>
          {items.map((item) => (
            <article className="bulk-review-row" key={item.clientItemId}>
              <div className="bulk-file-cell">
                {item.previewUrl && !brokenPreviews.has(item.clientItemId) ? (
                  <img
                    src={item.previewUrl}
                    alt=""
                    onError={() => setBrokenPreviews((prev) => new Set(prev).add(item.clientItemId))}
                  />
                ) : (
                  <div className="bulk-no-preview" aria-hidden="true" title={item.mimeType}>
                    {item.mimeType.includes("heic") || item.mimeType.includes("heif") ? "HEIC" : "IMG"}
                  </div>
                )}
                <div className="bulk-file-cell-info">
                  <strong title={item.fileName}>{item.fileName}</strong>
                  <small title={item.contentHash}>{item.contentHash.slice(0, 16)}…</small>
                </div>
              </div>
              <label className="bulk-title-cell">
                <span className="sr-only">Title for {item.fileName}</span>
                <input
                  className="brutalist-input"
                  title={item.title}
                  value={item.title}
                  disabled={submitted}
                  onChange={(event) => updateTitle(item.clientItemId, event.target.value)}
                />
              </label>
              <div className="bulk-meta-cell">
                <strong>{formatBytes(item.byteSize)}</strong>
                <span>{item.mimeType || "unknown"}</span>
                {item.validationErrors.map((error) => <em key={error}>{error}</em>)}
              </div>
              <div className="bulk-state-cell">
                <code>{item.memeId}</code>
                <div className="bulk-badge-group">
                  <span className={`bulk-badge ${uploadStateClass(item)}`}>{uploadStateLabel(item)}</span>
                  {item.server?.state === "human_ready" && (
                    <span className="bulk-ai-badge ai-ready" title="Promoted to archived in curation pipeline">
                      ARCHIVED (HUMAN READY)
                    </span>
                  )}
                </div>
                {item.duplicateWarning && <em className="bulk-warning">⚠ {item.duplicateWarning}</em>}
                {item.server?.upload_state === "failed" && item.server?.error_message && (
                  <em className="bulk-error">{item.server.error_message}</em>
                )}
              </div>
              <div className="bulk-item-actions">
                {!submitted && (
                  <button type="button" className="brutalist-border-sm bulk-remove-button" onClick={() => removeItem(item.clientItemId)}>
                    Remove
                  </button>
                )}
              </div>
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
            {isWorking ? "Uploading…" : `Confirm & Upload Batch (${items.length} Files)`}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-primary brutalist-border brutalist-shadow-black brutalist-interactive"
              disabled={isWorking}
              onClick={startNewBatch}
            >
              Start New Batch
            </button>
            {onOpenVault && (
              <button
                type="button"
                className="brutalist-border-sm bulk-secondary-button"
                style={{ borderColor: "var(--primary, #00f0ff)", color: "var(--primary, #00f0ff)", fontWeight: 700 }}
                onClick={onOpenVault}
                title="View newly ingested drafts in the Meme Vault"
              >
                Open Drafts in Meme Vault ↗
              </button>
            )}
            {failedUploadItems.length > 0 && (
              <button
                type="button"
                className="brutalist-border-sm bulk-retry-button"
                disabled={isWorking}
                onClick={() => void retryFailedUploads()}
              >
                Retry Failed Uploads ({failedUploadItems.length})
              </button>
            )}
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

      {batchStatus && (
        <div className="bulk-batch-footer">
          <strong>Batch status: {batchStatus.batch.status.toUpperCase()}</strong>
          <span>Uploaded: {uploadedCount}/{items.length} (drafts)</span>
          {failedUploadItems.length > 0 && (
            <span style={{ color: "#ff3366", fontWeight: 700 }}>
              {failedUploadItems.length} upload(s) failed
            </span>
          )}
          <span>Refresh-safe server progress is stored in D1. Ingested memes are stored as Drafts and immediately available in Meme Vault and Curation.</span>
        </div>
      )}
      <p className="bulk-footnote">Images only · max {formatBytes(BULK_MAX_FILE_BYTES)} per file · no upload publishes content or creates a human vote.</p>
    </section>
  );
}
