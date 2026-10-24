import { useEffect, useMemo, useState } from "react";

type TabKey = "Overview" | "Audience" | "Content" | "AI";
type RangeKey = "7d" | "30d" | "90d";
type PlatformKey = "All" | "Android" | "Web";

type Kpi = {
  label: string;
  value: string;
  delta: string;
  accent: string;
  sub: string;
};

type Insight = {
  title: string;
  value: string;
  note: string;
  accent: string;
};

type LiveAnalyticsDetails = {
  audience: { platforms: Array<{ platform: string; users: number; events: number }>; app_versions: Array<{ app_version: string; users: number; events: number }> };
  content: Array<{ category: string; views: number; likes: number; shares: number; saves: number; users: number }>;
  retention: Array<{ cohort_date: string; users: number; d1: number; d7: number; d30: number }>;
  funnel: Array<{ label: string; sessions: number; conversion_rate: number }>;
  insights: Insight[];
};

const filters = {
  rangeOptions: [
    { key: "7d", label: "7D" },
    { key: "30d", label: "30D" },
    { key: "90d", label: "90D" }
  ] as const,
  platformOptions: ["All", "Android"] as const
};

function MetricCard({ item }: { item: Kpi }) {
  return (
    <div style={{ background: "linear-gradient(180deg, rgba(18, 18, 18, 0.98), rgba(14,14,14,0.98))", border: `1.5px solid ${item.accent}`, boxShadow: "4px 4px 0 rgba(0,0,0,0.8)", padding: "18px 16px", minHeight: 118 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.12em", color: "#bdbdbd", textTransform: "uppercase" }}>{item.label}</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: item.accent }}>{item.delta}</span>
      </div>
      <div style={{ fontFamily: "Anton, sans-serif", fontSize: 30, lineHeight: 1.1, marginTop: 12, color: item.accent }}>{item.value}</div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#d5d5d5" }}>{item.sub}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div style={{ padding: "28px 16px", border: "1px dashed #555", color: "#a9a9a9", fontSize: 12, textAlign: "center" }}>{message}</div>;
}

function TrendChart({ values }: { values: number[] }) {
  const width = 620;
  const height = 220;
  const chartValues = values.length > 1 ? values : [0, 0];
  const maxValue = Math.max(...chartValues);
  const minValue = Math.min(...chartValues);
  const stepX = width / (chartValues.length - 1);
  const points = chartValues.map((value, index) => {
    const x = index * stepX;
    const y = height - ((value - minValue) / (maxValue - minValue || 1)) * (height - 30) - 10;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="220" style={{ display: "block" }}>
      <defs>
        <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f4c300" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#f4c300" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((line) => (
        <line key={line} x1="0" x2={width} y1={20 + line * 45} y2={20 + line * 45} stroke="#363636" strokeDasharray="5 8" />
      ))}
      <polyline points={`0,${height} ${points} ${width},${height}`} fill="url(#trendFill)" opacity={1} />
      <polyline points={points} fill="none" stroke="#f4c300" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {chartValues.map((value, index) => {
        const x = index * stepX;
        const y = height - ((value - minValue) / (maxValue - minValue || 1)) * (height - 30) - 10;
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="4" fill="#fff" stroke="#f4c300" strokeWidth="2" />;
      })}
    </svg>
  );
}

function InfoTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: "#121212", border: "1.5px solid #2d2d2d", padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "#bdbdbd", letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 6, color: accent, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

export default function AnalyticsPreviewPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("Overview");
  const [range, setRange] = useState<RangeKey>("30d");
  const [platform, setPlatform] = useState<PlatformKey>("All");
  const [liveOverview, setLiveOverview] = useState<{
    kpis: {
      active_users: number;
      sessions: number;
      total_events: number;
      views: number;
      likes: number;
      shares: number;
      saves: number;
      engagement_rate: number;
      view_to_action_rate: number;
      last_event_at: string | null;
    };
    live: boolean;
  } | null>(null);
  const [liveTrend, setLiveTrend] = useState<Array<{ views: number }>>([]);
  const [liveDetails, setLiveDetails] = useState<LiveAnalyticsDetails | null>(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Meme Capsule Analytics Preview";
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = sessionStorage.getItem("curator_token");
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const platformQuery = platform === "Android" ? "&platform=android" : "";

    if (!token) {
      setAnalyticsError("Curator session required to view live Android analytics.");
      setIsLoading(false);
      return;
    }

    const loadAnalytics = async () => {
      if (!liveOverview) setIsLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const responses = await Promise.all([
          fetch(`/api/analytics/overview?days=${days}${platformQuery}`, { headers, cache: "no-store" }),
          fetch(`/api/analytics/trends?days=${days}`, { headers, cache: "no-store" }),
          fetch("/api/analytics/audience", { headers, cache: "no-store" }),
          fetch("/api/analytics/content", { headers, cache: "no-store" }),
          fetch("/api/analytics/retention", { headers, cache: "no-store" }),
          fetch("/api/analytics/funnel", { headers, cache: "no-store" }),
          fetch("/api/analytics/ai-insights", { headers, cache: "no-store" })
        ]);
        const [overviewResponse, trendResponse, audienceResponse, contentResponse, retentionResponse, funnelResponse, insightsResponse] = responses;
        const overview = await overviewResponse.json() as typeof liveOverview;
        const trends = await trendResponse.json() as { trends?: Array<{ views: number }> };
        const audienceResponseBody = await audienceResponse.json() as { platforms?: LiveAnalyticsDetails["audience"]["platforms"]; app_versions?: LiveAnalyticsDetails["audience"]["app_versions"] };
        const content = await contentResponse.json() as { content?: LiveAnalyticsDetails["content"] };
        const retention = await retentionResponse.json() as { cohorts?: LiveAnalyticsDetails["retention"] };
        const funnel = await funnelResponse.json() as { funnel?: LiveAnalyticsDetails["funnel"] };
        const insights = await insightsResponse.json() as { insights?: Insight[] };
        if (responses.some((response) => !response.ok)) {
          throw new Error((overview as { error?: string }).error || "Live analytics request failed.");
        }
        if (!cancelled) {
          setLiveOverview(overview);
          setLiveTrend(trends.trends || []);
          setLiveDetails({
            audience: {
              platforms: audienceResponseBody.platforms || [],
              app_versions: audienceResponseBody.app_versions || []
            },
            content: content.content || [],
            retention: retention.cohorts || [],
            funnel: funnel.funnel || [],
            insights: insights.insights || []
          });
          setAnalyticsError("");
          setLastRefreshAt(new Date().toISOString());
          setIsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setAnalyticsError(error instanceof Error ? error.message : "Live analytics unavailable.");
          setIsLoading(false);
        }
      }
    };

    loadAnalytics();
    const refreshTimer = window.setInterval(loadAnalytics, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [platform, range]);

  const kpis = useMemo(() => {
    const metrics = liveOverview?.kpis;
    if (!metrics) return [];
    return [
      { label: "Android users", value: metrics.active_users.toLocaleString(), delta: "LIVE", accent: "#6ee7ff", sub: "unique consented users" },
      { label: "Sessions", value: metrics.sessions.toLocaleString(), delta: "LIVE", accent: "#34C759", sub: "in selected window" },
      { label: "Meme views", value: metrics.views.toLocaleString(), delta: "LIVE", accent: "#f4c300", sub: "from Android events" },
      { label: "Engagement", value: `${(metrics.engagement_rate * 100).toFixed(1)}%`, delta: "LIVE", accent: "#9b30ff", sub: "actions per session" },
      { label: "Shares", value: metrics.shares.toLocaleString(), delta: "LIVE", accent: "#FF7A59", sub: "Android share events" },
      { label: "Saves", value: metrics.saves.toLocaleString(), delta: "LIVE", accent: "#7cdb8d", sub: "Android save events" }
    ];
  }, [liveOverview]);

  const trendValues = liveTrend.map((item) => Number(item.views || 0));
  const currentInsights = liveDetails?.insights || [];
  const hasLiveData = Boolean(liveOverview);
  const audienceSegmentsLive = liveDetails?.audience.platforms.map((segment) => ({
    label: segment.platform,
    value: `${segment.users} users`,
    color: segment.platform === "android" ? "#6ee7ff" : "#f4c300",
    width: `${Math.min(100, segment.users)}%`
  })) || [];
  const contentLeadersLive = liveDetails?.content.map((item) => ({
    name: item.category,
    ctr: item.views ? `${((item.likes + item.shares + item.saves) / item.views * 100).toFixed(1)}%` : "0.0%",
    shares: `${item.shares} shares`
  })) || [];

  return (
    <div style={{ minHeight: "100vh", background: "#101010", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <aside style={{ width: 220, background: "#151515", borderRight: "2px solid #2d2d2d", padding: "26px 16px" }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9a9a9a" }}>Meme capsule</div>
            <div style={{ fontFamily: "Anton, sans-serif", fontSize: 22, letterSpacing: "0.06em", color: "#f4c300", textTransform: "uppercase", marginTop: 6 }}>Analytics</div>
          </div>

          <nav style={{ display: "grid", gap: 8 }}>
            {(["Overview", "Audience", "Content", "AI"] as TabKey[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? "#f4c300" : "transparent",
                  color: activeTab === tab ? "#111" : "#eaeaea",
                  border: activeTab === tab ? "2px solid #000" : "1px solid #3b3b3b",
                  boxShadow: activeTab === tab ? "4px 4px 0 rgba(0,0,0,0.8)" : "none",
                  padding: "12px 14px",
                  textAlign: "left",
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer"
                }}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div style={{ marginTop: 28, background: "#1a1a1a", border: "1px solid #3b3b3b", padding: "12px" }}>
            <div style={{ fontSize: 10, color: "#bdbdbd", letterSpacing: "0.14em", textTransform: "uppercase" }}>System status</div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#34C759", display: "inline-block" }} />
              <span style={{ color: "#d6d6d6", fontSize: 12 }}>Healthy pipeline</span>
            </div>
          </div>
        </aside>

        <main style={{ flex: 1, padding: "24px 20px 40px" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "#a3a3a3", textTransform: "uppercase" }}>Performance intelligence</div>
              <div style={{ fontFamily: "Anton, sans-serif", fontSize: 34, letterSpacing: "0.05em", textTransform: "uppercase", color: "#f4c300" }}>Growth dashboard</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, background: "#171717", border: "1px solid #2f2f2f", padding: "6px" }}>
                {filters.rangeOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setRange(option.key)}
                    style={{
                      background: range === option.key ? "#f4c300" : "transparent",
                      color: range === option.key ? "#111" : "#ddd",
                      border: "none",
                      padding: "8px 10px",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase"
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, background: "#171717", border: "1px solid #2f2f2f", padding: "6px" }}>
                {filters.platformOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPlatform(option)}
                    style={{
                      background: platform === option ? "#9b30ff" : "transparent",
                      color: platform === option ? "#fff" : "#ddd",
                      border: "none",
                      padding: "8px 10px",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase"
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <button type="button" onClick={() => { window.history.pushState({}, "", "/curate"); window.dispatchEvent(new PopStateEvent("popstate")); }} style={{ background: "#111", border: "2px solid #fff", color: "#fff", padding: "10px 16px", fontWeight: 700, cursor: "pointer", boxShadow: "4px 4px 0 #000" }}>
                Back to curation
              </button>
            </div>
          </header>

          <div style={{ marginBottom: 18, padding: "10px 14px", border: "1px solid #3b3b3b", background: "#171717", color: analyticsError ? "#FF7A59" : "#34C759", fontSize: 12 }}>
            {analyticsError || (isLoading ? "Loading live Android KPIs..." : hasLiveData
              ? `LIVE ANDROID FEED • Last event ${liveOverview?.kpis.last_event_at || "not received"} • Refreshed ${lastRefreshAt || "now"}`
              : "No live Android analytics data has been received yet.")}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 18 }}>
            {isLoading && !hasLiveData
              ? <div style={{ gridColumn: "1 / -1" }}><EmptyState message="Loading live KPI data..." /></div>
              : kpis.length
                ? kpis.map((item) => <MetricCard key={item.label} item={item} />)
                : <div style={{ gridColumn: "1 / -1" }}><EmptyState message="No Android events are available for this range." /></div>}
          </div>

          {activeTab === "Overview" && (
            <>
              <section style={{ display: "grid", gridTemplateColumns: "1.5fr 0.9fr", gap: 18, marginBottom: 18 }}>
                <div style={{ background: "#171717", border: "2px solid #f4c300", boxShadow: "5px 5px 0 #000", padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Engagement trend</h3>
                    <span style={{ fontSize: 11, color: "#f4c300", border: "1px solid #f4c300", padding: "4px 8px" }}>{platform === "All" ? "All sources" : platform}</span>
                  </div>
                  {trendValues.length ? <TrendChart values={trendValues} /> : <EmptyState message="No trend events are available for this range." />}
                </div>

                <div style={{ background: "#171717", border: "2px solid #9b30ff", boxShadow: "5px 5px 0 #000", padding: 18 }}>
                  <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>Verdict mix</h3>
                <EmptyState message="Curation verdict analytics are not part of the Android KPI contract." />
                </div>
              </section>

              <section style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr 0.7fr", gap: 18 }}>
                <div style={{ background: "#171717", border: "2px solid #34C759", boxShadow: "5px 5px 0 #000", padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Judge performance</h3>
                    <span style={{ fontSize: 11, color: "#c7c7c7" }}>weekly</span>
                  </div>
                  <EmptyState message="Judge performance belongs to the curation dashboard, not Android telemetry." />
                </div>

                <div style={{ background: "#171717", border: "2px solid #5AC8FA", boxShadow: "5px 5px 0 #000", padding: 18 }}>
                  <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>Acquisition</h3>
                  <EmptyState message="Source attribution is not available in the current Android contract." />
                </div>

                <div style={{ background: "#171717", border: "2px solid #FF3B30", boxShadow: "5px 5px 0 #000", padding: 18 }}>
                  <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>Behavior</h3>
                  <div style={{ display: "grid", gap: 12 }}>
                    <EmptyState message="Detailed behavior metrics require additional approved event properties." />
                  </div>
                </div>

                <div style={{ background: "#171717", border: "2px solid #f4c300", boxShadow: "5px 5px 0 #000", padding: 18, gridColumn: "1 / -1" }}>
                  <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px" }}>Retention & funnel</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      {(liveDetails?.retention || []).slice(0, 5).map((cohort) => (
                        <div key={cohort.cohort_date} style={{ display: "flex", justifyContent: "space-between", background: "#121212", padding: "9px 12px", fontSize: 12 }}>
                          <span>{cohort.cohort_date} ({cohort.users})</span>
                          <strong style={{ color: "#f4c300" }}>D1 {(cohort.d1 * 100).toFixed(0)}% · D7 {(cohort.d7 * 100).toFixed(0)}%</strong>
                        </div>
                      ))}
                      {!liveDetails?.retention.length && <EmptyState message="No retention cohorts are available yet." />}
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {(liveDetails?.funnel || []).map((stage) => (
                        <div key={stage.label} style={{ display: "flex", justifyContent: "space-between", background: "#121212", padding: "9px 12px", fontSize: 12 }}>
                          <span>{stage.label}</span>
                          <strong style={{ color: "#6ee7ff" }}>{stage.sessions} · {(stage.conversion_rate * 100).toFixed(0)}%</strong>
                        </div>
                      ))}
                      {!liveDetails?.funnel.length && <EmptyState message="No funnel events are available yet." />}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === "Audience" && (
            <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18 }}>
              <div style={{ background: "#171717", border: "2px solid #6ee7ff", boxShadow: "5px 5px 0 #000", padding: 18 }}>
                <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px" }}>Audience segments</h3>
                <div style={{ display: "grid", gap: 14 }}>
                  {audienceSegmentsLive.map((segment) => (
                    <div key={segment.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "#d7d7d7" }}>
                        <span>{segment.label}</span>
                        <strong>{segment.value}</strong>
                      </div>
                      <div style={{ height: 12, background: "#262626", border: "2px solid #000" }}>
                        <div style={{ width: segment.width, height: "100%", background: segment.color, borderRight: "2px solid #000" }} />
                      </div>
                    </div>
                  ))}
                  {!liveDetails?.audience.platforms.length && <EmptyState message="No audience events are available yet." />}
                </div>
              </div>

              <div style={{ background: "#171717", border: "2px solid #9b30ff", boxShadow: "5px 5px 0 #000", padding: 18 }}>
                <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px" }}>AI audience notes</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  {currentInsights.length ? currentInsights.map((insight) => (
                    <div key={insight.title} style={{ background: "#121212", border: "1.5px solid #2d2d2d", padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#bdbdbd" }}>{insight.title}</span>
                        <strong style={{ color: insight.accent }}>{insight.value}</strong>
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.6, color: "#d9d9d9" }}>{insight.note}</div>
                    </div>
                  )) : <EmptyState message="No deterministic audience insights are available yet." />}
                </div>
              </div>
            </section>
          )}

          {activeTab === "Content" && (
            <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div style={{ background: "#171717", border: "2px solid #34C759", boxShadow: "5px 5px 0 #000", padding: 18 }}>
                <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px" }}>Top content clusters</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  {contentLeadersLive.map((item, index) => (
                    <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#121212", border: "1.5px solid #2d2d2d", padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ width: 26, height: 26, display: "grid", placeItems: "center", background: "#f4c300", color: "#111", fontWeight: 900, fontSize: 12 }}>{index + 1}</span>
                        <div>
                          <div style={{ fontWeight: 800 }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: "#bdbdbd" }}>CTR {item.ctr}</div>
                        </div>
                      </div>
                      <strong style={{ color: "#fff" }}>{item.shares}</strong>
                    </div>
                  ))}
                  {!liveDetails?.content.length && <EmptyState message="No content performance data is available yet." />}
                </div>
              </div>

              <div style={{ background: "#171717", border: "2px solid #f4c300", boxShadow: "5px 5px 0 #000", padding: 18 }}>
                <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px" }}>AI content recommendations</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  {currentInsights.length ? currentInsights.map((insight) => (
                    <div key={insight.title} style={{ background: "#121212", border: "1.5px solid #2d2d2d", padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#bdbdbd" }}>{insight.title}</span>
                        <span style={{ color: insight.accent, fontWeight: 800 }}>{insight.value}</span>
                      </div>
                      <div style={{ color: "#d8d8d8", lineHeight: 1.6, fontSize: 12 }}>{insight.note}</div>
                    </div>
                  )) : <EmptyState message="No deterministic content recommendations are available yet." />}
                </div>
              </div>
            </section>
          )}

          {activeTab === "AI" && (
            <section style={{ display: "grid", gridTemplateColumns: "1.1fr 1.1fr 0.8fr", gap: 18 }}>
              <div style={{ background: "#171717", border: "2px solid #f4c300", boxShadow: "5px 5px 0 #000", padding: 18 }}>
                <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px" }}>AI insights</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  {currentInsights.length ? currentInsights.map((insight) => (
                    <div key={insight.title} style={{ background: "#121212", border: "1.5px solid #2d2d2d", padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#bdbdbd" }}>{insight.title}</span>
                        <span style={{ color: insight.accent, fontWeight: 800 }}>{insight.value}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#d8d8d8", lineHeight: 1.5 }}>{insight.note}</div>
                    </div>
                  )) : <EmptyState message="No deterministic insights are available yet." />}
                </div>
              </div>

              <div style={{ background: "#171717", border: "2px solid #FF3B30", boxShadow: "5px 5px 0 #000", padding: 18 }}>
                <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px" }}>Behavioral KPIs</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <EmptyState message="Behavioral breakdowns require additional approved event properties." />
                </div>
              </div>

              <div style={{ background: "#171717", border: "2px solid #9b30ff", boxShadow: "5px 5px 0 #000", padding: 18 }}>
                <h3 style={{ fontFamily: "Anton, sans-serif", fontSize: 20, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 16px" }}>Future-ready</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <InfoTile label="Android event feed" value={hasLiveData ? "Connected" : "Awaiting events"} accent={hasLiveData ? "#34C759" : "#f4c300"} />
                  <InfoTile label="Retention cohorts" value={liveDetails?.retention.length ? "Available" : "Awaiting events"} accent="#6ee7ff" />
                  <InfoTile label="Session analytics" value={liveOverview?.kpis.sessions ? "Available" : "Awaiting events"} accent="#f4c300" />
                  <InfoTile label="User funnel" value={liveDetails?.funnel.length ? "Available" : "Awaiting events"} accent="#9b30ff" />
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
