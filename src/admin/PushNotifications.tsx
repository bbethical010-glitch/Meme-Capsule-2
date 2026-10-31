import { FormEvent, useEffect, useMemo, useState } from "react";

type Screen = "home" | "drop" | "favorites" | "boards" | "settings" | "store";
type Target = "all" | "topic" | "single";

interface NotificationStats {
  active_devices: number;
  total_devices: number;
  breakdown: Array<{ app_version: string | null; platform: string; count: number }>;
}

interface DispatchResponse {
  total_attempted: number;
  total_sent: number;
  stale_pruned: number;
}

const authHeaders = (token: string) => ({
  "X-Admin-Token": token,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

export default function PushNotifications({ adminToken }: { adminToken: string }) {
  const [title, setTitle] = useState("Fresh Meme Drop! 📦");
  const [body, setBody] = useState("Tap to decrypt today's top curated meme.");
  const [screen, setScreen] = useState<Screen>("drop");
  const [target, setTarget] = useState<Target>("all");
  const [token, setToken] = useState("");
  const [topic, setTopic] = useState("daily_drops");
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [result, setResult] = useState<DispatchResponse | null>(null);
  const [notice, setNotice] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const loadStats = async () => {
    try {
      const response = await fetch("/api/admin/notifications/stats", {
        headers: authHeaders(adminToken),
        cache: "no-store",
      });
      const payload = (await response.json()) as NotificationStats & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to load device stats");
      setStats(payload);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to load device stats");
    }
  };

  useEffect(() => {
    if (adminToken) void loadStats();
  }, [adminToken]);

  const versionSummary = useMemo(() => {
    if (!stats?.breakdown.length) return "No registered devices";
    return stats.breakdown
      .map((item) => `${item.app_version || "unknown"} / ${item.platform}: ${item.count}`)
      .join(" · ");
  }, [stats]);

  const dispatch = async () => {
    setIsSending(true);
    setNotice("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: authHeaders(adminToken),
        body: JSON.stringify({ title, body, screen, target, token: token || undefined, topic: topic || undefined }),
      });
      const payload = (await response.json()) as DispatchResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Push dispatch failed");
      setResult(payload);
      setNotice("Dispatch complete.");
      await loadStats();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Push dispatch failed");
    } finally {
      setIsSending(false);
      setIsConfirming(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      setNotice("Title and body are required.");
      return;
    }
    setIsConfirming(true);
  };

  return (
    <section className="push-console">
      <div className="push-heading">
        <div>
          <p className="push-kicker">FCM / HTTP V1</p>
          <h2>Push Control Room</h2>
          <p>Compose, preview, and dispatch app notifications from the edge.</p>
        </div>
        <button type="button" className="push-button push-button-dark" onClick={() => void loadStats()}>
          REFRESH DEVICES
        </button>
      </div>

      <div className="push-stat-grid">
        <div className="push-stat"><span>ACTIVE DEVICES</span><strong>{stats?.active_devices ?? "—"}</strong></div>
        <div className="push-stat"><span>REGISTERED TOTAL</span><strong>{stats?.total_devices ?? "—"}</strong></div>
        <div className="push-stat push-stat-wide"><span>APP / PLATFORM BREAKDOWN</span><strong>{versionSummary}</strong></div>
        <div className="push-stat"><span>LAST PRUNED</span><strong>{result?.stale_pruned ?? 0}</strong></div>
      </div>

      <div className="push-grid">
        <form className="push-form" onSubmit={submit}>
          <label>NOTIFICATION TITLE<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></label>
          <label>NOTIFICATION BODY<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={300} rows={4} /></label>
          <label>DEEP-LINK TARGET
            <select value={screen} onChange={(event) => setScreen(event.target.value as Screen)}>
              <option value="drop">Home / Dispense Meme (drop)</option>
              <option value="home">Home (home)</option>
              <option value="favorites">Meme Vault (favorites)</option>
              <option value="boards">Mood Boards (boards)</option>
              <option value="store">Pro / Store (store)</option>
              <option value="settings">Settings (settings)</option>
            </select>
          </label>
          <label>TARGET AUDIENCE
            <select value={target} onChange={(event) => setTarget(event.target.value as Target)}>
              <option value="all">All Active Devices</option>
              <option value="topic">Topic</option>
              <option value="single">Single Test Device Token</option>
            </select>
          </label>
          {target === "topic" && <label>TOPIC NAME<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="daily_drops" /></label>}
          {target === "single" && <label>FCM DEVICE TOKEN<textarea value={token} onChange={(event) => setToken(event.target.value)} rows={3} /></label>}
          <button type="submit" className="push-button push-button-yellow" disabled={isSending}>DISPATCH PUSH BROADCAST</button>
        </form>

        <div className="push-preview-column">
          <p className="push-kicker">LIVE PHONE PREVIEW</p>
          <div className="phone-preview">
            <div className="phone-status">Meme Capsule <span>NOW</span></div>
            <div className="phone-notification">
              <div className="phone-icon">MC</div>
              <div><strong>{title || "Notification title"}</strong><p>{body || "Notification body"}</p></div>
            </div>
          </div>
          <div className="push-log">
            <p className="push-kicker">DISPATCH LOG</p>
            <p>{notice || "Awaiting dispatch command..."}</p>
            {result && <p>Sent: {result.total_sent} / {result.total_attempted} | Pruned: {result.stale_pruned}</p>}
          </div>
        </div>
      </div>

      {isConfirming && (
        <div className="push-modal-backdrop" role="dialog" aria-modal="true">
          <div className="push-modal">
            <p className="push-kicker">CONFIRM DISPATCH</p>
            <h3>Send this notification?</h3>
            <p>{target === "all" ? `This will attempt delivery to ${stats?.active_devices ?? "all active"} active devices.` : "This dispatch targets the selected audience."}</p>
            <div className="push-modal-actions">
              <button type="button" className="push-button push-button-dark" onClick={() => setIsConfirming(false)}>CANCEL</button>
              <button type="button" className="push-button push-button-yellow" onClick={() => void dispatch()} disabled={isSending}>CONFIRM SEND</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
