import {
  Database,
  Download,
  Edit3,
  ExternalLink,
  ImagePlus,
  Link as LinkIcon,
  ListChecks,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud
} from "lucide-react";
import React, { ChangeEvent, FormEvent, useMemo, useState, useEffect, useCallback } from "react";
import {
  archiveBackendMeme,
  listBackendMemes,
  saveBackendMeme,
  syncR2ToD1,
  uploadBackendMemeFile,
  hardDeleteBackendMemes
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
import AnalyticsDashboard from "./analytics-dashboard/AnalyticsDashboard";
import SqlRunner from "./sql-runner/SqlRunner";
import AiTab from "./ai/AiTab";
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
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isArchivedView?: boolean;
  onHardDelete?: (id: string) => void;
}

const MemeRow = React.memo(function MemeRow({ meme, backendMode, onEdit, onDelete, isSelected, onToggleSelect, isArchivedView, onHardDelete }: MemeRowProps) {
  return (
    <div className={`collection-row brutalist-border brutalist-shadow-black brutalist-interactive ${isSelected ? 'selected' : ''}`} onClick={() => onEdit(meme)}>
      {isArchivedView && (
        <div className="row-select" onClick={(e) => e.stopPropagation()}>
          <input 
            type="checkbox" 
            checked={isSelected || false} 
            onChange={() => onToggleSelect && onToggleSelect(meme.id)} 
          />
        </div>
      )}
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
      <div className="row-actions">
        <button
          type="button"
          className="brutalist-border-sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(meme);
          }}
        >
          <span className="material-symbols-outlined">edit</span> Edit
        </button>
        <button
          type="button"
          className="delete-btn brutalist-border-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(meme.id);
          }}
        >
          <span className="material-symbols-outlined">{backendMode ? "archive" : "delete"}</span>
          {backendMode ? "Archv" : "Del"}
        </button>
        {isArchivedView && onHardDelete && backendMode && (
          <button
            type="button"
            className="delete-btn brutalist-border-sm"
            style={{ backgroundColor: "#ff2a2a", color: "#fff" }}
            onClick={(e) => {
              e.stopPropagation();
              onHardDelete(meme.id);
            }}
          >
            <span className="material-symbols-outlined">delete_forever</span>
            Hard Del
          </button>
        )}
      </div>
    </div>
  );
});

