import { FormEvent, useEffect, useState } from "react";

type Message = { id: string; title: string; body: string };
type ContentFile = { id: string; file_name: string; entry_count: number; created_at: string };
type Schedule = {
  id: string; message_id: string; content_file_id: string | null; content_file_name?: string;
  time_local: string; timezone: string; days_of_week: string; is_enabled: number; title: string;
};
type DeliveryRun = {
  id: string; occurrence_key: string; status: string; total_attempted: number;
  total_sent: number; stale_pruned: number; error: string | null;
};

const headers = (token: string) => ({
  "X-Admin-Token": token,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

export default function ScheduledNotifications({ adminToken }: { adminToken: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<ContentFile[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [messageId, setMessageId] = useState("");
  const [fileId, setFileId] = useState("");
  const [timeLocal, setTimeLocal] = useState("09:00");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [days, setDays] = useState("0,1,2,3,4,5,6");
  const [notice, setNotice] = useState("");

  const load = async () => {
    try {
      const [messageResponse, scheduleResponse, fileResponse] = await Promise.all([
        fetch("/api/admin/notifications/messages", { headers: headers(adminToken), cache: "no-store" }),
        fetch("/api/admin/notifications/schedules", { headers: headers(adminToken), cache: "no-store" }),
        fetch("/api/admin/notifications/content-files", { headers: headers(adminToken), cache: "no-store" }),
      ]);
      const messagePayload = (await messageResponse.json()) as { messages?: Message[]; error?: string };
      const schedulePayload = (await scheduleResponse.json()) as { schedules?: Schedule[]; runs?: DeliveryRun[]; error?: string };
      const filePayload = (await fileResponse.json()) as { files?: ContentFile[]; error?: string };
      if (!messageResponse.ok) throw new Error(messagePayload.error || "Failed to load messages");
      if (!scheduleResponse.ok) throw new Error(schedulePayload.error || "Failed to load schedules");
      if (!fileResponse.ok) throw new Error(filePayload.error || "Failed to load content files");
      setMessages(messagePayload.messages || []);
      setSchedules(schedulePayload.schedules || []);
      setRuns(schedulePayload.runs || []);
      setFiles(filePayload.files || []);
      if (!messageId && messagePayload.messages?.[0]) setMessageId(messagePayload.messages[0].id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to load notification settings");
    }
  };

  useEffect(() => { if (adminToken) void load(); }, [adminToken]);

  const createMessage = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch("/api/admin/notifications/messages", {
        method: "POST", headers: headers(adminToken), body: JSON.stringify({ title, body, screen: "drop" }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Message creation failed");
      setTitle(""); setBody(""); setNotice("Message saved."); await load();
      if (payload.id) setMessageId(payload.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Message creation failed"); }
  };

  const uploadFile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("content-file") as HTMLInputElement;
    if (!input.files?.[0]) { setNotice("Choose a JSON or CSV file first."); return; }
    const formData = new FormData(); formData.append("file", input.files[0]);
    try {
      const response = await fetch("/api/admin/notifications/content-files", {
        method: "POST", headers: { "X-Admin-Token": adminToken, Authorization: `Bearer ${adminToken}` }, body: formData,
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "File upload failed");
      setFileId(payload.id || ""); setNotice("Content file stored permanently in R2."); input.value = ""; await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "File upload failed"); }
  };

  const createSchedule = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch("/api/admin/notifications/schedules", {
        method: "POST", headers: headers(adminToken),
        body: JSON.stringify({ message_id: messageId, content_file_id: fileId || undefined, time_local: timeLocal, timezone, days_of_week: days }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Schedule creation failed");
      setNotice("Schedule enabled."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Schedule creation failed"); }
  };

  const toggleSchedule = async (schedule: Schedule) => {
    try {
      const response = await fetch("/api/admin/notifications/schedules", {
        method: "PATCH", headers: headers(adminToken), body: JSON.stringify({ id: schedule.id, is_enabled: !schedule.is_enabled }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Schedule update failed");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Schedule update failed"); }
  };

  const deleteSchedule = async (schedule: Schedule) => {
    if (!window.confirm(`Delete the ${schedule.time_local} schedule?`)) return;
    try {
      const response = await fetch("/api/admin/notifications/schedules", {
        method: "DELETE", headers: headers(adminToken), body: JSON.stringify({ id: schedule.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Schedule deletion failed");
      setNotice("Schedule deleted."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Schedule deletion failed"); }
  };

  return (
    <section className="scheduled-console">
      <div className="scheduled-heading">
        <div><p className="push-kicker">CLOUDFLARE WORKER / D1 + R2</p><h2>Scheduled Drops</h2><p>Schedule the time; the Worker randomly selects content at send time.</p></div>
        <button type="button" className="push-button push-button-dark push-button-compact" onClick={() => void load()}>REFRESH</button>
      </div>
      {notice && <p className="push-log scheduled-notice">{notice}</p>}
      <div className="scheduled-grid">
        <div className="scheduled-column">
          <form className="push-form compact-form" onSubmit={createMessage}>
            <h3>MESSAGE LIBRARY</h3>
            <label>TITLE<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>
            <label>MESSAGE<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={300} rows={2} required /></label>
            <button type="submit" className="push-button push-button-yellow push-button-compact">SAVE MESSAGE</button>
          </form>
          <form className="push-form compact-form" onSubmit={uploadFile}>
            <h3>RANDOM CONTENT FILE</h3>
            <p className="form-help">JSON: <code>[{"{"}"title":"...","body":"..."{"}"}]</code> or CSV with <code>title,body</code> columns. Maximum 7 unique titles.</p>
            <input name="content-file" type="file" accept=".json,.csv,.txt" required />
            <button type="submit" className="push-button push-button-yellow push-button-compact">UPLOAD & STORE</button>
            <div className="compact-list">{files.map((file) => <div className="compact-item" key={file.id}><strong>{file.file_name}</strong><span>{file.entry_count} messages</span></div>)}</div>
          </form>
        </div>
        <form className="push-form compact-form" onSubmit={createSchedule}>
          <h3>NEW SCHEDULE</h3>
          <label>FALLBACK MESSAGE<select value={messageId} onChange={(event) => setMessageId(event.target.value)} required><option value="" disabled>Select message</option>{messages.map((message) => <option key={message.id} value={message.id}>{message.title}</option>)}</select></label>
          <label>RANDOM FILE (OPTIONAL)<select value={fileId} onChange={(event) => setFileId(event.target.value)}><option value="">Use fallback message</option>{files.map((file) => <option key={file.id} value={file.id}>{file.file_name} ({file.entry_count})</option>)}</select></label>
          <div className="schedule-fields"><label>TIME<input type="time" value={timeLocal} onChange={(event) => setTimeLocal(event.target.value)} required /></label><label>TIMEZONE<input value={timezone} onChange={(event) => setTimezone(event.target.value)} required /></label></div>
          <label>DAYS <input value={days} onChange={(event) => setDays(event.target.value)} placeholder="0,1,2,3,4,5,6" required /></label>
          <button type="submit" className="push-button push-button-yellow push-button-compact" disabled={!messages.length}>ENABLE SCHEDULE</button>
          <div className="compact-list schedule-list">
            {schedules.map((schedule) => <div className="schedule-card" key={schedule.id}><div><strong>{schedule.time_local}</strong><span>{schedule.timezone} · {schedule.content_file_name || schedule.title}</span></div><div className="schedule-actions"><button type="button" className="push-button push-button-dark push-button-compact" onClick={() => void toggleSchedule(schedule)}>{schedule.is_enabled ? "DISABLE" : "ENABLE"}</button><button type="button" className="push-button push-button-danger push-button-compact" onClick={() => void deleteSchedule(schedule)}>DELETE</button></div></div>)}
          </div>
          <h3>RECENT RUNS</h3>
          <div className="compact-list">{runs.slice(0, 8).map((run) => <div className="compact-item" key={run.id}><strong>{run.status.toUpperCase()} · {run.occurrence_key}</strong><span>{run.total_sent}/{run.total_attempted}{run.error ? ` · ${run.error}` : ""}</span></div>)}</div>
        </form>
      </div>
    </section>
  );
}
