import { FormEvent, useEffect, useState } from "react";

type Message = { id: string; title: string; body: string; screen: string; is_active: number };
type Schedule = {
  id: string;
  message_id: string;
  time_local: string;
  timezone: string;
  days_of_week: string;
  is_enabled: number;
  title: string;
};
type DeliveryRun = {
  id: string;
  schedule_id: string;
  occurrence_key: string;
  status: string;
  total_attempted: number;
  total_sent: number;
  stale_pruned: number;
  error: string | null;
  completed_at: string | null;
};

const headers = (token: string) => ({
  "X-Admin-Token": token,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

export default function ScheduledNotifications({ adminToken }: { adminToken: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [messageId, setMessageId] = useState("");
  const [timeLocal, setTimeLocal] = useState("09:00");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [days, setDays] = useState("0,1,2,3,4,5,6");
  const [notice, setNotice] = useState("");

  const load = async () => {
    try {
      const [messageResponse, scheduleResponse] = await Promise.all([
        fetch("/api/admin/notifications/messages", { headers: headers(adminToken), cache: "no-store" }),
        fetch("/api/admin/notifications/schedules", { headers: headers(adminToken), cache: "no-store" }),
      ]);
      const messagePayload = (await messageResponse.json()) as { messages?: Message[]; error?: string };
      const schedulePayload = (await scheduleResponse.json()) as { schedules?: Schedule[]; runs?: DeliveryRun[]; error?: string };
      if (!messageResponse.ok) throw new Error(messagePayload.error || "Failed to load messages");
      if (!scheduleResponse.ok) throw new Error(schedulePayload.error || "Failed to load schedules");
      setMessages(messagePayload.messages || []);
      setSchedules(schedulePayload.schedules || []);
      setRuns(schedulePayload.runs || []);
      if (!messageId && messagePayload.messages?.[0]) setMessageId(messagePayload.messages[0].id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to load schedules");
    }
  };

  useEffect(() => {
    if (adminToken) void load();
  }, [adminToken]);

  const createMessage = async (event: FormEvent) => {
    event.preventDefault();
    setNotice("");
    try {
      const response = await fetch("/api/admin/notifications/messages", {
        method: "POST",
        headers: headers(adminToken),
        body: JSON.stringify({ title, body, screen: "drop" }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Message creation failed");
      setTitle("");
      setBody("");
      setNotice("Message saved.");
      await load();
      if (payload.id) setMessageId(payload.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Message creation failed");
    }
  };

  const createSchedule = async (event: FormEvent) => {
    event.preventDefault();
    setNotice("");
    try {
      const response = await fetch("/api/admin/notifications/schedules", {
        method: "POST",
        headers: headers(adminToken),
        body: JSON.stringify({ message_id: messageId, time_local: timeLocal, timezone, days_of_week: days }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Schedule creation failed");
      setNotice("Schedule enabled. The Worker will evaluate it every minute.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Schedule creation failed");
    }
  };

  const toggleSchedule = async (schedule: Schedule) => {
    try {
      const response = await fetch("/api/admin/notifications/schedules", {
        method: "PATCH",
        headers: headers(adminToken),
        body: JSON.stringify({ id: schedule.id, is_enabled: !schedule.is_enabled }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Schedule update failed");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Schedule update failed");
    }
  };

  return (
    <section className="scheduled-console">
      <div className="push-heading">
        <div>
          <p className="push-kicker">CLOUDFLARE WORKER / D1</p>
          <h2>Scheduled Drops</h2>
          <p>Saved messages are delivered in the background, even when this page is closed.</p>
        </div>
        <button type="button" className="push-button push-button-dark" onClick={() => void load()}>REFRESH</button>
      </div>
      {notice && <p className="push-log">{notice}</p>}
      <div className="push-grid">
        <form className="push-form" onSubmit={createMessage}>
          <h3>MESSAGE LIBRARY</h3>
          <label>TITLE<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>
          <label>BODY<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={300} rows={4} required /></label>
          <button type="submit" className="push-button push-button-yellow">SAVE MESSAGE</button>
          <div className="schedule-list">
            {messages.map((message) => <button type="button" key={message.id} className={message.id === messageId ? "schedule-item selected" : "schedule-item"} onClick={() => setMessageId(message.id)}>{message.title}</button>)}
          </div>
        </form>
        <form className="push-form" onSubmit={createSchedule}>
          <h3>NEW SCHEDULE</h3>
          <label>MESSAGE<select value={messageId} onChange={(event) => setMessageId(event.target.value)} required>
            <option value="" disabled>Select a saved message</option>
            {messages.map((message) => <option key={message.id} value={message.id}>{message.title}</option>)}
          </select></label>
          <label>LOCAL TIME<input type="time" value={timeLocal} onChange={(event) => setTimeLocal(event.target.value)} required /></label>
          <label>IANA TIMEZONE<input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Asia/Kolkata" required /></label>
          <label>DAYS (0=SUN, 6=SAT)<input value={days} onChange={(event) => setDays(event.target.value)} placeholder="0,1,2,3,4,5,6" required /></label>
          <button type="submit" className="push-button push-button-yellow" disabled={!messages.length}>ENABLE SCHEDULE</button>
          <div className="schedule-list">
            {schedules.map((schedule) => <div className="schedule-item" key={schedule.id}><strong>{schedule.time_local} {schedule.timezone}</strong><span>{schedule.title} · days {schedule.days_of_week}</span><button type="button" className="push-button push-button-dark" onClick={() => void toggleSchedule(schedule)}>{schedule.is_enabled ? "DISABLE" : "ENABLE"}</button></div>)}
          </div>
          <h3>RECENT DELIVERY RUNS</h3>
          <div className="schedule-list">
            {runs.map((run) => <div className="schedule-item" key={run.id}><strong>{run.status.toUpperCase()} · {run.occurrence_key}</strong><span>Attempted: {run.total_attempted} · Sent: {run.total_sent} · Stale: {run.stale_pruned}</span>{run.error && <span className="schedule-error">{run.error}</span>}</div>)}
            {!runs.length && <div className="schedule-item"><span>No Worker runs recorded yet.</span></div>}
          </div>
        </form>
      </div>
    </section>
  );
}
