import React, { useState, useEffect, useCallback } from "react";
import type {
  AiJudgeConfig,
  AiJudgeDecision,
  AiJudgeLoopState,
  AiProviderKey,
  JudgeAiPreset
} from "./aiJudgeTypes";
import { AI_PROVIDER_PRESETS, DEFAULT_AI_JUDGE_CONFIG } from "./aiJudgeTypes";
import { testAiConnection } from "./aiJudgeClient";

interface AiJudgeConsoleProps {
  userId?: string;
  config: AiJudgeConfig;
  onUpdateConfig: (nextConfig: AiJudgeConfig) => void;
  isRunning: boolean;
  loopState: AiJudgeLoopState;
  statusMessage: string;
  previewProgress: number;
  lastDecision: AiJudgeDecision | null;
  errorMessage: string | null;
  batchProcessed: number;
  recoveredCount?: number;
  skippedCount?: number;
  onStart: () => void;
  onStop: () => void;
}

export default function AiJudgeConsole({
  userId,
  config,
  onUpdateConfig,
  isRunning,
  loopState,
  statusMessage,
  previewProgress,
  lastDecision,
  errorMessage,
  batchProcessed,
  recoveredCount = 0,
  skippedCount = 0,
  onStart,
  onStop
}: AiJudgeConsoleProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Judge-Isolated Saved Presets
  const [savedPresets, setSavedPresets] = useState<JudgeAiPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [presetActionMessage, setPresetActionMessage] = useState<string | null>(null);

  // Dedicated API Key Encryption Password Security State
  const [hasApiPassword, setHasApiPassword] = useState<boolean>(false);
  const [unlockedKeys, setUnlockedKeys] = useState<Record<string, string>>({});
  const [showUnlockPasswordModal, setShowUnlockPasswordModal] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<{
    type: "reveal" | "edit" | "delete" | "create";
    preset?: JudgeAiPreset;
  } | null>(null);
  const [unlockPasswordInput, setUnlockPasswordInput] = useState("");
  const [unlockErrorMsg, setUnlockErrorMsg] = useState<string | null>(null);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [verifiedPasswordSession, setVerifiedPasswordSession] = useState<string>("");

  // Edit / Reconfigure Preset Modal State
  const [showEditPresetModal, setShowEditPresetModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState<JudgeAiPreset | null>(null);
  const [editPresetName, setEditPresetName] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [editShowApiKey, setEditShowApiKey] = useState(false);
  const [editModelsList, setEditModelsList] = useState<string[]>([]);

  // Inline Add Model State
  const [showAddModelInline, setShowAddModelInline] = useState(false);
  const [inlineNewModelName, setInlineNewModelName] = useState("");
  const [isSavingModel, setIsSavingModel] = useState(false);

  const storageKey = userId ? `meme-capsule:ai-config:${userId}` : "meme-capsule:ai-judge-config";

  // Fetch Judge's Isolated Presets from D1
  const fetchPresets = useCallback(async () => {
    const token = sessionStorage.getItem("curator_token");
    if (!token) return;

    try {
      const res = await fetch("/api/curate/ai-presets", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (data.presets && Array.isArray(data.presets)) {
        setSavedPresets(data.presets);
        setHasApiPassword(Boolean(data.has_api_password));
        if (userId) {
          localStorage.setItem(`meme-capsule:ai-presets:${userId}`, JSON.stringify(data.presets));
        }
      }
    } catch {
      // Local storage fallback for this specific judge
      if (userId) {
        const cached = localStorage.getItem(`meme-capsule:ai-presets:${userId}`);
        if (cached) {
          try {
            setSavedPresets(JSON.parse(cached));
          } catch {
            // ignore
          }
        }
      }
    }
  }, [userId]);

  // Load configuration and presets on mount or user switch
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        onUpdateConfig({ ...DEFAULT_AI_JUDGE_CONFIG, ...parsed });
      } catch {
        // use defaults
      }
    }
    fetchPresets();
  }, [storageKey, fetchPresets]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateConfigField = <K extends keyof AiJudgeConfig>(field: K, value: AiJudgeConfig[K]) => {
    const updated = { ...config, [field]: value };
    onUpdateConfig(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleSelectProvider = (providerId: AiProviderKey) => {
    const preset = AI_PROVIDER_PRESETS.find((p) => p.id === providerId);
    if (!preset) return;

    // Check if there is an existing saved preset for this provider
    const existing = savedPresets.find((p) => p.provider === providerId);

    const updated: AiJudgeConfig = {
      ...config,
      provider: providerId,
      baseUrl: existing ? existing.base_url : preset.baseUrl,
      apiKey: existing ? existing.api_key : (config.provider === providerId ? config.apiKey : ""),
      model: existing ? existing.model : preset.defaultModel,
      activePresetId: existing ? existing.id : null
    };
    onUpdateConfig(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setTestResult(null);
  };

  const handleSelectModelChip = (modelName: string) => {
    updateConfigField("model", modelName);
  };

  const handleApplyPreset = (preset: JudgeAiPreset) => {
    const updated: AiJudgeConfig = {
      ...config,
      provider: preset.provider,
      baseUrl: preset.base_url,
      apiKey: preset.api_key,
      model: preset.model,
      activePresetId: preset.id
    };
    onUpdateConfig(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setPresetActionMessage(`Loaded preset: "${preset.preset_name}"`);
    setTestResult(null);
    setShowApiKey(Boolean(unlockedKeys[preset.id]));
    setTimeout(() => setPresetActionMessage(null), 3000);
  };

  const handleOpenUnlockChallenge = (
    type: "reveal" | "edit" | "delete" | "create",
    preset?: JudgeAiPreset
  ) => {
    setUnlockTarget({ type, preset });
    setUnlockPasswordInput("");
    setUnlockErrorMsg(null);
    setShowUnlockPasswordModal(true);
  };

  const handleVerifyUnlockPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredPass = unlockPasswordInput.trim();
    if (!enteredPass) {
      setUnlockErrorMsg("Please enter your API encryption password.");
      return;
    }

    const token = sessionStorage.getItem("curator_token");
    if (!token) {
      setUnlockErrorMsg("Session expired. Please re-login.");
      return;
    }

    setIsVerifyingPassword(true);
    setUnlockErrorMsg(null);

    try {
      if (!unlockTarget) return;

      if (unlockTarget.type === "reveal") {
        const targetId = activePreset?.id;
        if (!targetId) {
          throw new Error("Please select a saved provider preset first.");
        }

        const res = await fetch("/api/curate/ai-presets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            action: "reveal-key",
            id: targetId,
            api_password: enteredPass
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Incorrect API encryption password.");
        }

        if (data.api_key) {
          setUnlockedKeys((prev) => ({ ...prev, [targetId]: data.api_key }));
          setShowApiKey(true);
          setShowUnlockPasswordModal(false);
          setUnlockPasswordInput("");
          setPresetActionMessage("API key unlocked and revealed.");
          setTimeout(() => setPresetActionMessage(null), 3000);
        }
      } else {
        // Verify password against account endpoint
        const res = await fetch("/api/curate/account", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            action: "verify-api-password",
            api_password: enteredPass
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Incorrect API encryption password.");
        }

        setVerifiedPasswordSession(enteredPass);
        setShowUnlockPasswordModal(false);
        setUnlockPasswordInput("");

        if (unlockTarget.type === "create") {
          setShowSavePresetModal(true);
        } else if (unlockTarget.type === "edit" && unlockTarget.preset) {
          executeOpenEditPreset(unlockTarget.preset, enteredPass);
        } else if (unlockTarget.type === "delete" && unlockTarget.preset) {
          executeDeletePreset(unlockTarget.preset.id, unlockTarget.preset.preset_name, enteredPass);
        }
      }
    } catch (err: unknown) {
      setUnlockErrorMsg(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleToggleShowApiKey = () => {
    if (!hasApiPassword) {
      setShowApiKey(!showApiKey);
      return;
    }

    const currentKeyUnlocked = activePreset?.id ? Boolean(unlockedKeys[activePreset.id]) : false;

    if (currentKeyUnlocked) {
      // Re-lock: remove decrypted key from memory and hide
      if (activePreset?.id) {
        setUnlockedKeys((prev) => {
          const next = { ...prev };
          delete next[activePreset.id];
          return next;
        });
      }
      setShowApiKey(false);
      setPresetActionMessage("API key hidden and locked.");
      setTimeout(() => setPresetActionMessage(null), 3000);
    } else {
      handleOpenUnlockChallenge("reveal");
    }
  };

  const executeOpenEditPreset = (preset: JudgeAiPreset, verifiedPass?: string) => {
    setEditingPreset(preset);
    setEditPresetName(preset.preset_name);
    setEditBaseUrl(preset.base_url);
    const existingUnlockedKey = unlockedKeys[preset.id];
    setEditApiKey(existingUnlockedKey || "");
    setEditShowApiKey(Boolean(existingUnlockedKey));
    const mList = Array.isArray(preset.models) && preset.models.length > 0
      ? [...preset.models]
      : (preset.model ? [preset.model] : []);
    setEditModelsList(mList);
    setVerifiedPasswordSession(verifiedPass || "");
    setShowEditPresetModal(true);
  };

  const handleSaveEditedPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPreset) return;

    const token = sessionStorage.getItem("curator_token");
    if (!token) return;

    try {
      const res = await fetch("/api/curate/ai-presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingPreset.id,
          preset_name: editPresetName.trim() || editingPreset.preset_name,
          provider: editingPreset.provider,
          base_url: editBaseUrl.trim() || editingPreset.base_url,
          api_key: editApiKey.trim(),
          api_password: verifiedPasswordSession || undefined,
          model: editingPreset.model,
          models: editModelsList
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update preset.");

      if (data.preset) {
        setSavedPresets((prev) => [data.preset, ...prev.filter((p) => p.id !== data.preset.id)]);
        if (config.activePresetId === editingPreset.id || config.provider === editingPreset.provider) {
          const updated: AiJudgeConfig = {
            ...config,
            baseUrl: data.preset.base_url,
            apiKey: data.preset.api_key,
            model: data.preset.model,
            activePresetId: data.preset.id
          };
          onUpdateConfig(updated);
          localStorage.setItem(storageKey, JSON.stringify(updated));
        }
        setPresetActionMessage(`Updated preset: "${data.preset.preset_name}"`);
        setShowEditPresetModal(false);
        setEditingPreset(null);
        setVerifiedPasswordSession("");
        setTimeout(() => setPresetActionMessage(null), 3000);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error updating preset.");
    }
  };

  const handleRemoveModelFromPreset = async (presetId: string, modelToRemove: string) => {
    const token = sessionStorage.getItem("curator_token");
    if (!token) return;

    try {
      const res = await fetch(`/api/curate/ai-presets?id=${encodeURIComponent(presetId)}&model=${encodeURIComponent(modelToRemove)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Failed to remove model from preset.");

      setSavedPresets((prev) =>
        prev.map((p) => {
          if (p.id !== presetId) return p;
          const updatedModels = (p.models || []).filter((m) => m !== modelToRemove);
          const newCurrent = p.model === modelToRemove ? (updatedModels[0] || "") : p.model;
          return {
            ...p,
            models: updatedModels,
            model: newCurrent
          };
        })
      );

      setEditModelsList((prev) => prev.filter((m) => m !== modelToRemove));

      if (config.model === modelToRemove) {
        const remaining = editModelsList.filter((m) => m !== modelToRemove);
        if (remaining.length > 0) {
          updateConfigField("model", remaining[0]);
        }
      }

      setPresetActionMessage(`Removed model "${modelToRemove}" from preset.`);
      setTimeout(() => setPresetActionMessage(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error removing model.");
    }
  };

  const handleSaveCurrentAsPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    const token = sessionStorage.getItem("curator_token");
    if (!token) return;

    try {
      const res = await fetch("/api/curate/ai-presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          preset_name: newPresetName.trim(),
          provider: config.provider,
          base_url: config.baseUrl,
          api_key: config.apiKey,
          api_password: verifiedPasswordSession || undefined,
          model: config.model,
          models: [config.model]
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save preset.");
      }

      if (data.preset) {
        setSavedPresets((prev) => [data.preset, ...prev.filter((p) => p.id !== data.preset.id)]);
        updateConfigField("activePresetId", data.preset.id);
        setPresetActionMessage(`Saved preset: "${newPresetName.trim()}"`);
        setNewPresetName("");
        setShowSavePresetModal(false);
        setVerifiedPasswordSession("");
        setTimeout(() => setPresetActionMessage(null), 3000);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving preset.");
    }
  };

  const executeDeletePreset = async (presetId: string, presetName: string, apiPassword?: string) => {
    if (!window.confirm(`Delete preset "${presetName}" and all its saved models?`)) return;

    const token = sessionStorage.getItem("curator_token");
    if (!token) return;

    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (apiPassword) {
        headers["X-Api-Password"] = apiPassword;
      }
      const res = await fetch(`/api/curate/ai-presets?id=${encodeURIComponent(presetId)}`, {
        method: "DELETE",
        headers
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete preset.");
      }

      setSavedPresets((prev) => prev.filter((p) => p.id !== presetId));
      if (config.activePresetId === presetId) {
        updateConfigField("activePresetId", null);
      }
      setPresetActionMessage(`Deleted preset: "${presetName}"`);
      setTimeout(() => setPresetActionMessage(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete preset.");
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await testAiConnection(config);
    setTestResult(res);
    setIsTesting(false);
  };

  const isConfigured = Boolean(
    config.baseUrl && (config.apiKey || config.activePresetId || config.provider === "custom")
  );
  const activeTemplate = AI_PROVIDER_PRESETS.find((p) => p.id === config.provider) || AI_PROVIDER_PRESETS[0];

  const activePreset =
    savedPresets.find((p) => p.id === config.activePresetId) ||
    savedPresets.find((p) => p.provider === config.provider && (config.baseUrl ? p.base_url.includes(config.baseUrl) || config.baseUrl.includes(p.base_url) : true)) ||
    savedPresets.find((p) => p.provider === config.provider);

  const isKeyUnlocked = !hasApiPassword || Boolean(activePreset?.id && unlockedKeys[activePreset.id]);
  const isKeyEditable = !hasApiPassword || Boolean(activePreset?.id && unlockedKeys[activePreset.id]) || !activePreset?.id;
  const displayKeyValue = (hasApiPassword && !isKeyUnlocked)
    ? "••••••••••••••••••••••••••••••••"
    : (activePreset?.id && unlockedKeys[activePreset.id] ? unlockedKeys[activePreset.id] : config.apiKey);

  const handleAddAndSaveNewModel = async (e: React.FormEvent) => {
    e.preventDefault();
    const modelClean = inlineNewModelName.trim();
    if (!modelClean) return;

    setIsSavingModel(true);
    const token = sessionStorage.getItem("curator_token");

    try {
      const targetPreset = activePreset;
      const currentModels = targetPreset?.models || (targetPreset?.model ? [targetPreset.model] : []);
      const updatedModels = Array.from(new Set([...currentModels, modelClean]));

      if (targetPreset && token) {
        const res = await fetch("/api/curate/ai-presets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            action: "add-model",
            id: targetPreset.id,
            preset_name: targetPreset.preset_name,
            provider: targetPreset.provider,
            base_url: targetPreset.base_url,
            api_key: targetPreset.api_key,
            model: modelClean,
            models: updatedModels
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to auto-save model to preset.");

        if (data.preset) {
          setSavedPresets((prev) => [data.preset, ...prev.filter((p) => p.id !== data.preset.id)]);
        }
      } else if (token) {
        const res = await fetch("/api/curate/ai-presets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            preset_name: activeTemplate.name,
            provider: config.provider,
            base_url: config.baseUrl,
            api_key: config.apiKey,
            model: modelClean,
            models: [modelClean]
          })
        });
        const data = await res.json().catch(() => ({}));
        if (data.preset) {
          setSavedPresets((prev) => [data.preset, ...prev.filter((p) => p.id !== data.preset.id)]);
          updateConfigField("activePresetId", data.preset.id);
        }
      }

      updateConfigField("model", modelClean);
      setPresetActionMessage(`Added and saved model "${modelClean}"!`);
      setInlineNewModelName("");
      setShowAddModelInline(false);
      setTimeout(() => setPresetActionMessage(null), 3500);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving model.");
    } finally {
      setIsSavingModel(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#161616",
        border: isRunning ? "2px solid #34C759" : "2px solid #9b30ff",
        boxShadow: isRunning ? "4px 4px 0px #34C759" : "4px 4px 0px #f4c300",
        marginBottom: "16px",
        transition: "all 0.2s ease"
      }}
    >
      {/* 1. Primary HUD Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 18px",
          background: isRunning ? "rgba(52, 199, 89, 0.08)" : "#1c1b1b",
          borderBottom: isConfigOpen ? "2px solid #2a2a2a" : "none",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        {/* Left: Indicator & Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: isRunning ? "#34C759" : isConfigured ? "#f4c300" : "#888",
                boxShadow: isRunning ? "0 0 8px #34C759" : "none"
              }}
            />
            <span
              className="curate-anton"
              style={{
                fontSize: "18px",
                color: isRunning ? "#34C759" : "#f4c300",
                letterSpacing: "0.5px"
              }}
            >
              AI JUDGE CONSOLE
            </span>
          </div>

          {/* Current Status Pill */}
          <span
            style={{
              fontSize: "11px",
              fontFamily: "Oswald, sans-serif",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: "2px",
              backgroundColor:
                loopState === "analyzing"
                  ? "rgba(244, 195, 0, 0.2)"
                  : loopState === "retrying"
                  ? "rgba(255, 149, 0, 0.25)"
                  : loopState === "previewing"
                  ? "rgba(52, 199, 89, 0.2)"
                  : loopState === "error"
                  ? "rgba(255, 59, 48, 0.2)"
                  : "#262626",
              color:
                loopState === "analyzing"
                  ? "#f4c300"
                  : loopState === "retrying"
                  ? "#FF9500"
                  : loopState === "previewing"
                  ? "#34C759"
                  : loopState === "error"
                  ? "#FF3B30"
                  : "#888",
              border: `1px solid ${
                loopState === "analyzing"
                  ? "#f4c300"
                  : loopState === "retrying"
                  ? "#FF9500"
                  : loopState === "previewing"
                  ? "#34C759"
                  : loopState === "error"
                  ? "#FF3B30"
                  : "#444"
              }`
            }}
          >
            {loopState.toUpperCase()}
          </span>

          {/* Model info badge */}
          <span
            style={{
              fontSize: "11px",
              fontFamily: "monospace",
              color: "#aaa",
              background: "#111",
              padding: "3px 8px",
              border: "1px solid #333"
            }}
          >
            {config.model}
          </span>
        </div>

        {/* Center: Live Status, Batch Count & Recovery Counters */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", fontFamily: "Oswald, sans-serif", color: "#ddd" }}>
            {statusMessage}
          </span>
          {isRunning && (
            <span
              style={{
                fontSize: "11px",
                fontFamily: "monospace",
                color: "#f4c300",
                background: "#222",
                padding: "2px 6px",
                border: "1px solid #f4c300"
              }}
            >
              {config.batchMode === "count"
                ? `${batchProcessed} / ${config.batchCount} EVALUATED`
                : `${batchProcessed} EVALUATED (ENDLESS)`}
            </span>
          )}
          {recoveredCount > 0 && (
            <span
              style={{
                fontSize: "10px",
                fontFamily: "monospace",
                color: "#34C759",
                background: "rgba(52, 199, 89, 0.15)",
                padding: "2px 6px",
                border: "1px solid #34C759",
                fontWeight: 700
              }}
              title="Temporary errors successfully recovered automatically"
            >
              ✓ {recoveredCount} AUTO-RECOVERED
            </span>
          )}
          {skippedCount > 0 && (
            <span
              style={{
                fontSize: "10px",
                fontFamily: "monospace",
                color: "#FF9500",
                background: "rgba(255, 149, 0, 0.15)",
                padding: "2px 6px",
                border: "1px solid #FF9500",
                fontWeight: 700
              }}
              title="Memes skipped after exhausted retries"
            >
              ⚠️ {skippedCount} SKIPPED
            </span>
          )}
        </div>

        {/* Right: Primary Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {!isConfigured ? (
            <button
              type="button"
              onClick={() => setIsConfigOpen(true)}
              style={{
                padding: "6px 14px",
                background: "#f4c300",
                color: "#121212",
                border: "2px solid black",
                boxShadow: "2px 2px 0px black",
                fontFamily: "var(--font-display, 'Anton', sans-serif)",
                fontSize: "14px",
                cursor: "pointer"
              }}
            >
              ⚙️ CONFIGURE AI TO START
            </button>
          ) : isRunning ? (
            <button
              type="button"
              onClick={() => onStop()}
              style={{
                padding: "6px 18px",
                background: "#FF3B30",
                color: "#ffffff",
                border: "2px solid black",
                boxShadow: "2px 2px 0px black",
                fontFamily: "var(--font-display, 'Anton', sans-serif)",
                fontSize: "15px",
                letterSpacing: "0.5px",
                cursor: "pointer"
              }}
            >
              ⏹ STOP AI MODE [ESC]
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStart()}
              style={{
                padding: "6px 18px",
                background: "#34C759",
                color: "#121212",
                border: "2px solid black",
                boxShadow: "2px 2px 0px black",
                fontFamily: "var(--font-display, 'Anton', sans-serif)",
                fontSize: "15px",
                letterSpacing: "0.5px",
                cursor: "pointer"
              }}
            >
              ▶ START CONTINUOUS AI JUDGE
            </button>
          )}

          {/* Expand/Collapse Settings Toggle */}
          <button
            type="button"
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            style={{
              padding: "6px 12px",
              background: isConfigOpen ? "#9b30ff" : "#262626",
              color: isConfigOpen ? "#ffffff" : "#f4c300",
              border: "1px solid #444",
              fontFamily: "Oswald, sans-serif",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <span>⚙️ {isConfigOpen ? "HIDE CONFIG" : "MODEL CONFIG"}</span>
          </button>
        </div>
      </div>

      {/* 2. Live Visual Countdown Bar (Active during previewing) */}
      {isRunning && loopState === "previewing" && (
        <div
          style={{
            height: "4px",
            backgroundColor: "#111",
            width: "100%",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${previewProgress}%`,
              backgroundColor: "#f4c300",
              transition: "width 0.05s linear"
            }}
          />
        </div>
      )}

      {/* 3. Collapsible Configuration & Model Console */}
      {isConfigOpen && (
        <div
          style={{
            padding: "18px",
            backgroundColor: "#191919",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }}
        >
          {/* Action notice */}
          {presetActionMessage && (
            <div
              style={{
                padding: "6px 12px",
                background: "rgba(52, 199, 89, 0.2)",
                border: "1px solid #34C759",
                color: "#34C759",
                fontSize: "12px",
                fontFamily: "Oswald"
              }}
            >
              ✓ {presetActionMessage}
            </div>
          )}

          {/* Section A: Judge's Saved Presets Toolbar */}
          <div style={{ background: "#141414", padding: "12px", border: "1px solid #333" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px"
              }}
            >
              <div
                style={{
                  fontFamily: "Oswald, sans-serif",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#f4c300",
                  letterSpacing: "0.5px"
                }}
              >
                YOUR SAVED PROVIDER PRESETS (PRIVATE TO YOU):
              </div>
              <button
                type="button"
                onClick={() => {
                  if (hasApiPassword) {
                    handleOpenUnlockChallenge("create");
                  } else {
                    setShowSavePresetModal(true);
                  }
                }}
                style={{
                  padding: "4px 10px",
                  background: "#9b30ff",
                  color: "#fff",
                  border: "1px solid #f4c300",
                  fontFamily: "Oswald",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                + SAVE CURRENT CONFIG AS PRESET
              </button>
            </div>

            {savedPresets.length === 0 ? (
              <div style={{ fontSize: "11px", color: "#777", fontStyle: "italic" }}>
                No custom presets saved yet. Configure your model and click "+ Save Current Config as Preset" to save it for quick one-click switching.
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {savedPresets.map((p) => {
                  const isActive = config.activePresetId === p.id || (activePreset?.id === p.id);
                  const modelCount = Array.isArray(p.models) && p.models.length > 0 ? p.models.length : (p.model ? 1 : 0);
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        background: isActive ? "#9b30ff" : "#222",
                        border: isActive ? "2px solid #f4c300" : "1px solid #444",
                        boxShadow: isActive ? "2px 2px 0px #f4c300" : "none",
                        padding: "4px 8px",
                        gap: "6px"
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(p)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: isActive ? "#ffffff" : "#cccccc",
                          fontFamily: "Oswald",
                          fontSize: "12px",
                          fontWeight: isActive ? 700 : 400,
                          cursor: "pointer",
                          padding: 0
                        }}
                      >
                        {p.preset_name} <span style={{ opacity: 0.85, fontSize: "11px" }}>({modelCount} model{modelCount === 1 ? "" : "s"})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (hasApiPassword) {
                            handleOpenUnlockChallenge("edit", p);
                          } else {
                            executeOpenEditPreset(p);
                          }
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: isActive ? "#f4c300" : "#aaa",
                          fontSize: "11px",
                          cursor: "pointer",
                          padding: "0 2px"
                        }}
                        title="Edit Preset & Manage Models"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (hasApiPassword) {
                            handleOpenUnlockChallenge("delete", p);
                          } else {
                            executeDeletePreset(p.id, p.preset_name);
                          }
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ff5555",
                          fontSize: "11px",
                          cursor: "pointer",
                          padding: "0 2px"
                        }}
                        title="Delete Entire Provider Preset"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal to Edit & Reconfigure Preset */}
          {showEditPresetModal && editingPreset && (
            <div
              style={{
                background: "#1e1e1e",
                border: "2px solid #f4c300",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                boxShadow: "4px 4px 0px black"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#f4c300", fontFamily: "Oswald" }}>
                  ✏️ RECONFIGURE PROVIDER PRESET: {editingPreset.preset_name.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditPresetModal(false);
                    setEditingPreset(null);
                  }}
                  style={{ background: "transparent", border: "none", color: "#aaa", fontSize: "14px", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditedPreset} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#aaa", fontFamily: "Oswald", marginBottom: "4px" }}>
                    PRESET / PROVIDER NAME:
                  </label>
                  <input
                    type="text"
                    value={editPresetName}
                    onChange={(e) => setEditPresetName(e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", background: "#111", border: "1px solid #555", color: "#fff", fontFamily: "Oswald", fontSize: "12px" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#aaa", fontFamily: "Oswald", marginBottom: "4px" }}>
                      API BASE URL:
                    </label>
                    <input
                      type="text"
                      value={editBaseUrl}
                      onChange={(e) => setEditBaseUrl(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", background: "#111", border: "1px solid #555", color: "#fff", fontFamily: "monospace", fontSize: "11px" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#aaa", fontFamily: "Oswald", marginBottom: "4px" }}>
                      API KEY:
                    </label>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <input
                        type={editShowApiKey ? "text" : "password"}
                        value={editApiKey}
                        onChange={(e) => setEditApiKey(e.target.value)}
                        placeholder="Leave blank to preserve encrypted key..."
                        style={{ flex: 1, padding: "6px 10px", background: "#111", border: "1px solid #555", color: "#fff", fontFamily: "monospace", fontSize: "11px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setEditShowApiKey(!editShowApiKey)}
                        style={{ padding: "4px 8px", background: "#222", border: "1px solid #444", color: "#aaa", fontSize: "10px", cursor: "pointer" }}
                      >
                        {editShowApiKey ? "HIDE" : "SHOW"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Saved Models List with Individual Remove Buttons */}
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#f4c300", fontFamily: "Oswald", marginBottom: "6px" }}>
                    SAVED MODELS IN THIS PRESET (CLICK ✕ TO REMOVE OUTDATED OR INVALID MODELS):
                  </label>
                  {editModelsList.length === 0 ? (
                    <div style={{ fontSize: "11px", color: "#777", fontStyle: "italic" }}>No models saved yet.</div>
                  ) : (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {editModelsList.map((m) => (
                        <div
                          key={m}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            background: "#262626",
                            border: "1px solid #555",
                            padding: "4px 8px"
                          }}
                        >
                          <span style={{ color: "#fff", fontFamily: "monospace", fontSize: "11px" }}>{m}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveModelFromPreset(editingPreset.id, m)}
                            style={{ background: "transparent", border: "none", color: "#ff5555", fontSize: "12px", cursor: "pointer", padding: "0 2px" }}
                            title="Remove this model"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "6px" }}>
                  <button
                    type="submit"
                    style={{ padding: "6px 14px", background: "#f4c300", color: "#111", border: "none", fontFamily: "Anton", fontSize: "13px", cursor: "pointer" }}
                  >
                    SAVE CHANGES
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditPresetModal(false);
                      setEditingPreset(null);
                    }}
                    style={{ padding: "6px 12px", background: "#333", color: "#aaa", border: "none", fontFamily: "Oswald", fontSize: "12px", cursor: "pointer" }}
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal to Name and Save Preset */}
          {showSavePresetModal && (
            <div
              style={{
                background: "#222",
                border: "2px solid #f4c300",
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#f4c300", fontFamily: "Oswald" }}>
                ENTER NAME FOR THIS MODEL PRESET:
              </span>
              <form onSubmit={handleSaveCurrentAsPreset} style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="e.g. Google AI Studio, NVIDIA NIM, Groq Cloud"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    background: "#111",
                    border: "1px solid #555",
                    color: "#fff",
                    fontFamily: "Oswald",
                    fontSize: "12px",
                    outline: "none"
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "6px 14px",
                    background: "#f4c300",
                    color: "#111",
                    border: "none",
                    fontFamily: "Anton",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  SAVE
                </button>
                <button
                  type="button"
                  onClick={() => setShowSavePresetModal(false)}
                  style={{
                    padding: "6px 10px",
                    background: "#333",
                    color: "#aaa",
                    border: "none",
                    fontFamily: "Oswald",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  CANCEL
                </button>
              </form>
            </div>
          )}

          {/* Section B: Choose Vision Provider Template */}
          <div>
            <div
              style={{
                fontFamily: "Oswald, sans-serif",
                fontSize: "11px",
                fontWeight: 700,
                color: "#f4c300",
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "8px"
              }}
            >
              QUICK PROVIDER TEMPLATES:
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {AI_PROVIDER_PRESETS.map((p) => {
                const isSelected = config.provider === p.id && !config.activePresetId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProvider(p.id)}
                    style={{
                      padding: "6px 12px",
                      background: isSelected ? "#9b30ff" : "#242424",
                      color: isSelected ? "#ffffff" : "#dddddd",
                      border: isSelected ? "2px solid #f4c300" : "1px solid #444",
                      fontFamily: "Oswald, sans-serif",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: isSelected ? "2px 2px 0px black" : "none"
                    }}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: "11px", color: "#888", marginTop: "6px", fontFamily: "Oswald" }}>
              {activeTemplate.description}{" "}
              <a
                href={activeTemplate.keyHelpUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#f4c300", textDecoration: "underline" }}
              >
                Get API Key ↗
              </a>
            </div>
          </div>

          {/* Section C: Connection Details: Base URL, API Key & Model Name */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "12px"
            }}
          >
            {/* Base URL */}
            <div>
              <label
                style={{
                  display: "block",
                  fontFamily: "Oswald, sans-serif",
                  fontSize: "11px",
                  color: "#aaa",
                  marginBottom: "4px"
                }}
              >
                API BASE URL:
              </label>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) => updateConfigField("baseUrl", e.target.value)}
                placeholder="https://..."
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "#121212",
                  border: "1px solid #444",
                  color: "#fff",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  outline: "none"
                }}
              />
            </div>

            {/* API Key */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label
                  style={{
                    fontFamily: "Oswald, sans-serif",
                    fontSize: "11px",
                    color: "#aaa"
                  }}
                >
                  API KEY:
                </label>
                {hasApiPassword && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: isKeyUnlocked ? "#34C759" : "#f4c300",
                      fontFamily: "Oswald",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    {isKeyUnlocked ? "🔓 UNLOCKED" : "🔒 ENCRYPTED (PROTECTED)"}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type={showApiKey && isKeyUnlocked ? "text" : "password"}
                  value={displayKeyValue}
                  onChange={(e) => {
                    if (isKeyEditable) {
                      updateConfigField("apiKey", e.target.value);
                      if (activePreset?.id && unlockedKeys[activePreset.id]) {
                        setUnlockedKeys((prev) => ({ ...prev, [activePreset.id]: e.target.value }));
                      }
                    }
                  }}
                  readOnly={!isKeyEditable}
                  placeholder={hasApiPassword && !isKeyUnlocked ? "••••••••••••••••••••••••••••••••" : "Paste your API key..."}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    background: "#121212",
                    border: isKeyUnlocked && hasApiPassword ? "1px solid #34C759" : "1px solid #444",
                    color: "#fff",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    outline: "none",
                    cursor: isKeyEditable ? "text" : "not-allowed"
                  }}
                />
                <button
                  type="button"
                  onClick={handleToggleShowApiKey}
                  style={{
                    padding: "6px 10px",
                    background: isKeyUnlocked && hasApiPassword ? "rgba(255, 59, 48, 0.2)" : "#222",
                    border: isKeyUnlocked && hasApiPassword ? "1px solid #ff4444" : "1px solid #444",
                    color: isKeyUnlocked && hasApiPassword ? "#ff8888" : "#aaa",
                    fontSize: "11px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                  title={hasApiPassword && !isKeyUnlocked ? "Enter API Encryption Password to reveal key" : "Toggle key visibility"}
                >
                  {hasApiPassword
                    ? (isKeyUnlocked ? (showApiKey ? "HIDE & LOCK 🔒" : "SHOW") : "SHOW 🔒")
                    : (showApiKey ? "HIDE" : "SHOW")}
                </button>
              </div>
            </div>

            {/* Model Chooser & Identifier */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label
                  style={{
                    fontFamily: "Oswald, sans-serif",
                    fontSize: "11px",
                    color: "#aaa"
                  }}
                >
                  ACTIVE VISION MODEL:
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddModelInline(!showAddModelInline)}
                  style={{
                    background: showAddModelInline ? "#f4c300" : "#222",
                    color: showAddModelInline ? "#111" : "#f4c300",
                    border: "1px solid #f4c300",
                    fontFamily: "Oswald",
                    fontSize: "10px",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: "1px 6px"
                  }}
                >
                  {showAddModelInline ? "✕ CLOSE" : "➕ ADD NEW MODEL"}
                </button>
              </div>

              {/* Model Chooser Dropdown */}
              <select
                value={config.model}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__add_new__") {
                    setShowAddModelInline(true);
                  } else {
                    updateConfigField("model", val);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  background: "#121212",
                  border: "1px solid #555",
                  color: "#f4c300",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  fontWeight: 600,
                  outline: "none",
                  cursor: "pointer",
                  marginBottom: "6px"
                }}
              >
                {/* Saved Models in Preset */}
                {activePreset && Array.isArray(activePreset.models) && activePreset.models.length > 0 && (
                  <optgroup label={`★ SAVED IN ${activePreset.preset_name.toUpperCase()}`}>
                    {activePreset.models.map((m) => (
                      <option key={`saved-${m}`} value={m}>
                        ★ {m}
                      </option>
                    ))}
                  </optgroup>
                )}

                {/* Popular Recommended Models */}
                <optgroup label={`RECOMMENDED VISION MODELS (${activeTemplate.name.toUpperCase()})`}>
                  {activeTemplate.recommendedModels
                    .filter((m) => !(activePreset?.models || []).includes(m))
                    .map((m) => (
                      <option key={`rec-${m}`} value={m}>
                        {m}
                      </option>
                    ))}
                </optgroup>

                {/* Current Custom Model (if not already listed) */}
                {config.model &&
                  !(activePreset?.models || []).includes(config.model) &&
                  !activeTemplate.recommendedModels.includes(config.model) && (
                    <optgroup label="CURRENT CUSTOM MODEL">
                      <option value={config.model}>{config.model}</option>
                    </optgroup>
                  )}

                <optgroup label="ACTIONS">
                  <option value="__add_new__">➕ Add New Model to this Provider...</option>
                </optgroup>
              </select>

              {/* Inline Add Model Input Form */}
              {showAddModelInline && (
                <form
                  onSubmit={handleAddAndSaveNewModel}
                  style={{
                    display: "flex",
                    gap: "6px",
                    marginBottom: "8px",
                    background: "#1c1b1b",
                    padding: "8px",
                    border: "1px solid #f4c300"
                  }}
                >
                  <input
                    type="text"
                    placeholder="Enter model (e.g. gemini-2.0-flash or llama-3.2-11b-vision-preview)..."
                    value={inlineNewModelName}
                    onChange={(e) => setInlineNewModelName(e.target.value)}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: "5px 8px",
                      background: "#111",
                      border: "1px solid #555",
                      color: "#fff",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      outline: "none"
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isSavingModel || !inlineNewModelName.trim()}
                    style={{
                      padding: "5px 10px",
                      background: "#f4c300",
                      color: "#111",
                      border: "none",
                      fontFamily: "Anton",
                      fontSize: "11px",
                      cursor: "pointer"
                    }}
                  >
                    {isSavingModel ? "SAVING..." : "ADD & AUTO-SAVE"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModelInline(false);
                      setInlineNewModelName("");
                    }}
                    style={{
                      padding: "5px 8px",
                      background: "#333",
                      color: "#aaa",
                      border: "none",
                      fontFamily: "Oswald",
                      fontSize: "11px",
                      cursor: "pointer"
                    }}
                  >
                    CANCEL
                  </button>
                </form>
              )}

              {/* Exact Model String Input */}
              <input
                type="text"
                value={config.model}
                onChange={(e) => updateConfigField("model", e.target.value)}
                placeholder="e.g. gemini-2.0-flash or meta/llama-3.2-11b-vision-instruct"
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  background: "#111",
                  border: "1px solid #333",
                  color: "#aaa",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  outline: "none"
                }}
              />
            </div>
          </div>

          {/* Recommended Model Quick-Chips */}
          {activeTemplate.recommendedModels.length > 0 && (
            <div>
              <span style={{ fontSize: "11px", color: "#888", fontFamily: "Oswald", marginRight: "8px" }}>
                POPULAR VISION MODELS:
              </span>
              <div style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                {activeTemplate.recommendedModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectModelChip(m)}
                    style={{
                      padding: "2px 8px",
                      background: config.model === m ? "#f4c300" : "#222",
                      color: config.model === m ? "#111" : "#aaa",
                      border: "1px solid #444",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      cursor: "pointer"
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section D: Execution Settings */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
              paddingTop: "12px",
              borderTop: "1px solid #282828"
            }}
          >
            {/* Batch Mode */}
            <div>
              <label style={{ display: "block", fontFamily: "Oswald", fontSize: "11px", color: "#aaa", marginBottom: "4px" }}>
                BATCH EXECUTION LIMIT:
              </label>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => updateConfigField("batchMode", "endless")}
                  style={{
                    padding: "4px 8px",
                    background: config.batchMode === "endless" ? "#f4c300" : "#222",
                    color: config.batchMode === "endless" ? "#111" : "#aaa",
                    border: "1px solid #444",
                    fontFamily: "Oswald",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  ENDLESS (RUN CONTINUOUSLY)
                </button>
                <button
                  type="button"
                  onClick={() => updateConfigField("batchMode", "count")}
                  style={{
                    padding: "4px 8px",
                    background: config.batchMode === "count" ? "#f4c300" : "#222",
                    color: config.batchMode === "count" ? "#111" : "#aaa",
                    border: "1px solid #444",
                    fontFamily: "Oswald",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  BATCH LIMIT
                </button>
              </div>
              {config.batchMode === "count" && (
                <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  {[10, 25, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => updateConfigField("batchCount", n)}
                      style={{
                        padding: "2px 6px",
                        fontSize: "10px",
                        background: config.batchCount === n ? "#9b30ff" : "#111",
                        color: "#fff",
                        border: "1px solid #444",
                        cursor: "pointer"
                      }}
                    >
                      {n} memes
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Preview Delay Speed Control */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontFamily: "Oswald", fontSize: "11px", color: "#aaa" }}>
                  PREVIEW PAUSE: {config.previewDelayMs}ms {config.previewDelayMs === 0 ? "(INSTANT)" : ""}
                </label>
                <div style={{ display: "flex", gap: "4px" }}>
                  {[
                    { label: "⚡ 0ms Instant", val: 0 },
                    { label: "500ms", val: 500 },
                    { label: "1000ms", val: 1000 },
                    { label: "1500ms", val: 1500 }
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => updateConfigField("previewDelayMs", s.val)}
                      style={{
                        padding: "1px 6px",
                        fontSize: "10px",
                        background: config.previewDelayMs === s.val ? "#34C759" : "#222",
                        color: config.previewDelayMs === s.val ? "#111" : "#aaa",
                        border: "1px solid #444",
                        cursor: "pointer",
                        fontWeight: config.previewDelayMs === s.val ? 700 : 400
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="3000"
                step="250"
                value={config.previewDelayMs}
                onChange={(e) => updateConfigField("previewDelayMs", Number(e.target.value))}
                style={{ width: "100%", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#666" }}>
                <span>0ms (Maximum Speed)</span>
                <span>1000ms (Balanced)</span>
                <span>3000ms (Relaxed)</span>
              </div>
            </div>

            {/* Low Confidence Fallback */}
            <div>
              <label style={{ display: "block", fontFamily: "Oswald", fontSize: "11px", color: "#aaa", marginBottom: "4px" }}>
                LOW CONFIDENCE / AMBIGUOUS:
              </label>
              <select
                value={config.lowConfidenceFallback}
                onChange={(e) => updateConfigField("lowConfidenceFallback", e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  background: "#121212",
                  border: "1px solid #444",
                  color: "#f4c300",
                  fontFamily: "Oswald",
                  fontSize: "12px",
                  outline: "none"
                }}
              >
                <option value="excluded">✕ Exclude Meme from Corpus [Recommended]</option>
              </select>
            </div>
          </div>

          {/* Section E: Pre-Build Batch System Instructions */}
          <div
            style={{
              paddingTop: "12px",
              borderTop: "1px solid #282828",
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }}
          >
            <div
              style={{
                fontFamily: "Oswald, sans-serif",
                fontSize: "11px",
                fontWeight: 700,
                color: "#f4c300",
                letterSpacing: "1px",
                textTransform: "uppercase"
              }}
            >
              PRE-BUILD BATCH INSTRUCTIONS (SYSTEM PROMPT OVERRIDE):
            </div>
            <textarea
              rows={3}
              value={config.customInstructions || ""}
              onChange={(e) => updateConfigField("customInstructions", e.target.value)}
              placeholder="e.g. Focus on tech & gaming memes. Exclude promotional material and plain non-meme photos. Only keep memes with high humor value."
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "#121212",
                border: "1px solid #444",
                color: "#34C759",
                fontFamily: "monospace",
                fontSize: "12px",
                outline: "none",
                resize: "vertical"
              }}
            />
            <div style={{ fontSize: "11px", color: "#888", fontFamily: "Oswald" }}>
              QUICK INSTRUCTION PRESETS:
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() =>
                  updateConfigField(
                    "customInstructions",
                    "STRICT WATERMARK EXCLUSION: Automatically exclude any meme containing aggregator, repost, or creator watermarks/handles (@page_name, 9GAG, iFunny, TikTok). DISTINCTIVE CURATION: Curate for cultural depth, absurdity, satire, and fresh comedic punch. Reject generic repost filler."
                  )
                }
                style={{
                  padding: "2px 8px",
                  fontSize: "11px",
                  background: "#222",
                  color: "#FF3B30",
                  border: "1px solid #FF3B30",
                  cursor: "pointer",
                  fontWeight: 700
                }}
              >
                🚫 Exclude Watermarks & Distinctive
              </button>
              <button
                type="button"
                onClick={() => updateConfigField("customInstructions", "Be strict. Mark ambiguous or low-quality images as excluded. Only keep high-effort, genuine memes.")}
                style={{
                  padding: "2px 8px",
                  fontSize: "11px",
                  background: "#222",
                  color: "#f4c300",
                  border: "1px solid #444",
                  cursor: "pointer"
                }}
              >
                🎯 Strict Quality Filter
              </button>
              <button
                type="button"
                onClick={() => updateConfigField("customInstructions", "Prioritize software, tech, gaming, and internet culture memes. Exclude corporate flyers.")}
                style={{
                  padding: "2px 8px",
                  fontSize: "11px",
                  background: "#222",
                  color: "#9b30ff",
                  border: "1px solid #444",
                  cursor: "pointer"
                }}
              >
                🎮 Tech & Gaming Focus
              </button>
              <button
                type="button"
                onClick={() => updateConfigField("customInstructions", "Categorize all valid memes with relevant topics and dominant tone accurately.")}
                style={{
                  padding: "2px 8px",
                  fontSize: "11px",
                  background: "#222",
                  color: "#34C759",
                  border: "1px solid #444",
                  cursor: "pointer"
                }}
              >
                ⚡ Fast Auto-Tagging
              </button>
              <button
                type="button"
                onClick={() => updateConfigField("customInstructions", "Exclude dark or sensitive humor. Prioritize wholesome, feel-good memes.")}
                style={{
                  padding: "2px 8px",
                  fontSize: "11px",
                  background: "#222",
                  color: "#FF9500",
                  border: "1px solid #444",
                  cursor: "pointer"
                }}
              >
                🛡️ Wholesome Priority
              </button>
              <button
                type="button"
                onClick={() => updateConfigField("customInstructions", "")}
                style={{
                  padding: "2px 8px",
                  fontSize: "11px",
                  background: "#111",
                  color: "#aaa",
                  border: "1px solid #333",
                  cursor: "pointer"
                }}
              >
                🧹 Clear Instructions
              </button>
            </div>
          </div>

          {/* Test Connection & Feedback */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "8px",
              borderTop: "1px solid #282828",
              flexWrap: "wrap",
              gap: "8px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !config.baseUrl}
                style={{
                  padding: "6px 14px",
                  background: "#2a2a2a",
                  color: "#f4c300",
                  border: "1px solid #9b30ff",
                  fontFamily: "Oswald, sans-serif",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: isTesting ? "wait" : "pointer"
                }}
              >
                {isTesting ? "TESTING..." : "⚡ TEST CONNECTION"}
              </button>

              {testResult && (
                <span
                  style={{
                    fontSize: "12px",
                    fontFamily: "Oswald",
                    color: testResult.success ? "#34C759" : "#FF3B30"
                  }}
                >
                  {testResult.success ? "✓" : "✕"} {testResult.message}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsConfigOpen(false)}
              style={{
                padding: "6px 16px",
                background: "#f4c300",
                color: "#121212",
                border: "none",
                fontFamily: "var(--font-display, 'Anton', sans-serif)",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              DONE / SAVE
            </button>
          </div>
        </div>
      )}

      {/* 4. Live AI Reasoning Tooltip / Pill Strip */}
      {lastDecision && (
        <div
          style={{
            padding: "8px 18px",
            background: "#111",
            borderTop: "1px solid #242424",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "12px",
            fontFamily: "Oswald, sans-serif",
            flexWrap: "wrap"
          }}
        >
          <span style={{ color: "#f4c300", fontWeight: 700 }}>AI RATIONALE:</span>
          {lastDecision.corpus_status === "excluded" &&
            lastDecision.curator_note?.toLowerCase().includes("watermark") && (
              <span
                style={{
                  background: "#FF3B30",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: "2px",
                  fontFamily: "Oswald",
                  letterSpacing: "0.5px"
                }}
              >
                🚫 WATERMARK EXCLUDED
              </span>
            )}
          <span style={{ color: "#cdc3d0", fontStyle: "italic" }}>
            "{lastDecision.curator_note}"
          </span>
          <span style={{ marginLeft: "auto", color: "#888", fontSize: "11px", fontFamily: "monospace" }}>
            Confidence: {Math.round(lastDecision.confidence * 100)}%
            {lastDecision.latencyMs ? ` · ${lastDecision.latencyMs}ms` : ""}
          </span>
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: "8px 18px",
            background: "rgba(255, 59, 48, 0.15)",
            borderTop: "1px solid #FF3B30",
            color: "#FF3B30",
            fontSize: "12px",
            fontFamily: "Oswald, sans-serif"
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Modal: API Encryption Password Challenge */}
      {showUnlockPasswordModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
            padding: "20px"
          }}
          onClick={() => {
            if (!isVerifyingPassword) {
              setShowUnlockPasswordModal(false);
              setUnlockTarget(null);
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "440px",
              backgroundColor: "#1c1b1b",
              border: "2px solid #34C759",
              boxShadow: "6px 6px 0px #f4c300",
              padding: "24px",
              boxSizing: "border-box"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>🔒</span>
                <span className="curate-anton" style={{ fontSize: "16px", color: "#f4c300" }}>
                  API ENCRYPTION PASSWORD REQUIRED
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isVerifyingPassword) {
                    setShowUnlockPasswordModal(false);
                    setUnlockTarget(null);
                  }
                }}
                style={{ background: "transparent", border: "none", color: "#888", fontSize: "16px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "#ccc", margin: "0 0 14px 0", lineHeight: "1.4", fontFamily: "Oswald" }}>
              {unlockTarget?.type === "reveal" && "Enter your private API encryption password to reveal this provider's secret key."}
              {unlockTarget?.type === "create" && "Enter your API encryption password to authorize saving a new provider preset."}
              {unlockTarget?.type === "edit" && `Enter your API encryption password to edit or reconfigure preset "${unlockTarget.preset?.preset_name}".`}
              {unlockTarget?.type === "delete" && `Enter your API encryption password to authorize deleting preset "${unlockTarget.preset?.preset_name}".`}
            </p>

            <form onSubmit={handleVerifyUnlockPassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontFamily: "Oswald", fontSize: "11px", color: "#aaa", marginBottom: "4px" }}>
                  ENTER API ENCRYPTION PASSWORD:
                </label>
                <input
                  type="password"
                  value={unlockPasswordInput}
                  onChange={(e) => setUnlockPasswordInput(e.target.value)}
                  placeholder="Your API encryption password..."
                  autoFocus
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#121212",
                    border: "1px solid #555",
                    color: "#fff",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    outline: "none"
                  }}
                />
              </div>

              {unlockErrorMsg && (
                <div style={{ background: "rgba(255, 59, 48, 0.15)", border: "1px solid #FF3B30", color: "#FF3B30", padding: "8px 10px", fontSize: "11px", fontFamily: "Oswald" }}>
                  ✕ {unlockErrorMsg}
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  type="submit"
                  disabled={isVerifyingPassword}
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: "#34C759",
                    color: "#000",
                    border: "2px solid black",
                    boxShadow: "2px 2px 0px black",
                    fontFamily: "Anton",
                    fontSize: "14px",
                    cursor: isVerifyingPassword ? "wait" : "pointer"
                  }}
                >
                  {isVerifyingPassword ? "VERIFYING..." : "VERIFY & UNLOCK"}
                </button>
                <button
                  type="button"
                  disabled={isVerifyingPassword}
                  onClick={() => {
                    setShowUnlockPasswordModal(false);
                    setUnlockTarget(null);
                  }}
                  style={{
                    padding: "8px 14px",
                    background: "#333",
                    color: "#ddd",
                    border: "1px solid #555",
                    fontFamily: "Oswald",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
