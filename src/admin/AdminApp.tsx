import {
  Menu,
  Pin,
  PinOff
} from "lucide-react";
import React, { ChangeEvent, FormEvent, useMemo, useState, useEffect, useCallback } from "react";
import {
  archiveBackendMeme,
  fetchVaultMemes,
  listBackendMemes,
  saveBackendMeme,
  syncR2ToD1,
  uploadBackendMemeFile,
  hardDeleteBackendMemes,
  type VaultViewMode,
  type VaultQueryParams,
  type VaultStats,
  type VaultPagination
} from "../lib/adminApi";
import {
  AdminMeme,
  detectMediaType,
  emptyAdminMeme,
  normalizeAdminMeme,
  parseTags,
  readAdminCollection,
  serializeTags,
  writeAdminCollection
} from "../lib/adminCollection";
import type { MemeInputMethod, MemeStatus, Rarity } from "../types";
import SqlRunner from "./sql-runner/SqlRunner";
import PushNotifications from "./PushNotifications";
import ScheduledNotifications from "./ScheduledNotifications";
import BulkIngestionWorkspace from "./BulkIngestionWorkspace";
import "./admin.css";

type FormState = Omit<AdminMeme, "tags"> & {
  tags: string;
};

const ADMIN_TOKEN_KEY = "meme-capsule:admin-api-token";
const PAGE_SIZE = 25;

const toFormState = (meme: AdminMeme): FormState => ({
  ...meme,
  tags: serializeTags(meme.tags)
});

const fromFormState = (form: FormState): AdminMeme =>
  normalizeAdminMeme({
    ...form,
    tags: parseTags(form.tags),
    media_type: form.media_type || detectMediaType(form.url)
  });

interface MemeRowProps {
  meme: AdminMeme;
  backendMode: boolean;
  onEdit: (meme: AdminMeme) => void;
  onDelete: (id: string) => void;
  onInspect: (meme: AdminMeme) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isArchivedView?: boolean;
  onHardDelete?: (id: string) => void;
}

// 1. Detailed Row Mode
const MemeRow = React.memo(function MemeRow({
  meme,
  backendMode,
  onEdit,
  onDelete,
  onInspect,
  isSelected,
  onToggleSelect,
  isArchivedView,
  onHardDelete
}: MemeRowProps) {
  return (
    <div
      className={`collection-row brutalist-border brutalist-shadow-black brutalist-interactive ${isSelected ? 'selected' : ''}`}
      onClick={() => onInspect(meme)}
    >
      <div className="row-select" onClick={(e) => e.stopPropagation()}>
        <input 
          type="checkbox" 
          checked={isSelected || false} 
          onChange={() => onToggleSelect && onToggleSelect(meme.id)} 
        />
      </div>
      <div className="thumb brutalist-border-sm">
        {meme.media_type === "video" ? (
          <video src={meme.url} muted preload="metadata" />
        ) : (
          <img src={meme.url} alt={meme.title || "Meme preview"} loading="lazy" />
        )}
        <div className="overlay"></div>
        {!meme.url && <span className="material-symbols-outlined" style={{ zIndex: 2 }}>image</span>}
      </div>
      <div className="collection-meta">
        <h4 style={{ textDecoration: meme.status === "archived" || meme.curation_status === "excluded" ? "line-through" : "none" }}>
          {meme.title || "Untitled Meme"}
        </h4>
        <div className="badge-row">
          {meme.curation_status === "excluded" ? (
            <span className="badge brutalist-border-sm excluded">EXCLUDED</span>
          ) : (
            <span className={`badge brutalist-border-sm ${meme.status}`}>{meme.status}</span>
          )}
          {Boolean((meme as any).is_nsfw) && (
            <span
              className="badge brutalist-border-sm nsfw"
              style={{ background: "#dd0061", color: "#ffffff", borderColor: "#dd0061", fontWeight: 700 }}
            >
              NSFW
            </span>
          )}
          <span className="likes-count">
            <span className="material-symbols-outlined">favorite</span> {meme.likes_count ?? 0}
          </span>
        </div>
        <p className="row-id">ID: {meme.id}</p>
      </div>
      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="brutalist-border-sm"
          onClick={() => onInspect(meme)}
          title="Inspect contextual metadata"
        >
          <span className="material-symbols-outlined">visibility</span> Inspect
        </button>
        <button
          type="button"
          className="brutalist-border-sm"
          onClick={() => onEdit(meme)}
          title="Edit metadata in form"
        >
          <span className="material-symbols-outlined">edit</span> Edit
        </button>
        <button
          type="button"
          className="delete-btn brutalist-border-sm"
          onClick={() => onDelete(meme.id)}
          title={backendMode ? "Archive meme" : "Delete meme"}
        >
          <span className="material-symbols-outlined">{backendMode ? "archive" : "delete"}</span>
          {backendMode ? "Archv" : "Del"}
        </button>
        {isArchivedView && onHardDelete && backendMode && (
          <button
            type="button"
            className="delete-btn brutalist-border-sm"
            style={{ backgroundColor: "#ff2a2a", color: "#fff" }}
            onClick={() => onHardDelete(meme.id)}
            title="Permanently purge from R2 and database"
          >
            <span className="material-symbols-outlined">delete_forever</span>
            Hard Del
          </button>
        )}
      </div>
    </div>
  );
});

