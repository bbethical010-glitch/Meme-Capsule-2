import { useState, useEffect, useCallback, useRef } from "react";
import {
  CURATION_TOPICS,
  CURATION_TONES,
  CURATION_MECHANISMS,
  type CurateMemeItem,
  type CorpusStatus,
  type CuratorUser
} from "./curateTypes";
import { fetchNextMeme, approveCuration, saveCuration, forceRemoveMeme, updateMemeNsfw, setMemeNsfw } from "./curateApi";
import EditorialButtons from "./EditorialButtons";
import CategorizationPanel from "./CategorizationPanel";
import CurationStatsModal from "./CurationStatsModal";
import CurateLogin from "./CurateLogin";
import CurateSuperDashboard from "./super/CurateSuperDashboard";
import CurateAccountModal from "./CurateAccountModal";
import AiReviewPanel from "./AiReviewPanel";
import AiPreJudgePanel from "./AiPreJudgePanel";
import type { AiJudgeConfig, AiJudgeDecision } from "./ai-judge/aiJudgeTypes";
import { DEFAULT_AI_JUDGE_CONFIG } from "./ai-judge/aiJudgeTypes";
import AiJudgeConsole from "./ai-judge/AiJudgeConsole";
import { useAiJudgeLoop } from "./ai-judge/useAiJudgeLoop";
import { useIsMobile } from "./useIsMobile";
import { useCurateGestures } from "./useCurateGestures";
import "./curate.css";

interface UndoHistoryItem {
  meme: CurateMemeItem;
  status: CorpusStatus;
  topics: string[];
  tone: string | null;
  mechanisms: string[];
  duplicateOf: string;
  note: string;
}