export default function AdminApp() {
  const [collection, setCollection] = useState<AdminMeme[]>(() => readAdminCollection());
  const [form, setForm] = useState<FormState>(() => toFormState(emptyAdminMeme()));
  const [editingOriginalId, setEditingOriginalId] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState(() => window.sessionStorage.getItem(ADMIN_TOKEN_KEY) || "");
  const [backendMode, setBackendMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncActionName, setSyncActionName] = useState("");
  const [notice, setNotice] = useState("Admin collection is local draft storage until the Cloudflare backend is connected.");
  const [backendConfig, setBackendConfig] = useState<{ hasR2PublicUrl?: boolean; hasDatabase?: boolean }>({});
  const [backendActiveCount, setBackendActiveCount] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<"vault" | "analytics" | "sql" | "ai">("vault");

  // Filtering & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "archived" | "excluded" | "nsfw">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selections when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    if (adminToken.trim()) {
      loadBackend();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
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
  }, [collection]);

  // Filtered and paginated list for instantaneous UI responsiveness
  const filteredCollection = useMemo(() => {
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
  }, [collection, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCollection.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedMemes = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCollection.slice(start, start + PAGE_SIZE);
  }, [filteredCollection, currentPage]);

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

  const loadBackend = async () => {
    if (!adminToken.trim()) {
      setNotice("Enter your admin API token before loading the backend.");
      return;
    }

    setIsSyncing(true);
    setSyncActionName("Connecting backend...");
    try {
      window.sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
      const response = await fetch("/api/admin/memes", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "X-Admin-Token": adminToken
        },
        cache: "no-store"
      });
      
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Request failed with ${response.status}`);
      }

      setCollection((payload.memes || []).map(normalizeAdminMeme));
      setBackendConfig(payload.config || {});
      setBackendMode(true);
      
      const activeCount = (payload.memes || []).filter((m: any) => m.status === "active").length;
      setBackendActiveCount(activeCount);
      
      setNotice(`Backend connected. ${payload.memes?.length || 0} production memes loaded.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load backend collection.");
    } finally {
      setIsSyncing(false);
      setSyncActionName("");
    }
  };

  const handleAutoRefresh = useCallback(async () => {
    if (!adminToken.trim()) return;
    try {
      const response = await fetch("/api/admin/memes", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "X-Admin-Token": adminToken
        },
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.memes) {
        setCollection((payload.memes || []).map(normalizeAdminMeme));
        setBackendConfig(payload.config || {});
        setBackendMode(true);
        const activeCount = (payload.memes || []).filter((m: any) => m.status === "active").length;
        setBackendActiveCount(activeCount);
      }
    } catch {
      // Silent error on background auto-refresh
    }
  }, [adminToken]);

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
        const memes = await listBackendMemes(adminToken);
        setCollection(memes.map(normalizeAdminMeme));
        const activeCount = memes.filter((m) => m.status === "active").length;
        setBackendActiveCount(activeCount);
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
  }, [backendMode, adminToken, editingOriginalId, collection]);

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
      setNotice(`✅ ${response.message}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Backend hard delete failed.");
    } finally {
      setIsSyncing(false);
      setSyncActionName("");
    }
  }, [backendMode, adminToken]);

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

  return (
    <main className="admin-shell">
      <header className="top-app-bar">
        <div className="title-area">
          <span className="material-symbols-outlined">menu</span>
          <span className="title-text">MEME CAPSULE ADMIN</span>
        </div>
        <div className="header-actions">
          <div className="backend-pill">
            <span>{backendMode ? "BACKEND MODE" : "LOCAL MODE"}</span>
            <div className={`status-dot ${backendMode ? "active" : ""}`}></div>
          </div>
          <div className="token-input">
            <span className="material-symbols-outlined">key</span>
            <input
              type="password"
              placeholder="API TOKEN..."
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
            />
          </div>
          <button
            onClick={() => handleAutoRefresh()}
            className="icon-btn brutalist-interactive"
            title="Refresh Data (Ctrl+R)"
            disabled={isSyncing}
            style={{
              background: "#222",
              border: "1px solid #f4c300",
              color: "#f4c300",
              padding: "6px 12px",
              fontFamily: "Anton",
              fontSize: "12px",
              cursor: isSyncing ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <span>🔄</span>
            {isSyncing ? "SYNCING..." : "REFRESH (Ctrl+R)"}
          </button>
          <button
            onClick={adminToken ? loadBackend : saveToken}
            className="icon-btn brutalist-interactive"
            title="Sync / Load Backend"
            disabled={isSyncing}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--primary)",
              cursor: isSyncing ? "wait" : "pointer"
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                animation: isSyncing ? "spin 1s linear infinite" : "none",
                display: "inline-block"
              }}
            >
              sync
            </span>
          </button>
        </div>
      </header>

      <div className="main-layout">
        <nav className="nav-drawer">
          <h2>ADMIN CONSOLE</h2>
          <ul>
            <li className={activeTab === "vault" ? "active" : ""} onClick={() => setActiveTab("vault")}>
              <span className="material-symbols-outlined">dashboard</span>
              Meme Vault
            </li>
            <li className={activeTab === "analytics" ? "active" : ""} onClick={() => setActiveTab("analytics")}>
              <span className="material-symbols-outlined">query_stats</span>
              Analytics
            </li>
            <li className={activeTab === "sql" ? "active" : ""} onClick={() => setActiveTab("sql")}>
              <span className="material-symbols-outlined">terminal</span>
              SQL Playground
            </li>
            <li className={activeTab === "ai" ? "active" : ""} onClick={() => setActiveTab("ai")}>
              <span className="material-symbols-outlined">psychology</span>
              AI Categorisation
            </li>
            <li onClick={useLocalMode}>
              <span className="material-symbols-outlined">inventory_2</span>
              Use Local Drafts
            </li>
            <li
              onClick={backendMode && !isSyncing ? handleSyncR2 : undefined}
              style={{
                opacity: backendMode ? 1 : 0.5,
                cursor: backendMode && !isSyncing ? "pointer" : "not-allowed"
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  animation: isSyncing && syncActionName.includes("R2") ? "spin 1s linear infinite" : "none"
                }}
              >
                refresh
              </span>
              {isSyncing && syncActionName.includes("R2") ? "Syncing R2..." : "Sync R2 Files"}
            </li>
          </ul>
          <div className="sys-status">
            <p>SYSTEM UPTIME: 99.9%</p>
            <p>VERSION: 2.4.2-FAST</p>
          </div>
        </nav>

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

          {activeTab === "analytics" ? (
            <div
              style={{ background: "var(--background)", flex: 1, minHeight: "600px" }}
              className="brutalist-border brutalist-shadow-black"
            >
              <AnalyticsDashboard adminToken={adminToken} />
            </div>
          ) : activeTab === "sql" ? (
            <div
              style={{ background: "var(--background)", flex: 1, minHeight: "600px" }}
              className="brutalist-border brutalist-shadow-black"
            >
              <SqlRunner adminToken={adminToken} />
            </div>
          ) : activeTab === "ai" ? (
            <div
              style={{ background: "var(--background)", flex: 1, minHeight: "600px" }}
              className="brutalist-border brutalist-shadow-black"
            >
              <AiTab adminToken={adminToken} />
            </div>
          ) : (
            <div className="split-pane">
              {/* LEFT PANE - VAULT */}
              <section className="left-pane">
                <div className="pane-header" style={{ flexDirection: "column", gap: "12px", alignItems: "stretch" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3>Meme Vault ({filteredCollection.length})</h3>
                    <div style={{ display: "flex", gap: "4px" }}>
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

                  {/* Search filter input */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <div style={{ flex: 1, position: "relative" }}>
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
                    </div>
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
                </div>

                {/* Bulk Actions */}
                {(statusFilter === "archived" || statusFilter === "excluded") && (
                  <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", padding: "12px", background: "var(--surface-container)", border: "2px solid black" }}>
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
                    {selectedIds.size > 0 && (
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
                )}

                {/* Paginated Collection List */}
                <div className="collection-list custom-scrollbar">
                  {filteredCollection.length === 0 ? (
                    <div style={{ color: "var(--outline-variant)", padding: "24px", textAlign: "center" }}>
                      {searchTerm ? "No memes match your search query." : "No admin memes in this view."}
                    </div>
                  ) : (
                    paginatedMemes.map((meme) => (
                      <MemeRow
                        key={meme.id}
                        meme={meme}
                        backendMode={backendMode}
                        onEdit={editMeme}
                        onDelete={deleteMeme}
                        isSelected={selectedIds.has(meme.id)}
                        onToggleSelect={handleToggleSelect}
                        isArchivedView={statusFilter === "archived" || statusFilter === "excluded"}
                        onHardDelete={(id) => hardDeleteMemes([id])}
                      />
                    ))
                  )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "var(--surface-container)",
                      border: "2px solid black"
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
                      Page {currentPage} of {totalPages}
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

              {/* RIGHT PANE - EDITOR */}
              <section className="right-pane brutalist-border brutalist-shadow-black-lg">
                {editingOriginalId && <div className="edit-mode-tag brutalist-border-sm">EDIT MODE</div>}
                <h3>{editingOriginalId ? "Edit Meme" : "Add Meme"}</h3>
                
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
                        style={{ textTransform: "uppercase", fontWeight: 700, color: "var(--secondary)" }}
                        value={form.status} 
                        onChange={(e) => updateForm("status", e.target.value as MemeStatus)}
                      >
                        <option 
                          value="active"
                          disabled={backendMode && Boolean(editingOriginalId) && !(collection.find((m) => m.id === editingOriginalId) as unknown as { is_finalized_keep?: boolean })?.is_finalized_keep}
                        >
                          Active {backendMode && Boolean(editingOriginalId) && !(collection.find((m) => m.id === editingOriginalId) as unknown as { is_finalized_keep?: boolean })?.is_finalized_keep ? "(Requires Superadmin Finalization)" : ""}
                        </option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Rarity</label>
                      <select 
                        className="brutalist-input" 
                        style={{ textTransform: "uppercase", fontWeight: 700, color: "var(--tertiary-container)" }}
                        value={form.rarity} 
                        onChange={(e) => updateForm("rarity", e.target.value as Rarity)}
                      >
                        <option value="Common">Common</option>
                        <option value="Rare">Rare</option>
                        <option value="Legendary">Legendary</option>
                        <option value="Mythic">Mythic</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Likes Count</label>
                      <input 
                        type="number"
                        className="brutalist-input" 
                        style={{ fontFamily: "monospace" }}
                        value={form.likes_count ?? 0} 
                        onChange={(e) => updateForm("likes_count", Number(e.target.value))} 
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
                            <label style={{ color: "var(--outline)", fontSize: "10px" }}>Meme ID</label>
                            <input className="brutalist-input" value={form.id} onChange={(e) => updateForm("id", e.target.value)} />
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
                      {isSyncing && syncActionName.includes("Saving")
                        ? "Saving..."
                        : editingOriginalId
                        ? "Save Changes"
                        : "Save Meme"}
                    </button>
                    <button type="button" className="btn-clear brutalist-border-sm" onClick={resetForm} disabled={isSyncing}>
                      Clear
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
