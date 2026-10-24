const target = process.env.ANALYTICS_LOAD_URL || "";
const token = process.env.ANALYTICS_APP_TOKEN || "";

if (!target || !token) throw new Error("Set ANALYTICS_LOAD_URL and ANALYTICS_APP_TOKEN.");
const parsed = new URL(target);
if (!/(localhost|127\.0\.0\.1|staging|preview)/i.test(parsed.hostname) || /pages\.dev$/i.test(parsed.hostname) && !/staging|preview/i.test(parsed.hostname)) {
  throw new Error("Refusing to send load traffic to a production URL.");
}

const started = Date.now();
let sent = 0;
let failed = 0;
const latencies: number[] = [];
while (Date.now() - started < 60_000) {
  const events = Array.from({ length: 50 }, (_, index) => ({
    schema_version: 1,
    event_id: `${Date.now()}-${sent}-${index}`,
    event_name: "meme_view",
    user_hash: (String(index).padStart(64, "0")).slice(-64),
    session_id: `${Date.now()}${String(index).padStart(16, "0")}`,
    timestamp_utc: new Date().toISOString(),
    platform: "android",
    app_version: "load-test",
    consent_status: "granted",
    consent_version: "v1"
  }));
  const requestStarted = Date.now();
  const response = await fetch(`${target.replace(/\/$/, "")}/api/analytics/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Analytics-App-Token": token },
    body: JSON.stringify({ events })
  });
  latencies.push(Date.now() - requestStarted);
  if (!response.ok) failed += events.length; else sent += events.length;
}
latencies.sort((a, b) => a - b);
console.log(JSON.stringify({ sent, failed, p95_latency_ms: latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] || 0 }));