export default function CurateApp() {
  // Authentication State
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("curator_token"));
  const [user, setUser] = useState<CuratorUser | null>(() => {
    const raw = sessionStorage.getItem("curator_user");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  const [viewMode, setViewMode] = useState<"super" | "judge">(() => {
    const raw = sessionStorage.getItem("curator_user");
    if (!raw) return "judge";
    try {
      const u = JSON.parse(raw);
      return u.role === "superadmin" ? "super" : "judge";
    } catch {
      return "judge";
    }
  });

  const [currentMeme, setCurrentMeme] = useState<CurateMemeItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterQueue, setFilterQueue] = useState<string>("unreviewed");
  const [stats, setStats] = useState({ total: 4485, reviewed: 0, remaining: 4485, current_index: 1 });
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);

  const [overrideMode, setOverrideMode] = useState<boolean>(false);

  // Form State for current meme
  const [status, setStatus] = useState<CorpusStatus | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [tone, setTone] = useState<string | null>(null);
  const [mechanisms, setMechanisms] = useState<string[]>([]);
  const [duplicateOf, setDuplicateOf] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [undoStack, setUndoStack] = useState<UndoHistoryItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Force Remove state
  const [showForceRemoveModal, setShowForceRemoveModal] = useState<boolean>(false);
  const [forceRemoveReason, setForceRemoveReason] = useState<string>("");
  const [forceRemoveLoading, setForceRemoveLoading] = useState<boolean>(false);
  const [nsfwLoading, setNsfwLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "error" } | null>(null);
  const isNsfw = Boolean(currentMeme?.is_nsfw);

  // Mobile Responsiveness & Touch Gestures
  const isMobile = useIsMobile(768);
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false);
  const [swipeAnimation, setSwipeAnimation] = useState<"right" | "left" | "up" | null>(null);
  const [isPulseRemove, setIsPulseRemove] = useState<boolean>(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  // AI Judge State & Hook
  const [aiConfig, setAiConfig] = useState<AiJudgeConfig>(DEFAULT_AI_JUDGE_CONFIG);

  const handleApplyAiDecision = useCallback((decision: AiJudgeDecision) => {
    setStatus(decision.corpus_status);
    setTopics(decision.topics || []);
    setTone(decision.tone || null);
    setMechanisms(decision.humour_mechanisms || []);
    setDuplicateOf(decision.duplicate_of || "");
    const noteText = decision.curator_note
      ? `[AI ${decision.modelUsed || "Vision"} ${Math.round((decision.confidence || 0) * 100)}%] ${decision.curator_note}`
      : "";
    setNote(noteText);
  }, []);

  const aiLoop = useAiJudgeLoop({
    currentMeme,
    config: aiConfig,
    onApplyDecision: handleApplyAiDecision,
    onAdvance: async (decision?: AiJudgeDecision) => {
      const memeId = stateRef.current.currentMeme?.id;
      if (!memeId) return null;
      const nextMeme = await handleApproveAndAdvance("manual", undefined, decision);
      return nextMeme;
    }
  });

  const aiLoopRef = useRef(aiLoop);
  useEffect(() => {
    aiLoopRef.current = aiLoop;
  }, [aiLoop]);

  // Refs for zero-latency keyboard shortcut execution (prevents stale closure issues)
  const stateRef = useRef({
    status,
    topics,
    tone,
    mechanisms,
    duplicateOf,
    note,
    currentMeme,
    isSaving: false,
    undoStack,
    overrideMode,
    showForceRemoveModal: false,
    forceRemoveLoading: false
  });

  useEffect(() => {
    stateRef.current = {
      status,
      topics,
      tone,
      mechanisms,
      duplicateOf,
      note,
      currentMeme,
      isSaving,
      undoStack,
      overrideMode,
      showForceRemoveModal,
      forceRemoveLoading
    };
  }, [status, topics, tone, mechanisms, duplicateOf, note, currentMeme, isSaving, undoStack, overrideMode, showForceRemoveModal, forceRemoveLoading]);

  const handleLoginSuccess = (newToken: string, newUser: CuratorUser) => {
    sessionStorage.setItem("curator_token", newToken);
    sessionStorage.setItem("curator_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setViewMode(newUser.role === "superadmin" ? "super" : "judge");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("curator_token");
    sessionStorage.removeItem("curator_user");
    setToken(null);
    setUser(null);
    setViewMode("judge");
  };

  const preloadImage = (url: string) => {
    if (!url) return;
    const img = new Image();
    img.src = url;
  };

  const loadMeme = useCallback(async (
    currentId?: string,
    direction: "next" | "prev" = "next",
    includeStats: boolean = false
  ): Promise<CurateMemeItem | null> => {
    if (!token) return null;
    try {
      setLoading(true);
      const res = await fetchNextMeme(filterQueue, currentId, direction, includeStats);
      setCurrentMeme(res.meme);
      if (res.stats) {
        setStats(res.stats);
      }

      if (res.meme) {
        preloadImage(res.meme.image_url);

        if (res.meme.curation) {
          setStatus(res.meme.curation.corpus_status);
          setTopics(res.meme.curation.topics || []);
          setTone(res.meme.curation.tone || null);
          setMechanisms(res.meme.curation.humour_mechanisms || []);
          setDuplicateOf(res.meme.curation.duplicate_of || "");
          setNote(res.meme.curation.curator_note || "");
          setOverrideMode(true);
        } else {
          const j4 = res.meme.ai_judgements?.judge4;
          const j5 = res.meme.ai_judgements?.judge5;
          let prefill = j4 || j5 || null;
          if (j4 && j5 && j4.corpus_status === j5.corpus_status && j4.corpus_status !== 'excluded') {
            prefill = j4;
          } else if (j4 && j5) {
            prefill = j4;
          }
          setStatus(prefill?.corpus_status || null);
          setTopics(prefill?.topics || []);
          setTone(prefill?.tone || null);
          setMechanisms(prefill?.humour_mechanisms || []);
          setDuplicateOf(prefill?.duplicate_of || "");
          setNote("");
          setOverrideMode(false);
        }
      }
      return res.meme;
    } catch (err) {
      console.error("Error loading meme:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [filterQueue, token]);

  useEffect(() => {
    if (token && viewMode === "judge") {
      loadMeme(undefined, "next", true);
    }
  }, [token, viewMode, filterQueue, loadMeme]);

  // Approve current decision (atomic adoption or manual) and advance
  const handleApproveAndAdvance = useCallback(async (
    source: "manual" | "judge4" | "judge5" | "consensus" = "manual",
    forcedStatus?: CorpusStatus,
    forcedDecision?: AiJudgeDecision | import("./curateTypes").CuratedMemeData
  ): Promise<CurateMemeItem | null> => {
    const s = stateRef.current;
    if (!s.currentMeme || s.isSaving) return null;

    const activeStatus = forcedDecision?.corpus_status || forcedStatus || s.status || "keep";
    const activeTopics = forcedDecision ? (forcedDecision.topics || []) : (activeStatus === "keep" ? s.topics : []);
    const activeTone = forcedDecision ? (forcedDecision.tone || null) : (activeStatus === "keep" ? s.tone : null);
    const activeMechanisms = forcedDecision ? (forcedDecision.humour_mechanisms || []) : (activeStatus === "keep" ? s.mechanisms : []);
    
    let activeNote = s.note || null;
    if (forcedDecision) {
      if ('modelUsed' in forcedDecision) {
        activeNote = forcedDecision.curator_note ? `[AI ${forcedDecision.modelUsed || "Vision"} ${Math.round((forcedDecision.confidence || 0) * 100)}%] ${forcedDecision.curator_note}` : null;
      } else {
        activeNote = forcedDecision.curator_note || null;
      }
    }
    const activeDuplicateOf = forcedDecision ? (forcedDecision.duplicate_of || null) : (activeStatus === "duplicate" ? s.duplicateOf : null);

    const currentMemeId = s.currentMeme.id;

    setIsSaving(true);
    stateRef.current.isSaving = true;

    const snapshot: UndoHistoryItem = {
      meme: s.currentMeme,
      status: activeStatus,
      topics: activeTopics,
      tone: activeTone,
      mechanisms: activeMechanisms,
      duplicateOf: activeDuplicateOf || "",
      note: activeNote || ""
    };

    setUndoStack((prev) => [...prev.slice(-20), snapshot]);

    let success = false;
    try {
      await approveCuration({
        meme_id: currentMemeId,
        corpus_status: activeStatus,
        duplicate_of: activeDuplicateOf,
        topics: activeTopics,
        tone: activeTone,
        humour_mechanisms: activeMechanisms,
        curator_note: activeNote,
        user_id: user?.id,
        user_name: user?.display_name,
        adopted_from: source
      });
      success = true;
      // Optimistic local progress increment for seamless 0ms UI advancement
      setStats((prev) => ({
        ...prev,
        reviewed: prev.reviewed + 1,
        remaining: Math.max(0, prev.remaining - 1)
      }));
    } catch (err: unknown) {
      console.error("Failed to approve curation decision:", err);
      const errMsg = err instanceof Error ? err.message : "Approval failed";
      setToast({ message: `Save error: ${errMsg}`, type: "error" });
      return null;
    } finally {
      setIsSaving(false);
      stateRef.current.isSaving = false;
    }

    if (!success) return null;
    const nextMeme = await loadMeme(currentMemeId, "next", false);
    return nextMeme;
  }, [user, loadMeme]);

  // Mobile Touch Gesture Actions
  const handleSwipeRight = useCallback(async () => {
    const s = stateRef.current;
    const j4 = s.currentMeme?.ai_judgements?.judge4;
    if (!j4?.corpus_status || s.isSaving) return;

    setSwipeAnimation("right");
    const nextMeme = await handleApproveAndAdvance("judge4", j4.corpus_status, j4);
    if (!nextMeme) {
      setSwipeAnimation(null);
    } else {
      setTimeout(() => setSwipeAnimation(null), 180);
    }
  }, [handleApproveAndAdvance]);

  const handleSwipeLeft = useCallback(async () => {
    const s = stateRef.current;
    const j5 = s.currentMeme?.ai_judgements?.judge5;
    if (!j5?.corpus_status || s.isSaving) return;

    setSwipeAnimation("left");
    const nextMeme = await handleApproveAndAdvance("judge5", j5.corpus_status, j5);
    if (!nextMeme) {
      setSwipeAnimation(null);
    } else {
      setTimeout(() => setSwipeAnimation(null), 180);
    }
  }, [handleApproveAndAdvance]);

  const handleDoubleTap = useCallback(() => {
    const s = stateRef.current;
    if (!s.currentMeme || s.isSaving || s.forceRemoveLoading) return;
    setIsPulseRemove(true);
    setTimeout(() => setIsPulseRemove(false), 500);
    setShowForceRemoveModal(true);
  }, []);

  const handleSwipeUp = useCallback(() => {
    setOverrideMode(true);
  }, []);

  const gestures = useCurateGestures({
    enabled: isMobile && !overrideMode && !showForceRemoveModal && !isSaving,
    handlers: {
      onSwipeRight: handleSwipeRight,
      onSwipeLeft: handleSwipeLeft,
      onSwipeUp: handleSwipeUp,
      onDoubleTap: handleDoubleTap
    }
  });

  // Permanently delete invalid/non-meme image from R2 and database
  const handleForceRemove = useCallback(async () => {
    const s = stateRef.current;
    if (!s.currentMeme || s.forceRemoveLoading || s.isSaving) return;
    const memeId = s.currentMeme.id;

    setForceRemoveLoading(true);
    setIsSaving(true);
    stateRef.current.isSaving = true;

    try {
      await forceRemoveMeme(memeId);
      setToast({
        message: "FORCE REMOVED ✓ (Purged from R2 & DB)",
        type: "success"
      });
      setShowForceRemoveModal(false);
      setForceRemoveReason("");
      // Remove any items for this meme from undoStack since deletion is permanent
      setUndoStack((prev) => prev.filter((item) => item.meme.id !== memeId));
      await loadMeme(memeId, "next", true);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Force remove failed";
      console.error("Failed to force-remove meme:", err);
      setToast({ message: errorMsg, type: "error" });
    } finally {
      setForceRemoveLoading(false);
      setIsSaving(false);
      stateRef.current.isSaving = false;
    }
  }, [loadMeme]);

  const handleToggleNsfw = useCallback(async () => {
    const meme = stateRef.current.currentMeme;
    if (!meme || nsfwLoading) return;

    const nextValue = !meme.is_nsfw;
    setNsfwLoading(true);
    try {
      await setMemeNsfw(meme.id, nextValue);
      setCurrentMeme((current) =>
        current && current.id === meme.id
          ? { ...current, is_nsfw: nextValue, nsfw_flagged_by: nextValue ? "curator" : null }
          : current
      );
      setToast({ message: nextValue ? "NSFW TAG ADDED" : "NSFW TAG REMOVED", type: "success" });
    } catch (err: unknown) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to update NSFW tag",
        type: "error"
      });
    } finally {
      setNsfwLoading(false);
    }
  }, [nsfwLoading]);

  // Topic Toggle (Max 3)
  const handleToggleTopic = useCallback((topicId: string) => {
    setTopics((prev) => {
      if (prev.includes(topicId)) {
        return prev.filter((t) => t !== topicId);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), topicId];
      }
      return [...prev, topicId];
    });
  }, []);

  // Tone Select (1 Dominant Tone)
  const handleSelectTone = useCallback((toneId: string) => {
    setTone((prev) => (prev === toneId ? null : toneId));
  }, []);

  // Humour Mechanism Toggle (Max 2)
  const handleToggleMechanism = useCallback((mechId: string) => {
    setMechanisms((prev) => {
      if (prev.includes(mechId)) {
        return prev.filter((m) => m !== mechId);
      }
      if (prev.length >= 2) {
        return [...prev.slice(1), mechId];
      }
      return [...prev, mechId];
    });
  }, []);

  // Undo Last Action
  const handleUndo = useCallback(() => {
    const s = stateRef.current;
    if (s.undoStack.length === 0 || s.isSaving) return;
    const last = s.undoStack[s.undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    setCurrentMeme(last.meme);
    setStatus(last.status);
    setTopics(last.topics);
    setTone(last.tone);
    setMechanisms(last.mechanisms);
    setDuplicateOf(last.duplicateOf);
    setNote(last.note);
  }, []);

  // Conflict-free Keyboard Event Listener (Active only in Judge view)
  useEffect(() => {
    if (viewMode !== "judge") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // If Force Remove modal is open, intercept Escape and Enter
      if (stateRef.current.showForceRemoveModal) {
        if (e.key === "Escape") {
          e.preventDefault();
          if (!stateRef.current.forceRemoveLoading) {
            setShowForceRemoveModal(false);
            setForceRemoveReason("");
          }
          return;
        }
        if (e.key === "Enter" && !stateRef.current.forceRemoveLoading) {
          e.preventDefault();
          handleForceRemove();
          return;
        }
        return; // Suspend all other shortcuts while modal is open
      }

      // Force Remove shortcut: Shift+X (works anywhere in Judge view)
      if (e.shiftKey && (e.key === "X" || e.key === "x")) {
        e.preventDefault();
        if (stateRef.current.currentMeme && !stateRef.current.forceRemoveLoading && !stateRef.current.isSaving) {
          setShowForceRemoveModal(true);
        }
        return;
      }

      const key = e.key.toLowerCase();

      // Escape stops AI Mode if running, or exits manual override back to review mode
      if (e.key === "Escape") {
        e.preventDefault();
        if (aiLoopRef.current.isRunning) {
          aiLoopRef.current.stop("Stopped via ESC key");
          return;
        }
        if (stateRef.current.overrideMode) {
          setOverrideMode(false);
          return;
        }
        return;
      }

      // Prev / Next on Left/Right Arrows (Available in both modes)
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (stateRef.current.currentMeme) {
          loadMeme(stateRef.current.currentMeme.id, "prev");
        }
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (stateRef.current.currentMeme) {
          loadMeme(stateRef.current.currentMeme.id, "next");
        }
        return;
      }

      // FORCE REMOVE: Shift+Delete or Shift+Backspace (Available in both modes)
      if (e.shiftKey && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        handleForceRemove();
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z, or U / Backspace (without Shift)
      if (((e.ctrlKey || e.metaKey) && key === "z") || key === "u" || (!e.shiftKey && e.key === "Backspace")) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // 0. REVIEW MODE KEYMAP (!overrideMode)
      if (!stateRef.current.overrideMode) {
        const j4 = stateRef.current.currentMeme?.ai_judgements?.judge4;
        const j5 = stateRef.current.currentMeme?.ai_judgements?.judge5;
        const hasJ4 = Boolean(j4?.corpus_status);
        const hasJ5 = Boolean(j5?.corpus_status);

        const bothEvaluated = hasJ4 && hasJ5;
        const isStatusConsensus = bothEvaluated && j4!.corpus_status === j5!.corpus_status;

        // Space OR Enter: Fast Approve / Adopt
        if (e.key === "Enter" || e.code === "Space") {
          e.preventDefault();
          if (bothEvaluated && isStatusConsensus) {
            // Full consensus: adopt consensus (defaults to J4 data)
            handleApproveAndAdvance("consensus", j4!.corpus_status, j4!);
            return;
          }
          if (hasJ4 && !hasJ5) {
            // Single AI: instantly adopt J4
            handleApproveAndAdvance("judge4", j4!.corpus_status, j4!);
            return;
          }
          if (!hasJ4 && hasJ5) {
            // Single AI: instantly adopt J5
            handleApproveAndAdvance("judge5", j5!.corpus_status, j5!);
            return;
          }
          if (!hasJ4 && !hasJ5) {
            // No AI evaluation ready: switch to override mode
            setOverrideMode(true);
            return;
          }
          // In case of conflict, Enter/Space does not blind-adopt; user must press 4, 5, or O
          return;
        }

        // Key 4: Adopt AI Judge 4
        if (key === "4" && hasJ4) {
          e.preventDefault();
          handleApproveAndAdvance("judge4", j4!.corpus_status, j4!);
          return;
        }

        // Key 5: Adopt AI Judge 5
        if (key === "5" && hasJ5) {
          e.preventDefault();
          handleApproveAndAdvance("judge5", j5!.corpus_status, j5!);
          return;
        }

        // Key O: Switch to manual override
        if (key === "o") {
          e.preventDefault();
          setOverrideMode(true);
          return;
        }

        return; // Prevent Layer 0 shortcuts when in Review mode
      }

      // 1. OVERRIDE / MANUAL MODE KEYMAP (overrideMode)

      // Confirm & advance on Enter or Space
      if (e.key === "Enter" || e.code === "Space") {
        e.preventDefault();
        handleApproveAndAdvance("manual");
        return;
      }

      // Editorial status: K, X, D, R
      if (key === "k") {
        e.preventDefault();
        setStatus("keep");
        return;
      }
      if (key === "x") {
        e.preventDefault();
        setStatus("excluded");
        handleApproveAndAdvance("manual", "excluded");
        return;
      }
      if (key === "d") {
        e.preventDefault();
        setStatus("duplicate");
        return;
      }
      if (key === "r") {
        e.preventDefault();
        setStatus("review_later");
        handleApproveAndAdvance("manual", "review_later");
        return;
      }

      // Topics shortcuts: 1-9, 0, -, =
      const matchedTopic = CURATION_TOPICS.find((t) => t.key.toLowerCase() === key);
      if (matchedTopic) {
        e.preventDefault();
        handleToggleTopic(matchedTopic.id);
        return;
      }

      // Tones shortcuts: Q, W, E, A, S, F
      const matchedTone = CURATION_TONES.find((t) => t.key.toLowerCase() === key);
      if (matchedTone) {
        e.preventDefault();
        handleSelectTone(matchedTone.id);
        return;
      }

      // Mechanisms shortcuts: Z, C, V, B, N, M, J, P, O
      const matchedMech = CURATION_MECHANISMS.find((m) => m.key.toLowerCase() === key);
      if (matchedMech) {
        e.preventDefault();
        handleToggleMechanism(matchedMech.id);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, handleApproveAndAdvance, handleForceRemove, handleUndo, handleToggleTopic, handleSelectTone, handleToggleMechanism, loadMeme]);

  if (!token || !user) {
    return <CurateLogin onLoginSuccess={handleLoginSuccess} />;
  }

  // Superadmin Command Center View
  if (user.role === "superadmin" && viewMode === "super") {
    return (
      <CurateSuperDashboard
        onSwitchToJudgeMode={() => setViewMode("judge")}
        onLogout={handleLogout}
      />
    );
  }

  const percentComplete = stats.total > 0
    ? Math.min(100, Math.round((stats.reviewed / stats.total) * 100))
    : 0;

  return (
    <div className="curate-root">
      {/* Top Header */}
      <header className="curate-topbar">
        {isMobile ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="curate-anton" style={{ fontSize: "17px", color: "#9b30ff" }}>
                CURATOR
              </span>
              <span style={{ fontSize: "11px", background: "#262626", padding: "2px 6px", borderRadius: "2px", color: "#f4c300", fontFamily: "monospace" }}>
                {stats.reviewed}/{stats.total} ({percentComplete}%)
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => loadMeme(currentMeme?.id, "next", true)}
                disabled={loading}
                style={{
                  background: "#222",
                  border: "1px solid #555",
                  color: "#f4c300",
                  padding: "4px 8px",
                  fontSize: "12px",
                  cursor: "pointer",
                  borderRadius: "2px"
                }}
                title="Refresh"
              >
                🔄
              </button>
              <button
                type="button"
                onClick={() => setShowMobileMenu((prev) => !prev)}
                style={{
                  background: showMobileMenu ? "#9b30ff" : "#222",
                  border: "1px solid #9b30ff",
                  color: "#fff",
                  padding: "4px 8px",
                  fontSize: "12px",
                  cursor: "pointer",
                  borderRadius: "2px"
                }}
                title="Toggle menu"
              >
                ⚙️
              </button>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#FF3B30",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontFamily: "Oswald"
                }}
              >
                LOGOUT
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span className="curate-anton" style={{ fontSize: "20px", color: "#9b30ff" }}>
                MEME CAPSULE CURATOR
              </span>
              <span style={{ fontSize: "11px", background: "#262626", padding: "3px 8px", borderRadius: "2px", color: "#f4c300", fontFamily: "monospace" }}>
                {stats.reviewed} / {stats.total} REVIEWED ({percentComplete}%)
              </span>
            </div>

            {/* Center: Queue Selector & Refresh */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "11px", color: "#888" }}>QUEUE:</span>
              <select
                value={filterQueue}
                onChange={(e) => setFilterQueue(e.target.value)}
                style={{
                  background: "#262626",
                  border: "1px solid #9b30ff",
                  color: "#f4c300",
                  padding: "4px 10px",
                  fontFamily: "Oswald",
                  fontSize: "12px",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value="unreviewed">Unreviewed Memes</option>
                <option value="review_later">⚠️ Review Later Queue</option>
                <option value="keep">✓ Kept Active Memes</option>
                <option value="excluded">✕ Excluded Memes</option>
                <option value="duplicate">⎘ Duplicates</option>
                <option value="all">All Corpus</option>
              </select>

              <button
                type="button"
                onClick={handleToggleNsfw}
                disabled={nsfwLoading}
                style={{
                  background: currentMeme?.is_nsfw ? "#dd0061" : "#1c1b1b",
                  border: "2px solid #dd0061",
                  color: "#fff",
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontFamily: "Oswald, sans-serif",
                  fontWeight: "bold",
                  cursor: nsfwLoading ? "not-allowed" : "pointer",
                  opacity: nsfwLoading ? 0.6 : 1,
                  boxShadow: nsfwLoading ? "none" : "2px 2px 0px #dd0061",
                  letterSpacing: "0.5px"
                }}
                title="Toggle NSFW moderation tag"
              >
                {nsfwLoading ? "SAVING..." : currentMeme?.is_nsfw ? "✓ NSFW TAGGED" : "⚠ TAG NSFW"}
              </button>
              <button
                type="button"
                onClick={() => loadMeme(currentMeme?.id, "next", true)}
                disabled={loading}
                style={{
                  background: "#222",
                  border: "1px solid #555",
                  color: "#f4c300",
                  padding: "4px 10px",
                  fontFamily: "Anton",
                  fontSize: "12px",
                  cursor: "pointer"
                }}
                title="Reload queue from server"
              >
                {loading ? "..." : "🔄 REFRESH"}
              </button>

              <button
                type="button"
                onClick={() => setShowStatsModal(true)}
                style={{
                  background: "#9b30ff",
                  border: "1px solid #f4c300",
                  color: "#fff",
                  padding: "4px 12px",
                  fontFamily: "Anton",
                  fontSize: "12px",
                  cursor: "pointer"
                }}
              >
                📊 STATS & EXPORT
              </button>
            </div>

            {/* Right: User profile, superadmin switch and logout */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              {user.role === "superadmin" && (
                <button
                  type="button"
                  onClick={() => setViewMode("super")}
                  style={{
                    background: "#f4c300",
                    color: "#121212",
                    border: "none",
                    padding: "4px 10px",
                    fontFamily: "Anton",
                    fontSize: "11px",
                    cursor: "pointer"
                  }}
                >
                  🛡️ SUPER ADMIN VIEW
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowAccountModal(true)}
                style={{
                  background: "#262626",
                  border: "1px solid #9b30ff",
                  color: "#f4c300",
                  padding: "4px 10px",
                  fontFamily: "Oswald",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
                title="Manage your username, display name, and password"
              >
                <span>👤 {user.display_name}</span>
                <span style={{ fontSize: "10px", color: "#aaa", fontFamily: "monospace" }}>({user.username})</span>
                <span style={{ fontSize: "10px", color: "#9b30ff" }}>⚙️</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#FF3B30",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontFamily: "Oswald",
                  letterSpacing: "0.5px"
                }}
              >
                LOG OUT
              </button>
            </div>
          </>
        )}

        {/* Progress Bar Line */}
        <div className="curate-progress-bar">
          <div className="curate-progress-fill" style={{ width: `${percentComplete}%` }} />
        </div>
      </header>

      {/* Mobile Tray / Drawer (when showMobileMenu is true) */}
      {isMobile && showMobileMenu && (
        <div className="curate-mobile-drawer">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <span style={{ fontSize: "12px", color: "#888", fontFamily: "Oswald" }}>QUEUE:</span>
            <select
              value={filterQueue}
              onChange={(e) => {
                setFilterQueue(e.target.value);
                setShowMobileMenu(false);
              }}
              style={{
                flex: 1,
                background: "#262626",
                border: "1px solid #9b30ff",
                color: "#f4c300",
                padding: "6px 8px",
                fontFamily: "Oswald",
                fontSize: "13px"
              }}
            >
              <option value="unreviewed">Unreviewed Memes</option>
              <option value="review_later">⚠️ Review Later Queue</option>
              <option value="keep">✓ Kept Active Memes</option>
              <option value="excluded">✕ Excluded Memes</option>
              <option value="duplicate">⎘ Duplicates</option>
              <option value="all">All Corpus</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <button
              type="button"
              onClick={handleToggleNsfw}
              disabled={nsfwLoading}
              style={{
                background: currentMeme?.is_nsfw ? "#dd0061" : "#1c1b1b",
                border: "1px solid #dd0061",
                color: "#fff",
                padding: "8px",
                fontSize: "12px",
                fontFamily: "Oswald",
                cursor: "pointer"
              }}
            >
              {nsfwLoading ? "SAVING..." : currentMeme?.is_nsfw ? "✓ NSFW (18+)" : "🔞 TAG NSFW"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowStatsModal(true);
                setShowMobileMenu(false);
              }}
              style={{
                background: "#9b30ff",
                border: "1px solid #f4c300",
                color: "#fff",
                padding: "8px",
                fontSize: "12px",
                fontFamily: "Anton",
                cursor: "pointer"
              }}
            >
              📊 STATS
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "6px", borderTop: "1px solid #333" }}>
            <button
              type="button"
              onClick={() => {
                setShowAccountModal(true);
                setShowMobileMenu(false);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#f4c300",
                fontSize: "12px",
                cursor: "pointer",
                padding: 0
              }}
            >
              👤 {user.display_name} ({user.username})
            </button>
            {user.role === "superadmin" && (
              <button
                type="button"
                onClick={() => setViewMode("super")}
                style={{
                  background: "#f4c300",
                  color: "#121212",
                  border: "none",
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontFamily: "Anton",
                  cursor: "pointer"
                }}
              >
                SUPER ADMIN
              </button>
            )}
          </div>
        </div>
      )}

      {/* AI Judge Continuous Console — Visible to AI Judge operators (judge4, judge5) on Desktop only */}
      {!isMobile && (user.username === "judge4" || user.username === "judge5") && (
        <div style={{ padding: "0 24px", maxWidth: "1600px", width: "100%", margin: "16px auto 0 auto" }}>
          <AiJudgeConsole
            userId={user?.id}
            config={aiConfig}
            onUpdateConfig={setAiConfig}
            isRunning={aiLoop.isRunning}
            loopState={aiLoop.loopState}
            statusMessage={aiLoop.statusMessage}
            previewProgress={aiLoop.previewProgress}
            lastDecision={aiLoop.lastDecision}
            errorMessage={aiLoop.errorMessage}
            batchProcessed={aiLoop.batchProcessed}
            recoveredCount={aiLoop.recoveredCount}
            skippedCount={aiLoop.skippedCount}
            onStart={aiLoop.start}
            onStop={aiLoop.stop}
          />
        </div>
      )}

      {/* Main Curation Workspace */}
      {isMobile ? (
        <main className="curate-main-grid curate-main-mobile">
          {/* 1. Mobile Compact AI Strip (above meme) */}
          {!overrideMode && currentMeme && (
            <AiReviewPanel
              j4={currentMeme.ai_judgements?.judge4}
              j5={currentMeme.ai_judgements?.judge5}
              onEnterOverride={() => setOverrideMode(true)}
              onAdopt={(j, src) => handleApproveAndAdvance(src, j.corpus_status, j)}
              onForceRemove={handleForceRemove}
              isMobile={true}
            />
          )}

          {/* 2. Mobile Dynamic Meme Card with Gestures */}
          <section
            className={`curate-meme-card curate-meme-card--mobile ${
              swipeAnimation === "right"
                ? "curate-meme-card--swiping-right"
                : swipeAnimation === "left"
                ? "curate-meme-card--swiping-left"
                : swipeAnimation === "up"
                ? "curate-meme-card--swiping-up"
                : ""
            } ${isPulseRemove ? "curate-meme-card--force-remove-pulse" : ""}`}
            onTouchStart={gestures.onTouchStart}
            onTouchMove={gestures.onTouchMove}
            onTouchEnd={gestures.onTouchEnd}
            onTouchCancel={gestures.onTouchCancel}
            style={{
              transform:
                gestures.isDragging && gestures.dragOffset.x !== 0
                  ? `translateX(${gestures.dragOffset.x * 0.75}px) rotate(${gestures.dragOffset.x * 0.04}deg)`
                  : undefined
            }}
          >
            {/* Real-time Gesture Direction Badges */}
            <div
              className={`curate-swipe-indicator curate-swipe-indicator--right ${
                gestures.swipePreview === "right" ? "visible" : ""
              }`}
            >
              ADOPT J4 ✓
            </div>
            <div
              className={`curate-swipe-indicator curate-swipe-indicator--left ${
                gestures.swipePreview === "left" ? "visible" : ""
              }`}
            >
              ✓ ADOPT J5
            </div>
            <div
              className={`curate-swipe-indicator curate-swipe-indicator--up ${
                gestures.swipePreview === "up" ? "visible" : ""
              }`}
            >
              ✏️ OVERRIDE
            </div>

            <div className="curate-meme-display">
              {loading && !currentMeme ? (
                <div style={{ color: "#888" }}>LOADING MEME...</div>
              ) : currentMeme ? (
                <img
                  key={currentMeme.id}
                  src={currentMeme.image_url}
                  alt={currentMeme.title}
                  className="curate-meme-img"
                />
              ) : (
                <div style={{ textAlign: "center", color: "#888", padding: "20px" }}>
                  <h3 className="curate-anton" style={{ color: "#34C759", fontSize: "24px" }}>ALL DONE!</h3>
                  <p style={{ fontSize: "12px" }}>Switch queues or export your curated dataset.</p>
                </div>
              )}
            </div>

            {currentMeme && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #282828" }}>
                <div>
                  <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#888" }}>ID: {currentMeme.id}</div>
                  <div style={{ fontSize: "13px", fontWeight: "bold", color: "#fff" }}>{currentMeme.title}</div>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => loadMeme(currentMeme.id, "prev")}
                    style={{ background: "#222", border: "1px solid #444", color: "#fff", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                    title="Previous"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => loadMeme(currentMeme.id, "next")}
                    style={{ background: "#222", border: "1px solid #444", color: "#fff", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                    title="Next"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 3. Mobile Quick Action Tap Buttons Bar */}
          {!overrideMode && currentMeme && (
            <div className="curate-mobile-quick-actions">
              <button
                type="button"
                className="curate-mobile-action-btn curate-mobile-action-btn--j4"
                onClick={handleSwipeRight}
                disabled={isSaving || !currentMeme.ai_judgements?.judge4?.corpus_status}
                style={{
                  opacity: currentMeme.ai_judgements?.judge4?.corpus_status ? 1 : 0.4
                }}
              >
                <span>ADOPT J4</span>
                <span style={{ fontSize: "10px", opacity: 0.8 }}>→ SWIPE</span>
              </button>

              <button
                type="button"
                className="curate-mobile-action-btn curate-mobile-action-btn--j5"
                onClick={handleSwipeLeft}
                disabled={isSaving || !currentMeme.ai_judgements?.judge5?.corpus_status}
                style={{
                  opacity: currentMeme.ai_judgements?.judge5?.corpus_status ? 1 : 0.4
                }}
              >
                <span>ADOPT J5</span>
                <span style={{ fontSize: "10px", opacity: 0.8 }}>← SWIPE</span>
              </button>

              <button
                type="button"
                className="curate-mobile-action-btn curate-mobile-action-btn--override"
                onClick={() => setOverrideMode(true)}
              >
                <span>✏️ OVERRIDE</span>
                <span style={{ fontSize: "10px", opacity: 0.8 }}>↑ SWIPE</span>
              </button>

              <button
                type="button"
                className="curate-mobile-action-btn curate-mobile-action-btn--remove"
                onClick={() => setShowForceRemoveModal(true)}
                disabled={forceRemoveLoading}
              >
                <span>🗑️ REMOVE</span>
                <span style={{ fontSize: "10px", opacity: 0.8 }}>×2 TAP</span>
              </button>
            </div>
          )}

          {/* 4. Mobile Manual Override Section (Scrolls below meme card on mobile) */}
          <div style={{ display: overrideMode ? "block" : "none", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", background: "#1c1b1b", padding: "10px 12px", border: "1px solid #f4c300", boxShadow: "2px 2px 0px #f4c300" }}>
              <span style={{ fontSize: "14px", color: "#f4c300", fontFamily: "Anton", letterSpacing: "0.5px" }}>
                ✏️ MANUAL OVERRIDE MODE
              </span>
              <button
                type="button"
                onClick={() => setOverrideMode(false)}
                style={{
                  background: "#262626",
                  border: "1px solid #555",
                  color: "#ddd",
                  padding: "6px 10px",
                  fontSize: "11px",
                  cursor: "pointer",
                  fontFamily: "Anton"
                }}
              >
                BACK TO AI REVIEW
              </button>
            </div>

            <AiPreJudgePanel prediction={currentMeme?.ai_prediction ?? null} />

            {/* Layer 0: Editorial Judgment */}
            <EditorialButtons
              currentStatus={status}
              duplicateOf={duplicateOf}
              onSelectStatus={(s) => {
                setStatus(s);
                if (s === "excluded" || s === "review_later") {
                  handleApproveAndAdvance("manual", s);
                }
              }}
              onChangeDuplicateOf={setDuplicateOf}
            />

            {/* Layer 1: Categorization */}
            <CategorizationPanel
              topics={topics}
              tone={tone}
              mechanisms={mechanisms}
              note={note}
              onToggleTopic={handleToggleTopic}
              onSelectTone={handleSelectTone}
              onToggleMechanism={handleToggleMechanism}
              onChangeNote={setNote}
            />

            {/* Confirm & Save Button Row */}
            <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexDirection: "column" }}>
              <button
                type="button"
                onClick={() => handleApproveAndAdvance("manual")}
                disabled={isSaving || !currentMeme}
                style={{
                  width: "100%",
                  background: "#34C759",
                  color: "#121212",
                  border: "2px solid #f4c300",
                  padding: "14px",
                  fontFamily: "Anton",
                  fontSize: "16px",
                  cursor: "pointer",
                  boxShadow: "3px 3px 0px #f4c300"
                }}
              >
                {isSaving ? "SAVING..." : "CONFIRM & ADVANCE ➔"}
              </button>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  style={{
                    flex: 1,
                    background: "#262626",
                    border: "1px solid #444",
                    color: "#f4c300",
                    padding: "10px",
                    fontFamily: "Anton",
                    fontSize: "13px",
                    cursor: "pointer",
                    opacity: undoStack.length ? 1 : 0.4
                  }}
                >
                  UNDO
                </button>

                <button
                  type="button"
                  onClick={handleForceRemove}
                  disabled={isSaving || !currentMeme}
                  style={{
                    flex: 1,
                    background: "#380d0d",
                    border: "1px solid #FF3B30",
                    color: "#FF3B30",
                    padding: "10px",
                    fontFamily: "Anton",
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: "2px 2px 0px #FF3B30"
                  }}
                >
                  🗑️ FORCE REMOVE
                </button>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="curate-main-grid">
          {/* Left: Large Meme Stage */}
          <section className="curate-meme-card">
            <div className="curate-meme-display">
              {loading && !currentMeme ? (
                <div style={{ color: "#888" }}>LOADING MEME...</div>
              ) : currentMeme ? (
                <img
                  key={currentMeme.id}
                  src={currentMeme.image_url}
                  alt={currentMeme.title}
                  className="curate-meme-img"
                />
              ) : (
                <div style={{ textAlign: "center", color: "#888" }}>
                  <h3 className="curate-anton" style={{ color: "#34C759", fontSize: "28px" }}>ALL DONE IN THIS QUEUE!</h3>
                  <p style={{ fontSize: "13px" }}>Switch queues or export your curated dataset.</p>
                </div>
              )}
            </div>

            {currentMeme && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #282828" }}>
                <div>
                  <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#888" }}>ID: {currentMeme.id}</div>
                  <div style={{ fontSize: "14px", fontWeight: "bold", color: "#fff" }}>{currentMeme.title}</div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: isNsfw ? "rgba(221, 0, 97, 0.2)" : "#1e1e1e",
                      border: `1px solid ${isNsfw ? "#dd0061" : "#444"}`,
                      borderRadius: "3px",
                      padding: "4px 8px",
                      cursor: "pointer",
                      userSelect: "none"
                    }}
                    title="Flag content as 18+ NSFW (client-gated, independent of exclude)"
                  >
                    <input
                      type="checkbox"
                      checked={isNsfw}
                      onChange={() => handleToggleNsfw()}
                      disabled={nsfwLoading}
                      style={{ accentColor: "#dd0061", cursor: "pointer" }}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "bold",
                        fontFamily: "Oswald, sans-serif",
                        color: isNsfw ? "#ff4d88" : "#aaa",
                        letterSpacing: "0.5px"
                      }}
                    >
                      🔞 NSFW {isNsfw ? "(18+)" : ""}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForceRemoveModal(true)}
                    disabled={forceRemoveLoading}
                    style={{
                      background: "#1c1b1b",
                      border: "2px solid #dd0061",
                      color: "#dd0061",
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontFamily: "Oswald, sans-serif",
                      fontWeight: "bold",
                      cursor: forceRemoveLoading ? "not-allowed" : "pointer",
                      boxShadow: "2px 2px 0px #dd0061",
                      letterSpacing: "0.5px"
                    }}
                    title="Permanently remove meme from storage & database (Shift+X)"
                  >
                    ⚡ FORCE REMOVE [SHIFT+X]
                  </button>
                  <button
                    type="button"
                    onClick={() => loadMeme(currentMeme.id, "prev")}
                    style={{ background: "#222", border: "1px solid #444", color: "#fff", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                    title="Previous Meme (Left Arrow)"
                  >
                    ← PREV
                  </button>
                  <button
                    type="button"
                    onClick={() => loadMeme(currentMeme.id, "next")}
                    style={{ background: "#222", border: "1px solid #444", color: "#fff", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                    title="Next Meme (Right Arrow)"
                  >
                    NEXT →
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Right: Review Panel OR Override Mode */}
          <section style={{ display: "flex", flexDirection: "column" }}>
            {!overrideMode && currentMeme && (
              <AiReviewPanel
                j4={currentMeme.ai_judgements?.judge4}
                j5={currentMeme.ai_judgements?.judge5}
                onEnterOverride={() => setOverrideMode(true)}
                onAdopt={(j, src) => handleApproveAndAdvance(src, j.corpus_status, j)}
                onForceRemove={handleForceRemove}
              />
            )}

            <div style={{ display: overrideMode ? "block" : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", background: "#1c1b1b", padding: "10px 14px", border: "1px solid #f4c300", boxShadow: "2px 2px 0px #f4c300" }}>
                <span style={{ fontSize: "15px", color: "#f4c300", fontFamily: "Anton", letterSpacing: "0.5px" }}>
                  ✏️ MANUAL OVERRIDE MODE
                </span>
                <button
                  type="button"
                  onClick={() => setOverrideMode(false)}
                  style={{
                    background: "#262626",
                    border: "1px solid #555",
                    color: "#ddd",
                    padding: "4px 10px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontFamily: "Anton"
                  }}
                >
                  BACK TO AI REVIEW [ESC]
                </button>
              </div>

              <AiPreJudgePanel prediction={currentMeme?.ai_prediction ?? null} />

              {/* Layer 0: Editorial Judgment */}
              <EditorialButtons
                currentStatus={status}
                duplicateOf={duplicateOf}
                onSelectStatus={(s) => {
                  setStatus(s);
                  if (s === "excluded" || s === "review_later") {
                    handleApproveAndAdvance("manual", s);
                  }
                }}
                onChangeDuplicateOf={setDuplicateOf}
              />

              {/* Layer 1: Multi-Dimensional Categorization (Topics, Tone, Mechanisms) */}
              <CategorizationPanel
                topics={topics}
                tone={tone}
                mechanisms={mechanisms}
                note={note}
                onToggleTopic={handleToggleTopic}
                onSelectTone={handleSelectTone}
                onToggleMechanism={handleToggleMechanism}
                onChangeNote={setNote}
              />

              {/* Confirm & Save Button Row */}
              <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleApproveAndAdvance("manual")}
                  disabled={isSaving || !currentMeme}
                  style={{
                    flex: "2 1 200px",
                    background: "#34C759",
                    color: "#121212",
                    border: "2px solid #f4c300",
                    padding: "12px",
                    fontFamily: "Anton",
                    fontSize: "17px",
                    cursor: "pointer",
                    boxShadow: "3px 3px 0px #f4c300"
                  }}
                >
                  {isSaving ? "SAVING..." : "CONFIRM & ADVANCE ➔ [ENTER / SPACE]"}
                </button>

                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  style={{
                    flex: "1 1 100px",
                    background: "#262626",
                    border: "1px solid #444",
                    color: "#f4c300",
                    padding: "12px 14px",
                    fontFamily: "Anton",
                    fontSize: "14px",
                    cursor: "pointer",
                    opacity: undoStack.length ? 1 : 0.4
                  }}
                  title="Undo last action [Key: U / Ctrl+Z]"
                >
                  UNDO [U]
                </button>

                <button
                  type="button"
                  onClick={handleForceRemove}
                  disabled={isSaving || !currentMeme}
                  style={{
                    flex: "1 1 140px",
                    background: "#380d0d",
                    border: "1px solid #FF3B30",
                    color: "#FF3B30",
                    padding: "12px 14px",
                    fontFamily: "Anton",
                    fontSize: "14px",
                    cursor: "pointer",
                    boxShadow: "2px 2px 0px #FF3B30"
                  }}
                  title="Permanently remove invalid non-meme from R2 & DB [Key: Shift+Delete]"
                >
                  🗑️ FORCE REMOVE [SHIFT+DEL]
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Keyboard Shortcuts Footer Strip */}
      <footer className="curate-shortcuts-footer">
        {isMobile ? (
          <>
            <span><span className="curate-hotkey-tag">→</span> ADOPT J4</span>
            <span><span className="curate-hotkey-tag">←</span> ADOPT J5</span>
            <span><span className="curate-hotkey-tag">↑</span> OVERRIDE</span>
            <span><span className="curate-hotkey-tag">×2</span> FORCE REMOVE</span>
            <span><span className="curate-hotkey-tag">U</span> UNDO</span>
          </>
        ) : !overrideMode ? (
          <>
            <span><span className="curate-hotkey-tag">SPACE / ENTER</span> APPROVE</span>
            <span><span className="curate-hotkey-tag">4</span> ADOPT J4</span>
            <span><span className="curate-hotkey-tag">5</span> ADOPT J5</span>
            <span><span className="curate-hotkey-tag">O</span> OVERRIDE</span>
            <span><span className="curate-hotkey-tag">SHIFT+DEL</span> FORCE REMOVE</span>
            <span><span className="curate-hotkey-tag">CTRL+Z / U</span> UNDO</span>
            <span><span className="curate-hotkey-tag">←/→</span> PREV/NEXT</span>
            <span style={{ color: "#dd0061" }}><span className="curate-hotkey-tag" style={{ border: "1px solid #dd0061", color: "#dd0061" }}>SHIFT+X</span> FORCE REMOVE</span>
          </>
        ) : (
          <>
            <span><span className="curate-hotkey-tag">SPACE / ENTER</span> CONFIRM</span>
            <span><span className="curate-hotkey-tag">K,X,D,R</span> ACTION</span>
            <span><span className="curate-hotkey-tag">1-9,0,-,=</span> TOPICS (MAX 3)</span>
            <span><span className="curate-hotkey-tag">Q,W,E,A,S,F</span> TONE (1)</span>
            <span><span className="curate-hotkey-tag">Z,C,V,B,N,M,J,P,O</span> MECHANISMS</span>
            <span><span className="curate-hotkey-tag">ESC</span> AI REVIEW</span>
            <span><span className="curate-hotkey-tag">SHIFT+DEL</span> FORCE REMOVE</span>
            <span><span className="curate-hotkey-tag">CTRL+Z / U</span> UNDO</span>
            <span><span className="curate-hotkey-tag">←/→</span> PREV/NEXT</span>
            <span style={{ color: "#dd0061" }}><span className="curate-hotkey-tag" style={{ border: "1px solid #dd0061", color: "#dd0061" }}>SHIFT+X</span> FORCE REMOVE</span>
          </>
        )}
      </footer>

      {/* Floating Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1100,
            padding: "10px 20px",
            background: toast.type === "success" ? "#34C759" : toast.type === "warning" ? "#FF9F0A" : "#FF3B30",
            color: "#121212",
            fontFamily: "Anton, sans-serif",
            fontSize: "15px",
            letterSpacing: "1px",
            boxShadow: "4px 4px 0px #000",
            border: "2px solid #000"
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Stats & Export Modal */}
      {showStatsModal && <CurationStatsModal onClose={() => setShowStatsModal(false)} />}

      {/* Force Remove Confirmation Modal */}
      {showForceRemoveModal && currentMeme && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px"
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !forceRemoveLoading) {
              setShowForceRemoveModal(false);
              setForceRemoveReason("");
            }
          }}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "2px solid #dd0061",
              boxShadow: "6px 6px 0px #dd0061",
              padding: "28px",
              maxWidth: "480px",
              width: "100%",
              textAlign: "center"
            }}
          >
            <div style={{ color: "#dd0061", fontFamily: "Anton, sans-serif", fontSize: "24px", letterSpacing: "1px", marginBottom: "8px" }}>
              PERMANENT FORCE REMOVE
            </div>

            <div
              style={{
                width: "140px",
                height: "140px",
                margin: "12px auto 16px auto",
                border: "2px solid #333",
                background: "#121212",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden"
              }}
            >
              <img
                src={currentMeme.image_url}
                alt={currentMeme.title}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>

            <div style={{ marginBottom: "12px", fontSize: "12px" }}>
              <div style={{ color: "#8e8e93", fontFamily: "monospace", marginBottom: "4px" }}>
                ID: {currentMeme.id}
              </div>
              <div style={{ color: "#ffffff", fontWeight: 500, fontSize: "14px" }}>
                {currentMeme.title}
              </div>
            </div>

            <p style={{ fontSize: "13px", color: "#aaa", marginBottom: "16px", lineHeight: "1.5" }}>
              PERMANENTLY DELETE THIS MEME? It will be removed from R2 storage and hidden from the app immediately. This cannot be undone.
            </p>

            <input
              type="text"
              placeholder="Reason (optional, max 200 chars)"
              value={forceRemoveReason}
              onChange={(e) => setForceRemoveReason(e.target.value.slice(0, 200))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !forceRemoveLoading) {
                  e.preventDefault();
                  handleForceRemove();
                } else if (e.key === "Escape" && !forceRemoveLoading) {
                  e.preventDefault();
                  setShowForceRemoveModal(false);
                  setForceRemoveReason("");
                }
              }}
              disabled={forceRemoveLoading}
              style={{
                width: "100%",
                padding: "8px 12px",
                marginBottom: "16px",
                background: "#262626",
                border: "1px solid #444",
                color: "#ffffff",
                fontSize: "12px",
                fontFamily: "monospace",
                boxSizing: "border-box",
                opacity: forceRemoveLoading ? 0.5 : 1,
                outline: "none"
              }}
            />

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  setShowForceRemoveModal(false);
                  setForceRemoveReason("");
                }}
                disabled={forceRemoveLoading}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: "#262626",
                  border: "1px solid #444",
                  color: "#888",
                  fontSize: "13px",
                  fontFamily: "Oswald, sans-serif",
                  cursor: forceRemoveLoading ? "not-allowed" : "pointer",
                  opacity: forceRemoveLoading ? 0.5 : 1
                }}
              >
                CANCEL (ESC)
              </button>
              <button
                type="button"
                onClick={handleForceRemove}
                disabled={forceRemoveLoading}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: "#dd0061",
                  border: "2px solid #dd0061",
                  color: "#000",
                  fontSize: "13px",
                  fontFamily: "Anton, sans-serif",
                  fontWeight: "bold",
                  letterSpacing: "0.5px",
                  cursor: forceRemoveLoading ? "not-allowed" : "pointer",
                  boxShadow: forceRemoveLoading ? "none" : "2px 2px 0px #ffffff",
                  opacity: forceRemoveLoading ? 0.7 : 1
                }}
              >
                {forceRemoveLoading ? "DELETING..." : "CONFIRM REMOVAL (ENTER)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Settings Modal */}
      {showAccountModal && user && (
        <CurateAccountModal
          user={user}
          onClose={() => setShowAccountModal(false)}
          onAccountUpdated={(updated) => {
            setUser(updated);
            sessionStorage.setItem("curator_user", JSON.stringify(updated));
          }}
        />
      )}
    </div>
  );
}