// 2. Dense Compact Scanner Mode
const MemeCompactRow = React.memo(function MemeCompactRow({
  meme,
  backendMode,
  onEdit,
  onDelete,
  onInspect,
  isSelected,
  onToggleSelect,
  isArchivedView,
  onHardDelete
}: MemeRowProps) {
  return (
    <div
      className={`vault-compact-row brutalist-interactive ${isSelected ? "selected" : ""}`}
      onClick={() => onInspect(meme)}
    >
      <input
        type="checkbox"
        checked={isSelected || false}
        onChange={(e) => {
          e.stopPropagation();
          onToggleSelect && onToggleSelect(meme.id);
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="vault-compact-thumb brutalist-border-sm">
        {meme.media_type === "video" ? (
          <video src={meme.url} muted preload="metadata" />
        ) : (
          <img src={meme.url} alt="" loading="lazy" />
        )}
      </div>
      <span className="vault-compact-id">{meme.id}</span>
      <span
        className="vault-compact-title"
        style={{
          textDecoration: meme.status === "archived" || meme.curation_status === "excluded" ? "line-through" : "none"
        }}
      >
        {meme.title || "Untitled Meme"}
      </span>
      {Boolean((meme as any).is_nsfw) && (
        <span
          className="badge brutalist-border-sm nsfw"
          style={{ background: "#dd0061", color: "#fff", fontSize: "9px", padding: "1px 4px" }}
        >
          18+
        </span>
      )}
      <span
        className={`vault-compact-badge badge brutalist-border-sm ${meme.curation_status === "excluded" ? "excluded" : meme.status}`}
      >
        {meme.curation_status === "excluded" ? "EXCL" : meme.status.slice(0, 4)}
      </span>
      <span className="likes-count" style={{ fontSize: "11px", minWidth: "40px" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>favorite</span> {meme.likes_count ?? 0}
      </span>
      <div style={{ display: "flex", gap: "2px", marginLeft: "auto" }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="brutalist-border-sm"
          style={{ padding: "2px 6px", fontSize: "10px", background: "var(--surface)" }}
          onClick={() => onInspect(meme)}
          title="Inspect details"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>visibility</span>
        </button>
        <button
          type="button"
          className="brutalist-border-sm"
          style={{ padding: "2px 6px", fontSize: "10px", background: "var(--surface)" }}
          onClick={() => onEdit(meme)}
          title="Edit meme"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>edit</span>
        </button>
        <button
          type="button"
          className="delete-btn brutalist-border-sm"
          style={{ padding: "2px 6px", fontSize: "10px" }}
          onClick={() => onDelete(meme.id)}
          title={backendMode ? "Archive meme" : "Delete meme"}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>{backendMode ? "archive" : "delete"}</span>
        </button>
        {isArchivedView && onHardDelete && backendMode && (
          <button
            type="button"
            className="delete-btn brutalist-border-sm"
            style={{ padding: "2px 6px", fontSize: "10px", background: "#ff2a2a", color: "#fff" }}
            onClick={() => onHardDelete(meme.id)}
            title="Permanently hard-delete"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>delete_forever</span>
          </button>
        )}
      </div>
    </div>
  );
});

// 3. Grid Card Gallery Mode
const MemeGridCard = React.memo(function MemeGridCard({
  meme,
  backendMode,
  onEdit,
  onDelete,
  onInspect,
  isSelected,
  onToggleSelect,
  isArchivedView,
  onHardDelete
}: MemeRowProps) {
  return (
    <div
      className={`vault-grid-card brutalist-border brutalist-shadow-black brutalist-interactive ${isSelected ? "selected" : ""}`}
      onClick={() => onInspect(meme)}
    >
      <div className="vault-grid-thumb">
        <div className="vault-grid-checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected || false}
            onChange={() => onToggleSelect && onToggleSelect(meme.id)}
          />
        </div>
        <div className="vault-grid-badges">
          {meme.curation_status === "excluded" ? (
            <span className="badge brutalist-border-sm excluded">EXCLUDED</span>
          ) : (
            <span className={`badge brutalist-border-sm ${meme.status}`}>{meme.status}</span>
          )}
          {Boolean((meme as any).is_nsfw) && (
            <span
              className="badge brutalist-border-sm nsfw"
              style={{ background: "#dd0061", color: "#ffffff", borderColor: "#dd0061", fontWeight: 700 }}
            >
              NSFW
            </span>
          )}
        </div>
        {meme.media_type === "video" ? (
          <video src={meme.url} muted preload="metadata" />
        ) : (
          <img src={meme.url} alt={meme.title || "Preview"} loading="lazy" />
        )}
      </div>

      <div className="vault-grid-body">
        <h4
          className="vault-grid-title"
          style={{
            textDecoration: meme.status === "archived" || meme.curation_status === "excluded" ? "line-through" : "none"
          }}
        >
          {meme.title || "Untitled Meme"}
        </h4>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="vault-grid-id">ID: {meme.id}</span>
          <span className="likes-count">
            <span className="material-symbols-outlined">favorite</span> {meme.likes_count ?? 0}
          </span>
        </div>
      </div>

      <div className="vault-grid-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="brutalist-border-sm"
          style={{ flex: 1, padding: "4px", fontSize: "10px", background: "var(--surface)" }}
          onClick={() => onInspect(meme)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "13px", verticalAlign: "middle" }}>visibility</span> Details
        </button>
        <button
          type="button"
          className="brutalist-border-sm"
          style={{ flex: 1, padding: "4px", fontSize: "10px", background: "var(--surface)" }}
          onClick={() => onEdit(meme)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "13px", verticalAlign: "middle" }}>edit</span> Edit
        </button>
        <button
          type="button"
          className="delete-btn brutalist-border-sm"
          style={{ padding: "4px 8px", fontSize: "10px" }}
          onClick={() => onDelete(meme.id)}
          title={backendMode ? "Archive" : "Delete"}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>{backendMode ? "archive" : "delete"}</span>
        </button>
        {isArchivedView && onHardDelete && backendMode && (
          <button
            type="button"
            className="delete-btn brutalist-border-sm"
            style={{ padding: "4px 8px", fontSize: "10px", backgroundColor: "#ff2a2a", color: "#fff" }}
            onClick={() => onHardDelete(meme.id)}
            title="Hard Delete"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>delete_forever</span>
          </button>
        )}
      </div>
    </div>
  );
});

// 4. Data Sheet Table Mode
const MemeTableView = React.memo(function MemeTableView({
  memes,
  backendMode,
  onEdit,
  onDelete,
  onInspect,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  isArchivedView,
  onHardDelete
}: {
  memes: AdminMeme[];
  backendMode: boolean;
  onEdit: (meme: AdminMeme) => void;
  onDelete: (id: string) => void;
  onInspect: (meme: AdminMeme) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  isArchivedView?: boolean;
  onHardDelete?: (id: string) => void;
}) {
  const allSelected = memes.length > 0 && selectedIds.size === memes.length;

  return (
    <div className="vault-table-container custom-scrollbar">
      <table className="vault-table">
        <thead>
          <tr>
            <th style={{ width: "36px" }}>
              <input type="checkbox" checked={allSelected} onChange={onSelectAll} />
            </th>
            <th style={{ width: "50px" }}>Media</th>
            <th style={{ width: "130px" }}>ID</th>
            <th>Title</th>
            <th style={{ width: "90px" }}>Pipeline</th>
            <th style={{ width: "90px" }}>Curation</th>
            <th style={{ width: "60px" }}>NSFW</th>
            <th style={{ width: "70px" }}>Likes</th>
            <th style={{ width: "140px", textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {memes.map((m) => {
            const isSelected = selectedIds.has(m.id);
            return (
              <tr
                key={m.id}
                className={isSelected ? "selected" : ""}
                onClick={() => onInspect(m)}
                style={{ cursor: "pointer" }}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(m.id)}
                  />
                </td>
                <td>
                  <div className="vault-compact-thumb brutalist-border-sm">
                    {m.media_type === "video" ? (
                      <video src={m.url} muted preload="metadata" />
                    ) : (
                      <img src={m.url} alt="" loading="lazy" />
                    )}
                  </div>
                </td>
                <td style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--outline)" }}>
                  {m.id}
                </td>
                <td
                  style={{
                    fontWeight: 700,
                    textTransform: "uppercase",
                    textDecoration: m.status === "archived" || m.curation_status === "excluded" ? "line-through" : "none"
                  }}
                >
                  {m.title || "Untitled"}
                </td>
                <td>
                  <span className={`badge brutalist-border-sm ${m.status}`}>
                    {m.status}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge brutalist-border-sm ${m.curation_status === "excluded" ? "excluded" : "archived"}`}
                  >
                    {m.curation_status || "UNRESOLVED"}
                  </span>
                </td>
                <td>
                  {Boolean((m as any).is_nsfw) ? (
                    <span
                      className="badge brutalist-border-sm nsfw"
                      style={{ background: "#dd0061", color: "#fff", fontSize: "9px" }}
                    >
                      18+
                    </span>
                  ) : (
                    <span style={{ color: "var(--outline)", fontSize: "11px" }}>SFW</span>
                  )}
                </td>
                <td style={{ fontSize: "11px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "12px", verticalAlign: "middle" }}>favorite</span> {m.likes_count ?? 0}
                </td>
                <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="brutalist-border-sm"
                      style={{ padding: "2px 6px", fontSize: "10px", background: "var(--surface)" }}
                      onClick={() => onInspect(m)}
                      title="Inspect"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>visibility</span>
                    </button>
                    <button
                      type="button"
                      className="brutalist-border-sm"
                      style={{ padding: "2px 6px", fontSize: "10px", background: "var(--surface)" }}
                      onClick={() => onEdit(m)}
                      title="Edit"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>edit</span>
                    </button>
                    <button
                      type="button"
                      className="delete-btn brutalist-border-sm"
                      style={{ padding: "2px 6px", fontSize: "10px" }}
                      onClick={() => onDelete(m.id)}
                      title={backendMode ? "Archive" : "Delete"}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>{backendMode ? "archive" : "delete"}</span>
                    </button>
                    {isArchivedView && onHardDelete && backendMode && (
                      <button
                        type="button"
                        className="delete-btn brutalist-border-sm"
                        style={{ padding: "2px 6px", fontSize: "10px", background: "#ff2a2a", color: "#fff" }}
                        onClick={() => onHardDelete(m.id)}
                        title="Hard Delete"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>delete_forever</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

// Contextual Details Panel (Inspector)
interface ContextualDetailsPanelProps {
  meme: AdminMeme;
  onClose?: () => void;
  isSplitView?: boolean;
  onEdit: (meme: AdminMeme) => void;
  onArchive: (id: string) => void;
  onHardDelete?: (id: string) => void;
  onToggleNsfw: (meme: AdminMeme) => void;
  backendMode: boolean;
}

const ContextualDetailsPanel: React.FC<ContextualDetailsPanelProps> = ({
  meme,
  onClose,
  isSplitView,
  onEdit,
  onArchive,
  onHardDelete,
  onToggleNsfw,
  backendMode
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(meme.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isNsfw = Boolean((meme as any).is_nsfw);

  return (
    <div className="contextual-panel brutalist-border brutalist-shadow-black">
      <div className="contextual-header">
        <div>
          <h3 className="contextual-title">Meme Inspector</h3>
          <span style={{ fontSize: "10px", color: "var(--outline)", textTransform: "uppercase" }}>
            Contextual Metadata & Lifecycle
          </span>
        </div>
        {onClose && !isSplitView && (
          <button
            type="button"
            onClick={onClose}
            className="brutalist-border-sm"
            style={{ padding: "4px 8px", background: "var(--surface-container-high)", cursor: "pointer" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
          </button>
        )}
      </div>

      {/* Media Preview */}
      <div className="contextual-preview brutalist-border-sm">
        {meme.media_type === "video" ? (
          <video src={meme.url} controls muted style={{ maxWidth: "100%", maxHeight: "240px" }} />
        ) : (
          <img src={meme.url} alt={meme.title || "Preview"} style={{ maxWidth: "100%", maxHeight: "240px" }} />
        )}
      </div>

      {/* Immutable ID Block */}
      <div className="contextual-id-block brutalist-border-sm">
        <div>
          <span style={{ color: "var(--outline)", fontSize: "10px", display: "block" }}>
            PERMANENT IDENTIFIER (IMMUTABLE)
          </span>
          <strong style={{ fontSize: "13px", color: "var(--primary)" }}>{meme.id}</strong>
        </div>
        <button
          type="button"
          onClick={handleCopyId}
          className="brutalist-border-sm brutalist-interactive"
          style={{
            padding: "4px 8px",
            fontSize: "11px",
            fontWeight: 700,
            background: copied ? "var(--secondary)" : "var(--surface)",
            color: copied ? "var(--on-secondary)" : "var(--on-surface)",
            cursor: "pointer"
          }}
        >
          {copied ? "✓ COPIED" : "📋 COPY ID"}
        </button>
      </div>

      {/* 2-Tier Lifecycle Matrix */}
      <div className="contextual-matrix">
        <div className="contextual-matrix-tile">
          <label>Pipeline Status</label>
          <span className={`badge brutalist-border-sm ${meme.status}`}>
            {meme.status}
          </span>
        </div>
        <div className="contextual-matrix-tile">
          <label>Curation Resolution</label>
          <span
            className={`badge brutalist-border-sm ${meme.curation_status === "excluded" ? "excluded" : "active"}`}
            style={meme.curation_status === "excluded" ? { background: "#ff3b30", color: "#fff" } : {}}
          >
            {meme.curation_status || "PENDING"}
          </span>
        </div>
      </div>

      {/* NSFW Tagging Toggle */}
      <div
        className="brutalist-border-sm"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: isNsfw ? "rgba(221, 0, 97, 0.15)" : "var(--surface-container-low)",
          borderLeft: isNsfw ? "4px solid #dd0061" : "4px solid var(--outline)"
        }}
      >
        <div>
          <span style={{ fontSize: "10px", color: "var(--outline)", textTransform: "uppercase", display: "block" }}>
            Content Rating
          </span>
          <span style={{ fontWeight: 700, fontSize: "12px", color: isNsfw ? "#dd0061" : "var(--on-surface)" }}>
            {isNsfw ? "🔞 18+ NSFW FLAGGED" : "🛡️ SFW (SAFE FOR WORK)"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onToggleNsfw(meme)}
          className="brutalist-border-sm brutalist-interactive"
          style={{
            padding: "4px 10px",
            fontSize: "10px",
            fontWeight: 700,
            background: isNsfw ? "#dd0061" : "var(--surface)",
            color: isNsfw ? "#fff" : "var(--on-surface)",
            cursor: "pointer"
          }}
        >
          {isNsfw ? "REMOVE NSFW" : "FLAG AS NSFW"}
        </button>
      </div>

      {/* Taxonomy & Properties */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--outline)" }}>Category:</span>
          <strong style={{ textTransform: "uppercase" }}>{meme.category || "Unsorted"}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--outline)" }}>Media Type:</span>
          <span style={{ textTransform: "uppercase" }}>{meme.media_type}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--outline)" }}>Rarity:</span>
          <span>{meme.rarity}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--outline)" }}>Engagement:</span>
          <span>❤️ {meme.likes_count ?? 0} likes</span>
        </div>
        {meme.storage_path && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ color: "var(--outline)", fontSize: "10px" }}>R2 Storage Key:</span>
            <code style={{ fontSize: "10px", wordBreak: "break-all", background: "var(--surface-container-highest)", padding: "2px 4px" }}>
              {meme.storage_path}
            </code>
          </div>
        )}
        {meme.tags && meme.tags.length > 0 && (
          <div style={{ marginTop: "4px" }}>
            <span style={{ color: "var(--outline)", fontSize: "10px", display: "block", marginBottom: "4px" }}>TAGS:</span>
            <div className="contextual-tags">
              {meme.tags.map((t, idx) => (
                <span key={idx} className="contextual-tag-chip brutalist-border-sm">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="contextual-actions">
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className="btn-primary brutalist-border-sm brutalist-interactive"
            style={{ flex: 1, padding: "8px", fontSize: "11px", display: "flex", justifyContent: "center", alignItems: "center", gap: "4px" }}
            onClick={() => onEdit(meme)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
            Edit in Form
          </button>
          <a
            href={meme.url}
            target="_blank"
            rel="noopener noreferrer"
            className="brutalist-border-sm brutalist-interactive"
            style={{
              padding: "8px 12px",
              background: "var(--surface)",
              color: "var(--primary)",
              textDecoration: "none",
              fontSize: "11px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>open_in_new</span>
            R2 Link
          </a>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className="delete-btn brutalist-border-sm"
            style={{ flex: 1, padding: "6px", fontSize: "11px" }}
            onClick={() => onArchive(meme.id)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "14px", verticalAlign: "middle" }}>
              {backendMode ? "archive" : "delete"}
            </span>{" "}
            {backendMode ? "Archive Meme" : "Delete Draft"}
          </button>
          {backendMode && onHardDelete && (
            <button
              type="button"
              className="delete-btn brutalist-border-sm"
              style={{ flex: 1, padding: "6px", fontSize: "11px", background: "#ff2a2a", color: "#fff" }}
              onClick={() => onHardDelete(meme.id)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "14px", verticalAlign: "middle" }}>delete_forever</span> Hard Purge
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function AdminApp() {
  const [collection, setCollection] = useState<AdminMeme[]>(() => readAdminCollection());
  const [form, setForm] = useState<FormState>(() => toFormState(emptyAdminMeme()));
  const [editingOriginalId, setEditingOriginalId] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState(() => window.sessionStorage.getItem(ADMIN_TOKEN_KEY) || "");
  const [backendMode, setBackendMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncActionName, setSyncActionName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [, setBackendActiveCount] = useState<number | null>(null);
  const [, setBackendConfig] = useState<{ hasR2PublicUrl?: boolean; hasDatabase?: boolean }>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<"vault" | "add" | "sql" | "notifications">("vault");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Five Vault View Modes state with persistent localStorage
  const [vaultViewMode, setVaultViewMode] = useState<VaultViewMode>(() => {
    return (window.localStorage.getItem("meme_vault_view_mode") as VaultViewMode) || "rows";
  });
  const [inspectedMeme, setInspectedMeme] = useState<AdminMeme | null>(null);

  // Server-side Filtering, Sorting & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "archived" | "excluded" | "nsfw">("all");
  const [sortBy, setSortBy] = useState<string>("uploaded_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Server stats & pagination metadata
  const [serverStats, setServerStats] = useState<VaultStats | null>(null);
  const [serverPagination, setServerPagination] = useState<VaultPagination | null>(null);

  const handleSetVaultViewMode = (mode: VaultViewMode) => {
    setVaultViewMode(mode);
    window.localStorage.setItem("meme_vault_view_mode", mode);
  };

  // Clear selections when filter or search changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, searchTerm]);

  // Initial load
  useEffect(() => {
    if (adminToken.trim()) {
      loadBackend();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    if (backendMode && serverStats) {
      return serverStats;
    }
    let active = 0;
    let drafts = 0;
    let uncurated = 0;
    let excluded = 0;
    let nsfw = 0;
    for (const m of collection) {
      if ((m as any).is_nsfw) nsfw++;
      if (m.status === "active") active++;
      else if (m.status === "draft") drafts++;
      else if (m.curation_status === "excluded") excluded++;
      else uncurated++; // status === "archived" and not excluded
    }
    return { active, drafts, archived: uncurated, excluded, nsfw, total: collection.length };
  }, [backendMode, serverStats, collection]);

  // Client-side fallback filtered collection when in local draft mode
  const filteredCollection = useMemo(() => {
    if (backendMode) {
      return collection;
    }
    const term = searchTerm.toLowerCase().trim();
    return collection.filter((meme) => {
      if (statusFilter === "active" && meme.status !== "active") return false;
      if (statusFilter === "draft" && meme.status !== "draft") return false;
      if (statusFilter === "excluded" && meme.curation_status !== "excluded") return false;
      if (statusFilter === "archived" && (meme.status !== "archived" || meme.curation_status === "excluded")) return false;
      if (statusFilter === "nsfw" && !(meme as any).is_nsfw) return false;

      if (!term) return true;
      return (
        (meme.title && meme.title.toLowerCase().includes(term)) ||
        (meme.id && meme.id.toLowerCase().includes(term)) ||
        (meme.category && meme.category.toLowerCase().includes(term)) ||
        (meme.tags && meme.tags.some((t) => t.toLowerCase().includes(term)))
      );
    });
  }, [backendMode, collection, searchTerm, statusFilter]);

  const totalPages = useMemo(() => {
    if (backendMode && serverPagination) {
      return serverPagination.total_pages;
    }
    return Math.max(1, Math.ceil(filteredCollection.length / pageSize));
  }, [backendMode, serverPagination, filteredCollection.length, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedMemes = useMemo(() => {
    if (backendMode) {
      return collection;
    }
    const start = (currentPage - 1) * pageSize;
    return filteredCollection.slice(start, start + pageSize);
  }, [backendMode, collection, filteredCollection, currentPage, pageSize]);

  const updateCollection = (nextCollection: AdminMeme[], message: string) => {
    setCollection(nextCollection);
    writeAdminCollection(nextCollection);
    setNotice(message);
  };

  const updateForm = (key: keyof FormState, value: string | number) => {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  };

  const resetForm = () => {
    setForm(toFormState(emptyAdminMeme()));
    setEditingOriginalId(null);
  };

  const handleUrlInput = (inputMethod: MemeInputMethod, value: string) => {
    setForm((current) => ({
      ...current,
      input_method: inputMethod,
      url: value,
      storage_path: "",
      source_link: value,
      media_type: detectMediaType(value)
    }));
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (backendMode && adminToken) {
      setIsSyncing(true);
      setSyncActionName("Uploading file...");
      try {
        const uploaded = await uploadBackendMemeFile(adminToken, file);
        setForm((current) => ({
          ...current,
          title: current.title || file.name.replace(/\.[^.]+$/, ""),
          url: uploaded.url,
          storage_path: uploaded.storage_path,
          source_link: uploaded.source_link,
          input_method: "upload",
          media_type: uploaded.media_type
        }));
        setNotice("File uploaded to Cloudflare R2. Review details, then save the meme.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Backend upload failed.");
      } finally {
        setIsSyncing(false);
        setSyncActionName("");
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fileUrl = String(reader.result || "");
      setForm((current) => ({
        ...current,
        title: current.title || file.name.replace(/\.[^.]+$/, ""),
        url: fileUrl,
        storage_path: "",
        source_link: file.name,
        input_method: "upload",
        media_type: file.type.startsWith("video/") ? "video" : "image"
      }));
      setNotice("File loaded as a local draft preview.");
    };
    reader.readAsDataURL(file);
  };

  const saveToken = () => {
    window.sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
    setNotice("Admin token saved for this browser session.");
  };

  const loadBackend = useCallback(async (overrides?: Partial<VaultQueryParams>) => {
    if (!adminToken.trim()) {
      setNotice("Enter your admin API token before loading the backend.");
      return;
    }

    setIsSyncing(true);
    setSyncActionName("Connecting backend...");
    try {
      window.sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
      const params: VaultQueryParams = {
        page: overrides?.page ?? currentPage,
        per_page: overrides?.per_page ?? pageSize,
        q: overrides?.q ?? searchTerm,
        status: overrides?.status ?? statusFilter,
        sort_by: overrides?.sort_by ?? sortBy,
        sort_dir: overrides?.sort_dir ?? sortDir
      };

      const response = await fetchVaultMemes(adminToken, params);
      setCollection(response.memes.map(normalizeAdminMeme));
      setBackendConfig(response.config || {});
      setBackendMode(true);

      if (response.stats) {
        setServerStats(response.stats);
        setBackendActiveCount(response.stats.active);
      }
      if (response.pagination) {
        setServerPagination(response.pagination);
      }

      setNotice(`Backend connected. ${response.pagination?.total ?? response.memes.length} memes available.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load backend collection.");
    } finally {
      setIsSyncing(false);
      setSyncActionName("");
    }
  }, [adminToken, currentPage, pageSize, searchTerm, statusFilter, sortBy, sortDir]);

  // Trigger backend search / pagination with 350ms debounce
  useEffect(() => {
    if (!backendMode) return;
    const timer = setTimeout(() => {
      loadBackend();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, currentPage, pageSize, sortBy, sortDir, backendMode, loadBackend]);

  const handleAutoRefresh = useCallback(async () => {
    if (!adminToken.trim()) return;
    loadBackend();
  }, [adminToken, loadBackend]);

  // Intercept Ctrl+R / Cmd+R to refresh admin data without browser page reload
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        handleAutoRefresh();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleAutoRefresh]);

  const useLocalMode = () => {
    setCollection(readAdminCollection());
    setBackendMode(false);
    setServerStats(null);
    setServerPagination(null);
    setNotice("Switched to local draft mode.");
  };

  const handleSyncR2 = async () => {
    if (!adminToken.trim() || isSyncing) return;

    setIsSyncing(true);
    setSyncActionName("Syncing R2 bucket...");
    try {
      const result = await syncR2ToD1(adminToken);
      setNotice(
        `✅ ${result.message} (${result.totalR2Files} total in R2, ${result.alreadyInD1} already in D1)`
      );

      // Reload memes if new files were synced OR files were removed
      if (result.newlySynced > 0 || (result.removedCount && result.removedCount > 0)) {
        loadBackend();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "R2 sync failed.");
    } finally {
      setIsSyncing(false);
      setSyncActionName("");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const meme = fromFormState(form);

    if (!meme.url) {
      setNotice("Add a direct URL, Google Drive link, or uploaded file first.");
      return;
    }

    const idConflict = collection.some(
      (existing) => existing.id === meme.id && existing.id !== editingOriginalId
    );
    if (idConflict) {
      setNotice("That meme ID already exists. Use a unique ID before saving.");
      return;
    }

    if (backendMode) {
      if (!adminToken.trim()) {
        setNotice("Backend mode needs an admin API token.");
        return;
      }

      setIsSyncing(true);
      setSyncActionName("Saving meme...");
      try {
        const savedMeme = normalizeAdminMeme(
          await saveBackendMeme(adminToken, meme, editingOriginalId)
        );
        const nextCollection = editingOriginalId
          ? collection.map((existing) => (existing.id === editingOriginalId ? savedMeme : existing))
          : [savedMeme, ...collection];
        setCollection(nextCollection);
        
        const nextActiveCount = nextCollection.filter((m) => m.status === "active").length;
        setBackendActiveCount(nextActiveCount);

        setNotice(editingOriginalId ? "Meme saved to Cloudflare D1." : "Meme added to Cloudflare D1.");
        resetForm();
        loadBackend();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Backend save failed.");
      } finally {
        setIsSyncing(false);
        setSyncActionName("");
      }
      return;
    }

    const nextCollection = editingOriginalId
      ? collection.map((existing) => (existing.id === editingOriginalId ? meme : existing))
      : [meme, ...collection];

    updateCollection(
      nextCollection,
      editingOriginalId ? "Meme details updated." : "Meme added to collection."
    );
    resetForm();
  };

  const editMeme = useCallback((meme: AdminMeme) => {
    setEditingOriginalId(meme.id);
    setForm(toFormState(meme));
    setActiveTab("add");
    setIsMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const deleteMeme = useCallback(async (id: string) => {
    if (backendMode) {
      if (!adminToken.trim()) {
        setNotice("Backend mode needs an admin API token.");
        return;
      }

      setIsSyncing(true);
      setSyncActionName("Archiving meme...");
      try {
        const archived = normalizeAdminMeme(await archiveBackendMeme(adminToken, id));
        setCollection((current) => current.map((meme) => (meme.id === id ? archived : meme)));
        setNotice("Meme archived in Cloudflare.");
        loadBackend();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Backend archive failed.");
      } finally {
        setIsSyncing(false);
        setSyncActionName("");
      }
      if (editingOriginalId === id) {
        resetForm();
      }
      return;
    }

    updateCollection(
      collection.filter((meme) => meme.id !== id),
      "Meme deleted from local admin collection."
    );
    if (editingOriginalId === id) {
      resetForm();
    }
  }, [backendMode, adminToken, editingOriginalId, collection, loadBackend]);

  const hardDeleteMemes = useCallback(async (ids: string[]) => {
    if (!backendMode || !adminToken.trim() || ids.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to permanently delete ${ids.length} meme(s)? This will remove them from D1 metadata and delete the files from R2 forever.`)) {
      return;
    }

    setIsSyncing(true);
    setSyncActionName(`Hard deleting ${ids.length} meme(s)...`);
    try {
      const response = await hardDeleteBackendMemes(adminToken, ids);
      const idsSet = new Set(ids);
      setCollection((current) => current.filter((meme) => !idsSet.has(meme.id)));
      setSelectedIds(new Set());
      
      const deletedCount = response.deletedCount ?? ids.length;
      const failedCount = ids.length - deletedCount;
      if (failedCount > 0) {
        setNotice(`⚠️ Processed ${ids.length} meme(s): ${deletedCount} succeeded, ${failedCount} failed.`);
      } else {
        setNotice(`✅ Processed ${ids.length} meme(s): all ${deletedCount} permanently purged from R2 & database.`);
      }
      loadBackend();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Backend hard delete failed.");
    } finally {
      setIsSyncing(false);
      setSyncActionName("");
    }
  }, [backendMode, adminToken, loadBackend]);

  const handleToggleNsfw = useCallback(async (meme: AdminMeme) => {
    const nextNsfw = !(meme as any).is_nsfw;
    const updatedMeme = {
      ...meme,
      is_nsfw: nextNsfw ? 1 : 0,
      nsfw_flagged_by: nextNsfw ? "admin" : null
    };

    if (backendMode && adminToken.trim()) {
      setIsSyncing(true);
      setSyncActionName("Updating NSFW status...");
      try {
        await saveBackendMeme(adminToken, updatedMeme, meme.id);
        setCollection((curr) => curr.map((m) => (m.id === meme.id ? updatedMeme : m)));
        if (inspectedMeme?.id === meme.id) {
          setInspectedMeme(updatedMeme);
        }
        setNotice(`Meme ${meme.id} marked as ${nextNsfw ? "NSFW (18+)" : "SFW (Safe)"}.`);
        loadBackend();
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Failed to update NSFW status.");
      } finally {
        setIsSyncing(false);
        setSyncActionName("");
      }
    } else {
      updateCollection(
        collection.map((m) => (m.id === meme.id ? updatedMeme : m)),
        `Meme marked as ${nextNsfw ? "NSFW (18+)" : "SFW"}.`
      );
      if (inspectedMeme?.id === meme.id) {
        setInspectedMeme(updatedMeme);
      }
    }
  }, [backendMode, adminToken, inspectedMeme, loadBackend, collection]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === paginatedMemes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedMemes.map((m) => m.id)));
    }
  }, [paginatedMemes, selectedIds.size]);

  const exportCollection = () => {
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "meme-collection.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const selectAdminView = (view: "vault" | "add" | "sql" | "notifications") => {
    setActiveTab(view);
    setIsMobileNavOpen(false);
    if (view === "add") {
      resetForm();
    }
  };

  const openWorkspaceRoute = (path: string) => {
    setIsMobileNavOpen(false);
    window.location.assign(path);
  };

  return (
    <div className="admin-theme">
      {isMobileNavOpen && (
        <button
          type="button"
          className="admin-nav-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label="Open navigation menu"
          aria-expanded={isMobileNavOpen}
          onClick={() => setIsMobileNavOpen(true)}
        >
          <Menu size={24} aria-hidden="true" />
        </button>
        <span className="mobile-header-title">MEME CAPSULE</span>
        <button
          type="button"
          className="btn-primary brutalist-border-sm"
          style={{ padding: "4px 8px", fontSize: "10px", width: "auto" }}
          onClick={() => {
            selectAdminView("add");
            window.scrollTo({ top: 1000, behavior: "smooth" });
          }}
        >
          + ADD
        </button>
      </header>

      <div className="layout-root">
        <aside
          className={`sidebar brutalist-border-r ${isSidebarCollapsed ? "sidebar--collapsed" : ""} ${isMobileNavOpen ? "sidebar--mobile-open" : ""}`}
          aria-label="Admin navigation"
        >
          <div className="brand-section">
            <h1 className="brand-title">
              <span className="brand-title-full">MEME CAPSULE</span>
              <span className="brand-title-mini" aria-hidden="true">MC</span>
            </h1>
            <p className="brand-sub">OPERATOR CONTROL</p>
            <button
              type="button"
              className="sidebar-collapse-toggle brutalist-border-sm"
              aria-label={isSidebarCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
              aria-expanded={!isSidebarCollapsed}
              title={isSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            >
              {isSidebarCollapsed ? <Pin size={16} aria-hidden="true" /> : <PinOff size={16} aria-hidden="true" />}
            </button>
          </div>
          <div className="nav-groups">
            <section className="nav-group" aria-labelledby="collection-nav-heading">
              <h3 id="collection-nav-heading" className="nav-group-title">Collection</h3>
              <ul>
                <li>
                  <button type="button" className={activeTab === "vault" ? "active" : ""} onClick={() => selectAdminView("vault")} title="Meme Vault" aria-label="Meme Vault" aria-current={activeTab === "vault" ? "page" : undefined}>
                    <span className="material-symbols-outlined" aria-hidden="true">dashboard</span>
                    <span className="nav-label">Meme Vault</span>
                  </button>
                </li>
                <li>
                  <button type="button" className={activeTab === "add" ? "active" : ""} onClick={() => selectAdminView("add")} title="Add Memes" aria-label="Add Memes" aria-current={activeTab === "add" ? "page" : undefined}>
                    <span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
                    <span className="nav-label">Add Memes</span>
                  </button>
                </li>
              </ul>
            </section>

            <section className="nav-group" aria-labelledby="curation-nav-heading">
              <h3 id="curation-nav-heading" className="nav-group-title">Curation</h3>
              <ul>
                <li>
                  <button type="button" onClick={() => openWorkspaceRoute("/curate")} title="Human Curation" aria-label="Human Curation">
                    <span className="material-symbols-outlined" aria-hidden="true">how_to_vote</span>
                    <span className="nav-label">Human Curation</span>
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => openWorkspaceRoute("/ai-judge")} title="AI Judge Workflow" aria-label="AI Judge Workflow">
                    <span className="material-symbols-outlined" aria-hidden="true">psychology</span>
                    <span className="nav-label">AI Judge Workflow</span>
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => openWorkspaceRoute("/reports")} title="Reports and Moderation" aria-label="Reports and Moderation">
                    <span className="material-symbols-outlined" aria-hidden="true">flag</span>
                    <span className="nav-label">Reports / Moderation</span>
                  </button>
                </li>
              </ul>
            </section>

            <section className="nav-group" aria-labelledby="operations-nav-heading">
              <h3 id="operations-nav-heading" className="nav-group-title">Operations</h3>
              <ul>
                <li>
                  <button type="button" className={activeTab === "notifications" ? "active" : ""} onClick={() => selectAdminView("notifications")} title="Push Notifications" aria-label="Push Notifications" aria-current={activeTab === "notifications" ? "page" : undefined}>
                    <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
                    <span className="nav-label">Push Notifications</span>
                  </button>
                </li>
                <li>
                  <button type="button" className={activeTab === "sql" ? "active" : ""} onClick={() => selectAdminView("sql")} title="SQL Playground" aria-label="SQL Playground" aria-current={activeTab === "sql" ? "page" : undefined}>
                    <span className="material-symbols-outlined" aria-hidden="true">terminal</span>
                    <span className="nav-label">SQL Playground</span>
                  </button>
                </li>
                <li>
                  <button type="button" onClick={useLocalMode} title="Use Local Drafts" aria-label="Use Local Drafts">
                    <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
                    <span className="nav-label">Use Local Drafts</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={backendMode && !isSyncing ? handleSyncR2 : undefined}
                    disabled={!backendMode || isSyncing}
                    title="Sync R2 Files"
                    aria-label="Sync R2 Files"
                  >
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                      style={{
                        animation: isSyncing && syncActionName.includes("R2") ? "spin 1s linear infinite" : "none"
                      }}
                    >
                      refresh
                    </span>
                    <span className="nav-label">{isSyncing && syncActionName.includes("R2") ? "Syncing R2..." : "Sync R2 Files"}</span>
                  </button>
                </li>
              </ul>
            </section>
          </div>
          <div className="sys-status">
            <p>SYSTEM UPTIME: 99.9%</p>
            <p className="time">WARP ROUTING ACTIVE</p>
          </div>
        </aside>

        <main className="main-content">
          <div className="top-banner brutalist-border-b">
            <span>OPERATOR WORKSPACE // 5-TIER VAULT ENABLED</span>
            <div className="token-input-group">
              <input
                className="brutalist-input"
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="ADMIN_API_TOKEN"
              />
              <button type="button" className="btn-secondary brutalist-border-sm" onClick={saveToken}>
                Save
              </button>
              <button
                type="button"
                className="btn-primary brutalist-border-sm"
                onClick={() => loadBackend()}
                disabled={isSyncing}
              >
                {backendMode ? "Reload" : "Connect"}
              </button>
            </div>
          </div>

          <div className="content-canvas">
            <section className="top-stats-bar" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" }}>
              <div className="stat-card brutalist-border brutalist-shadow-black brutalist-interactive">
                <p>Total Memes</p>
                <p className="stat-value total">{stats.total}</p>
              </div>
              <div className="stat-card brutalist-border brutalist-shadow-black brutalist-interactive">
                <p>Active</p>
                <p className="stat-value active">{stats.active}</p>
              </div>
              <div className="stat-card brutalist-border brutalist-shadow-black brutalist-interactive" style={{ borderLeft: "4px solid #FF3B30" }}>
                <p style={{ color: "#FF3B30" }}>Excluded</p>
                <p className="stat-value" style={{ color: "#FF3B30" }}>{stats.excluded}</p>
              </div>
              <div className="stat-card brutalist-border brutalist-shadow-black brutalist-interactive">
                <p>Archived</p>
                <p className="stat-value archived">{stats.archived}</p>
              </div>
              <div className="stat-card brutalist-border brutalist-shadow-black brutalist-interactive">
                <p>Drafts</p>
                <p className="stat-value drafts">{stats.drafts}</p>
              </div>
              <div className="stat-card brutalist-border brutalist-shadow-black brutalist-interactive" style={{ borderLeft: "4px solid #dd0061" }}>
                <p style={{ color: "#dd0061" }}>NSFW</p>
                <p className="stat-value" style={{ color: "#dd0061" }}>{stats.nsfw}</p>
              </div>
            </section>

            {notice && (
              <div
                className="brutalist-border-sm"
                style={{
                  padding: "12px",
                  background: "var(--surface-container-highest)",
                  color: "var(--primary)",
                  fontFamily: "monospace",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <span className="material-symbols-outlined">info</span>
                <span>{notice}</span>
                {isSyncing && (
                  <span style={{ marginLeft: "auto", color: "var(--secondary)", fontWeight: 700 }}>
                    ⏳ {syncActionName || "Processing..."}
                  </span>
                )}
              </div>
            )}

            {activeTab === "sql" ? (
              <div
                style={{ background: "var(--background)", flex: 1, minHeight: "600px" }}
                className="brutalist-border brutalist-shadow-black"
              >
                <SqlRunner adminToken={adminToken} />
              </div>
            ) : activeTab === "notifications" ? (
              <div className="brutalist-border brutalist-shadow-black" style={{ background: "var(--background)", flex: 1, minHeight: "600px" }}>
                <PushNotifications adminToken={adminToken} />
                <ScheduledNotifications adminToken={adminToken} />
              </div>
            ) : activeTab === "add" ? (
              <div className="split-pane add-meme-layout">
                <BulkIngestionWorkspace
                  adminToken={adminToken}
                  backendMode={backendMode}
                  onNotice={setNotice}
                  onBackendChanged={loadBackend}
                />
                
                {/* SINGLE MEME EDITOR */}
                <section className="right-pane brutalist-border brutalist-shadow-black-lg" style={{ marginTop: "24px" }}>
                  {editingOriginalId && <div className="edit-mode-tag brutalist-border-sm">EDIT MODE</div>}
                  <h3>{editingOriginalId ? "Edit Meme" : "Add Single Meme"}</h3>
                  
                  <form onSubmit={handleSubmit}>
                    <div className="form-group">
                      <label>Media Asset</label>
                      <div className="media-zone">
                        <label className="file-dropzone">
                          <span className="material-symbols-outlined">upload_file</span>
                          <span>{isSyncing && syncActionName.includes("Upload") ? "UPLOADING..." : "DROP FILE HERE"}</span>
                          <input accept="image/*,video/*" type="file" onChange={handleFileUpload} disabled={isSyncing} />
                        </label>
                        <div className="url-zone">
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ color: "var(--outline)", fontSize: "10px" }}>Media URL</label>
                            <input 
                              className="brutalist-input" 
                              style={{ fontFamily: "monospace" }} 
                              value={form.url} 
                              onChange={(e) => handleUrlInput(e.target.value.includes("drive.google") ? "google-drive" : "url", e.target.value)} 
                              placeholder="https://..." 
                            />
                          </div>
                          {form.url && (
                            <div style={{ marginTop: "auto", display: "flex", justifyContent: "center" }}>
                              {form.media_type === "video" ? (
                                <video controls src={form.url} style={{ maxHeight: "100px", border: "2px solid var(--outline-variant)" }} />
                              ) : (
                                <img src={form.url} alt="Preview" style={{ maxHeight: "100px", border: "2px solid var(--outline-variant)" }} />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="metadata-grid">
                      <div className="form-group col-span-2">
                        <label>Title</label>
                        <input 
                          className="brutalist-input" 
                          style={{ fontFamily: "var(--font-display)", fontSize: "20px", textTransform: "uppercase" }} 
                          value={form.title} 
                          onChange={(e) => updateForm("title", e.target.value)} 
                          placeholder="Exam week survival"
                        />
                      </div>
                      <div className="form-group">
                        <label>Category</label>
                        <input 
                          className="brutalist-input" 
                          style={{ textTransform: "uppercase", fontWeight: 700 }}
                          value={form.category} 
                          onChange={(e) => updateForm("category", e.target.value)} 
                        />
                      </div>
                      <div className="form-group">
                        <label>Status</label>
                        <select 
                          className="brutalist-input" 
                          style={{ textTransform: "uppercase", fontWeight: 700 }}
                          value={form.status} 
                          onChange={(e) => updateForm("status", e.target.value as MemeStatus)}
                        >
                          <option value="draft">DRAFT</option>
                          <option value="active">ACTIVE</option>
                          <option value="archived">ARCHIVED</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Rarity</label>
                        <select 
                          className="brutalist-input" 
                          style={{ textTransform: "uppercase", fontWeight: 700 }}
                          value={form.rarity} 
                          onChange={(e) => updateForm("rarity", e.target.value as Rarity)}
                        >
                          <option value="Common">COMMON</option>
                          <option value="Rare">RARE</option>
                          <option value="Legendary">LEGENDARY</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Likes Count</label>
                        <input 
                          className="brutalist-input" 
                          type="number" 
                          value={form.likes_count ?? 0} 
                          onChange={(e) => updateForm("likes_count", parseInt(e.target.value, 10) || 0)} 
                        />
                      </div>
                    </div>

                    <div className="advanced-toggle">
                      <details className="group cursor-pointer">
                        <summary className="advanced-summary" onClick={(e) => {
                          e.preventDefault();
                          setShowAdvanced(!showAdvanced);
                        }}>
                          <span className="material-symbols-outlined" style={{ transform: showAdvanced ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>chevron_right</span>
                          Advanced Options
                        </summary>
                        {showAdvanced && (
                          <div className="advanced-content brutalist-border-sm">
                            <div className="form-group">
                              <label style={{ color: "var(--outline)", fontSize: "10px" }}>
                                Meme ID {editingOriginalId && <span style={{ color: "var(--primary)", fontWeight: 700 }}>(IMMUTABLE)</span>}
                              </label>
                              <input
                                className="brutalist-input"
                                value={form.id}
                                onChange={(e) => updateForm("id", e.target.value)}
                                disabled={Boolean(editingOriginalId)}
                                readOnly={Boolean(editingOriginalId)}
                                title={editingOriginalId ? "Meme ID is permanent and immutable once created." : undefined}
                                style={editingOriginalId ? { opacity: 0.6, cursor: "not-allowed", background: "var(--surface-container-highest)" } : {}}
                              />
                              {editingOriginalId && (
                                <span style={{ fontSize: "10px", color: "var(--outline)", marginTop: "2px", display: "block" }}>
                                  🔒 Permanent identifier. Preserves references across curation, analytics, and audit logs.
                                </span>
                              )}
                            </div>
                            <div className="form-group">
                              <label style={{ color: "var(--outline)", fontSize: "10px" }}>Tags (Comma separated)</label>
                              <input className="brutalist-input" value={form.tags} onChange={(e) => updateForm("tags", e.target.value)} />
                            </div>
                            <div className="form-group">
                              <label style={{ color: "var(--outline)", fontSize: "10px" }}>Storage Path</label>
                              <input className="brutalist-input" value={form.storage_path || ""} onChange={(e) => updateForm("storage_path", e.target.value)} />
                            </div>
                            <div className="form-group">
                              <label style={{ color: "var(--outline)", fontSize: "10px" }}>Share Text</label>
                              <input className="brutalist-input" value={form.share_text} onChange={(e) => updateForm("share_text", e.target.value)} />
                            </div>
                            <div className="form-group">
                              <label style={{ color: "var(--outline)", fontSize: "10px" }}>Rights Note</label>
                              <input className="brutalist-input" value={form.rights_note} onChange={(e) => updateForm("rights_note", e.target.value)} />
                            </div>
                            <button type="button" onClick={exportCollection} className="btn-clear brutalist-border-sm" style={{ padding: "8px", color: "var(--primary)", borderColor: "var(--primary)", marginTop: "8px", width: "fit-content" }}>
                              Export JSON
                            </button>
                          </div>
                        )}
                      </details>
                    </div>

                    <div className="form-actions">
                      <button
                        type="submit"
                        disabled={isSyncing}
                        className="btn-primary brutalist-border brutalist-shadow-black brutalist-interactive"
                        style={{
                          opacity: isSyncing ? 0.7 : 1,
                          cursor: isSyncing ? "wait" : "pointer"
                        }}
                      >
                        {isSyncing && syncActionName.includes("Saving") ? (
                          "SAVING..."
                        ) : editingOriginalId ? (
                          "UPDATE MEME"
                        ) : (
                          "COMMIT MEME"
                        )}
                      </button>
                      <button type="button" className="btn-clear brutalist-border-sm" onClick={resetForm}>
                        Reset Form
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            ) : (
              /* MEME VAULT VIEW (activeTab === "vault") */
              <section className="left-pane" style={{ width: "100%" }}>
                <div className="pane-header" style={{ flexDirection: "column", gap: "12px", alignItems: "stretch" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <h3 style={{ margin: 0 }}>
                        Meme Vault ({serverPagination ? serverPagination.total : filteredCollection.length})
                      </h3>
                      
                      {/* Five Vault View Modes Switcher */}
                      <div className="vault-view-switcher brutalist-border-sm">
                        {(["rows", "compact", "grid", "table", "split"] as VaultViewMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={`view-mode-btn ${vaultViewMode === mode ? "active" : ""}`}
                            onClick={() => handleSetVaultViewMode(mode)}
                            title={`Switch to ${mode} mode`}
                          >
                            <span className="material-symbols-outlined">
                              {mode === "rows" ? "view_list" : mode === "compact" ? "density_medium" : mode === "grid" ? "grid_view" : mode === "table" ? "table_chart" : "vertical_split"}
                            </span>
                            <span>{mode}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Status Filter Tabs */}
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {(["all", "active", "excluded", "archived", "draft", "nsfw"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            setStatusFilter(st);
                            setCurrentPage(1);
                          }}
                          className="brutalist-border-sm"
                          style={{
                            padding: "4px 8px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background: statusFilter === st ? (st === "excluded" ? "#FF3B30" : st === "nsfw" ? "#dd0061" : "var(--primary)") : "var(--surface)",
                            color: statusFilter === st ? "#ffffff" : "var(--on-surface)",
                            cursor: "pointer"
                          }}
                        >
                          {st === "all" ? `all (${stats.total})` : st === "active" ? `active (${stats.active})` : st === "excluded" ? `excluded (${stats.excluded})` : st === "archived" ? `archived (${stats.archived})` : st === "nsfw" ? `nsfw (${stats.nsfw})` : `draft (${stats.drafts})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search, Sort, and Per-Page Controls */}
                  <div className="vault-controls-row">
                    <div style={{ flex: 1, minWidth: "240px", display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        placeholder="Quick search by title, ID, tag, category..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="brutalist-input"
                        style={{ width: "100%", padding: "8px 12px", boxSizing: "border-box" }}
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm("")}
                          className="brutalist-border-sm"
                          style={{
                            padding: "0 12px",
                            background: "var(--surface-container-high)",
                            color: "var(--on-surface)",
                            cursor: "pointer"
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <label style={{ fontSize: "11px", color: "var(--outline)", textTransform: "uppercase", fontWeight: 700 }}>
                        Sort:
                      </label>
                      <select
                        value={`${sortBy}:${sortDir}`}
                        onChange={(e) => {
                          const [col, dir] = e.target.value.split(":");
                          setSortBy(col);
                          setSortDir(dir as "asc" | "desc");
                          setCurrentPage(1);
                        }}
                        className="vault-sort-select brutalist-border-sm"
                      >
                        <option value="uploaded_at:desc">Newest Upload</option>
                        <option value="uploaded_at:asc">Oldest Upload</option>
                        <option value="title:asc">Title (A-Z)</option>
                        <option value="title:desc">Title (Z-A)</option>
                        <option value="likes_count:desc">Most Liked</option>
                        <option value="views_count:desc">Most Viewed</option>
                        <option value="share_count:desc">Most Shared</option>
                      </select>

                      <label style={{ fontSize: "11px", color: "var(--outline)", textTransform: "uppercase", fontWeight: 700 }}>
                        Per Page:
                      </label>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="vault-sort-select brutalist-border-sm"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Bulk Actions Bar */}
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", padding: "10px 14px", background: "var(--surface-container)", border: "2px solid black" }}>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="brutalist-border-sm brutalist-interactive"
                    style={{ padding: "6px 12px", background: "var(--surface-container-high)", color: "var(--on-surface)", fontWeight: "bold" }}
                  >
                    {selectedIds.size === paginatedMemes.length && paginatedMemes.length > 0 ? "Deselect All" : "Select All"}
                  </button>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "var(--secondary)" }}>
                    {selectedIds.size} selected
                  </span>
                  {selectedIds.size > 0 && (statusFilter === "archived" || statusFilter === "excluded" || backendMode) && (
                    <button
                      type="button"
                      onClick={() => hardDeleteMemes(Array.from(selectedIds))}
                      className="brutalist-border-sm brutalist-interactive"
                      style={{ marginLeft: "auto", padding: "6px 12px", background: "#ff2a2a", color: "#fff", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete_forever</span>
                      Permanently Delete Selected
                    </button>
                  )}
                </div>

                {/* FIVE VAULT VIEW MODES */}
                {paginatedMemes.length === 0 ? (
                  <div style={{ color: "var(--outline-variant)", padding: "48px 24px", textAlign: "center", background: "var(--surface-container)", border: "2px solid black" }}>
                    {searchTerm ? "No memes match your search query." : "No memes in this view category."}
                  </div>
                ) : vaultViewMode === "rows" ? (
                  /* 1. Detailed Rows */
                  <div className="collection-list custom-scrollbar">
                    {paginatedMemes.map((meme) => (
                      <MemeRow
                        key={meme.id}
                        meme={meme}
                        backendMode={backendMode}
                        onEdit={editMeme}
                        onDelete={deleteMeme}
                        onInspect={setInspectedMeme}
                        isSelected={selectedIds.has(meme.id)}
                        onToggleSelect={handleToggleSelect}
                        isArchivedView={statusFilter === "archived" || statusFilter === "excluded"}
                        onHardDelete={(id) => hardDeleteMemes([id])}
                      />
                    ))}
                  </div>
                ) : vaultViewMode === "compact" ? (
                  /* 2. Compact Dense Scanner */
                  <div className="vault-compact-list custom-scrollbar">
                    {paginatedMemes.map((meme) => (
                      <MemeCompactRow
                        key={meme.id}
                        meme={meme}
                        backendMode={backendMode}
                        onEdit={editMeme}
                        onDelete={deleteMeme}
                        onInspect={setInspectedMeme}
                        isSelected={selectedIds.has(meme.id)}
                        onToggleSelect={handleToggleSelect}
                        isArchivedView={statusFilter === "archived" || statusFilter === "excluded"}
                        onHardDelete={(id) => hardDeleteMemes([id])}
                      />
                    ))}
                  </div>
                ) : vaultViewMode === "grid" ? (
                  /* 3. Card Gallery Grid */
                  <div className="vault-grid custom-scrollbar">
                    {paginatedMemes.map((meme) => (
                      <MemeGridCard
                        key={meme.id}
                        meme={meme}
                        backendMode={backendMode}
                        onEdit={editMeme}
                        onDelete={deleteMeme}
                        onInspect={setInspectedMeme}
                        isSelected={selectedIds.has(meme.id)}
                        onToggleSelect={handleToggleSelect}
                        isArchivedView={statusFilter === "archived" || statusFilter === "excluded"}
                        onHardDelete={(id) => hardDeleteMemes([id])}
                      />
                    ))}
                  </div>
                ) : vaultViewMode === "table" ? (
                  /* 4. Tabular Data Sheet */
                  <MemeTableView
                    memes={paginatedMemes}
                    backendMode={backendMode}
                    onEdit={editMeme}
                    onDelete={deleteMeme}
                    onInspect={setInspectedMeme}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onSelectAll={handleSelectAll}
                    isArchivedView={statusFilter === "archived" || statusFilter === "excluded"}
                    onHardDelete={(id) => hardDeleteMemes([id])}
                  />
                ) : (
                  /* 5. Split Inspector View */
                  <div className="vault-split-container">
                    <div className="vault-split-main">
                      <MemeTableView
                        memes={paginatedMemes}
                        backendMode={backendMode}
                        onEdit={editMeme}
                        onDelete={deleteMeme}
                        onInspect={setInspectedMeme}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                        onSelectAll={handleSelectAll}
                        isArchivedView={statusFilter === "archived" || statusFilter === "excluded"}
                        onHardDelete={(id) => hardDeleteMemes([id])}
                      />
                    </div>
                    <div className="vault-split-inspector">
                      <ContextualDetailsPanel
                        meme={inspectedMeme || paginatedMemes[0]}
                        isSplitView={true}
                        onEdit={editMeme}
                        onArchive={deleteMeme}
                        onHardDelete={(id) => hardDeleteMemes([id])}
                        onToggleNsfw={handleToggleNsfw}
                        backendMode={backendMode}
                      />
                    </div>
                  </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "var(--surface-container)",
                      border: "2px solid black",
                      marginTop: "12px"
                    }}
                  >
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="brutalist-border-sm brutalist-interactive"
                      style={{
                        padding: "6px 16px",
                        background: currentPage === 1 ? "var(--surface-container-lowest)" : "var(--surface)",
                        color: "var(--on-surface)",
                        fontWeight: 700,
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        opacity: currentPage === 1 ? 0.5 : 1
                      }}
                    >
                      ◀ Prev
                    </button>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--secondary)" }}>
                      Page {currentPage} of {totalPages} ({serverPagination ? `${serverPagination.total} total` : `${filteredCollection.length} total`})
                    </span>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="brutalist-border-sm brutalist-interactive"
                      style={{
                        padding: "6px 16px",
                        background: currentPage === totalPages ? "var(--surface-container-lowest)" : "var(--surface)",
                        color: "var(--on-surface)",
                        fontWeight: 700,
                        cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                        opacity: currentPage === totalPages ? 0.5 : 1
                      }}
                    >
                      Next ▶
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      </div>

      {/* Floating Contextual Details Inspector Drawer / Modal for non-split modes */}
      {inspectedMeme && vaultViewMode !== "split" && (
        <div className="contextual-modal-overlay" onClick={() => setInspectedMeme(null)}>
          <div className="contextual-modal-content" onClick={(e) => e.stopPropagation()}>
            <ContextualDetailsPanel
              meme={inspectedMeme}
              onClose={() => setInspectedMeme(null)}
              isSplitView={false}
              onEdit={(m) => {
                setInspectedMeme(null);
                editMeme(m);
              }}
              onArchive={(id) => {
                setInspectedMeme(null);
                deleteMeme(id);
              }}
              onHardDelete={(id) => {
                setInspectedMeme(null);
                hardDeleteMemes([id]);
              }}
              onToggleNsfw={handleToggleNsfw}
              backendMode={backendMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}
