import type { PagesFunction } from "./_shared/pages";
import { json, requireAdmin, type Env } from "./_shared/d1r2";

type ReportStatus = "pending" | "resolved" | "dismissed";
type ReportAction = ReportStatus | "archive_meme" | "blacklist_meme" | "mark_nsfw";

type ReportRow = {
  id: string | number;
  meme_id: string | null;
  meme_url: string;
  meme_title: string | null;
  author: string;
  source: string | null;
  reason: string;
  details: string | null;
  device_id: string;
  status: ReportStatus;
  created_at: number;
  updated_at: number;
};

const dashboardHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Meme Capsule Reports</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --bg: #131313;
      --panel: #1c1b1b;
      --panel-2: #252525;
      --purple: #9b30ff;
      --gold: #f4c300;
      --pink: #dd0061;
      --green: #34c759;
      --text: #e5e2e1;
      --muted: #988ca1;
      --black: #000;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-width: 320px;
      background-color: var(--bg);
      background-image: linear-gradient(rgba(155,48,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(155,48,255,.045) 1px, transparent 1px);
      background-size: 28px 28px;
      color: var(--text);
      font: 16px/1.45 Oswald, Arial, sans-serif;
    }
    main { width: min(1320px, 100%); margin: 0 auto; padding: 28px 22px 70px; }
    h1, h2, h3, .brand, .stat strong { font-family: Anton, Arial, sans-serif; text-transform: uppercase; letter-spacing: .045em; }
    h1 { margin: 0; font-size: clamp(38px, 7vw, 74px); line-height: .95; }
    h2 { margin: 0; font-size: clamp(26px, 4vw, 42px); line-height: 1; }
    h3 { margin: 0; font-size: 25px; line-height: 1.05; }
    p { margin: 0; }
    button, input, select { font: inherit; }
    button { cursor: pointer; }
    .hidden { display: none !important; }
    .hero, .card, .stat {
      background: var(--panel);
      border: 2px solid var(--purple);
      box-shadow: 4px 4px 0 var(--black);
    }
    .hero { padding: 26px; margin-bottom: 22px; }
    .hero p { margin-top: 10px; color: var(--muted); font-size: 19px; }
    .eyebrow, .label, .badge, .meta, button, .copy-label {
      font-weight: 700;
      letter-spacing: .055em;
      text-transform: uppercase;
    }
    .eyebrow { margin-bottom: 10px; color: var(--gold); font-size: 14px; }
    .controls, .stats, .actions, .login-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .controls { margin-bottom: 22px; }
    input, select {
      min-height: 46px;
      padding: 9px 12px;
      border: 2px solid #3b3540;
      background: var(--panel-2);
      color: var(--text);
      outline: none;
    }
    input:focus, select:focus { border-color: var(--purple); }
    #search { min-width: 260px; flex: 1; }
    button {
      min-height: 46px;
      padding: 9px 16px;
      border: 2px solid var(--black);
      background: var(--gold);
      color: #111;
      box-shadow: 3px 3px 0 var(--black);
      transition: transform 100ms ease, box-shadow 100ms ease, opacity 100ms ease;
    }
    button:hover { transform: translate(1px, 1px); box-shadow: 2px 2px 0 var(--black); }
    button:active { transform: translate(3px, 3px); box-shadow: none; }
    button:disabled { cursor: wait; opacity: .65; }
    button.secondary { background: var(--purple); color: #fff; }
    button.danger { background: var(--pink); color: #fff; }
    button.resolve { background: var(--green); color: #111; }
    .stats { border: 0; box-shadow: none; background: transparent; margin-bottom: 22px; }
    .stat { min-width: 145px; flex: 1; padding: 14px 17px; border-color: #2a2a2a; box-shadow: 4px 4px 0 var(--black); }
    .stat strong { display: block; margin-top: 3px; font-size: 36px; }
    .label { color: var(--muted); font-size: 13px; }
    #reports { display: grid; gap: 20px; }
    .report { display: grid; grid-template-columns: 260px 1fr; gap: 22px; padding: 18px; border-color: #2a2a2a; }
    .preview-button { display: block; width: 100%; height: 240px; padding: 0; overflow: hidden; background: #090909; border: 2px solid var(--purple); box-shadow: 4px 4px 0 var(--gold); }
    .preview-button img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .preview-button:hover img { opacity: .8; }
    .report-main { min-width: 0; }
    .report-top, .meta, .copy-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .report-top { justify-content: space-between; gap: 18px; }
    .badge { display: inline-block; padding: 5px 9px; border: 2px solid var(--black); background: var(--gold); color: #111; font-size: 13px; }
    .badge.pending { background: var(--gold); }
    .badge.resolved { background: var(--green); color: #111; }
    .badge.dismissed { background: var(--pink); color: #fff; }
    .reason { margin-top: 18px; color: var(--gold); font-size: 17px; }
    .meta { margin-top: 12px; color: var(--muted); font-size: 14px; }
    .meta span { overflow-wrap: anywhere; }
    .id { color: var(--text); }
    .copy-row { margin-top: 10px; }
    .path { min-width: 0; max-width: 100%; color: var(--muted); overflow-wrap: anywhere; }
    .copy-button { min-height: 34px; padding: 5px 9px; font-size: 12px; }
    .details { margin-top: 17px; padding: 13px 15px; border-left: 5px solid var(--gold); background: var(--panel-2); }
    .details .label { color: var(--gold); margin-bottom: 5px; }
    .details p { white-space: pre-wrap; color: var(--text); }
    .actions { margin-top: 18px; }
    .empty { padding: 40px; text-align: center; color: var(--muted); }
    #login { width: min(500px, calc(100% - 30px)); margin: 14vh auto; }
    .login-row input { min-width: 0; flex: 1; }
    #login-error, #toast { color: #fff; }
    #login-error { min-height: 24px; margin-top: 12px; }
    #toast {
      position: fixed; z-index: 10; right: 22px; bottom: 22px; max-width: min(440px, calc(100% - 44px));
      padding: 14px 18px; border: 2px solid var(--black); background: var(--pink); box-shadow: 4px 4px 0 var(--black);
      font-weight: 700;
    }
    #lightbox { position: fixed; z-index: 20; inset: 0; display: grid; place-items: center; padding: 30px; background: rgba(0,0,0,.88); }
    #lightbox img { max-width: min(1100px, 94vw); max-height: 86vh; border: 3px solid var(--gold); box-shadow: 7px 7px 0 var(--purple); }
    #lightbox-close { position: absolute; right: 24px; top: 20px; }
    @media (max-width: 720px) {
      main { padding: 18px 14px 50px; }
      .report { grid-template-columns: 1fr; }
      .preview-button { height: min(65vw, 300px); }
      .report-top { align-items: flex-start; flex-direction: column; }
    }
  </style>
</head>
<body>
  <main id="app">
    <section id="login" class="hero">
      <div class="eyebrow">Meme Capsule / Admin</div>
      <h1>Report Desk</h1>
      <p>Enter the admin API token to inspect and triage reported memes.</p>
      <div class="login-row">
        <input id="token" type="password" autocomplete="current-password" placeholder="ADMIN API TOKEN">
        <button id="unlock" type="button">Open Desk</button>
      </div>
      <p id="login-error" role="alert"></p>
    </section>
    <section id="dashboard" class="hidden">
      <section class="hero">
        <div class="eyebrow">Meme Capsule / Moderation</div>
        <h1>Meme Reports</h1>
        <p>Inspect the meme, understand what's wrong, and make the call.</p>
      </section>
      <section class="controls" aria-label="Report filters">
        <input id="search" placeholder="SEARCH TITLE, REASON, AUTHOR, DEVICE...">
        <select id="status">
          <option value="">ALL STATUSES</option>
          <option value="pending">PENDING</option>
          <option value="resolved">RESOLVED</option>
          <option value="dismissed">DISMISSED</option>
        </select>
        <button id="refresh" type="button">Refresh</button>
        <button id="logout" type="button" class="secondary">Log out</button>
      </section>
      <section id="stats" class="stats" aria-label="Report counts"></section>
      <section id="reports" aria-live="polite"></section>
    </section>
  </main>
  <div id="toast" class="hidden" role="status"></div>
  <div id="lightbox" class="hidden" role="dialog" aria-modal="true" aria-label="Meme preview">
    <button id="lightbox-close" type="button" class="danger">Close</button>
    <img id="lightbox-image" alt="">
  </div>
  <script>
    const state={reports:[],token:sessionStorage.getItem("meme-capsule-report-token")||""};
    const $=id=>document.getElementById(id);
    const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    const reportId=value=>String(value??"");
    const formatDate=value=>{const parsed=new Date(Number(value));return Number.isNaN(parsed.valueOf())?"UNKNOWN DATE":parsed.toLocaleString()};
    const storagePath=url=>{try{return new URL(url).pathname.split("/").filter(Boolean).pop()||url}catch{return url}};
    const authHeaders=()=>({Authorization:"Bearer "+state.token});
    const showDashboard=show=>{$("login").classList.toggle("hidden",show);$("dashboard").classList.toggle("hidden",!show)};
    let toastTimer;
    const showToast=(message,type="error")=>{const node=$("toast");node.textContent=message;node.style.background=type==="success"?"var(--green)":"var(--pink)";node.style.color=type==="success"?"#111":"#fff";node.classList.remove("hidden");clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.add("hidden"),4500)};
    const visibleReports=()=>{const query=$("search").value.trim().toLowerCase(),status=$("status").value;return state.reports.filter(report=>(!status||report.status===status)&&(!query||[report.meme_title,report.meme_url,report.meme_id,report.author,report.reason,report.device_id,report.details].some(value=>String(value||"").toLowerCase().includes(query))))};
    const placeholder=report=>"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#252525"/><text x="50%" y="48%" fill="#f4c300" font-family="Arial" font-size="34" text-anchor="middle">IMAGE UNAVAILABLE</text><text x="50%" y="58%" fill="#988ca1" font-family="Arial" font-size="20" text-anchor="middle">'+String(report.meme_title||"UNTITLED").replace(/[<>&"]/g,"")+"</text></svg>");
    const render=()=>{
      const counts={total:state.reports.length,pending:0,resolved:0,dismissed:0};
      state.reports.forEach(report=>{if(report.status in counts)counts[report.status]++});
      $("stats").innerHTML=Object.entries(counts).map(([label,value])=>'<div class="stat"><div class="label">'+escapeHtml(label)+'</div><strong>'+value+'</strong></div>').join("");
      const reports=visibleReports();
      $("reports").innerHTML=reports.length?reports.map(report=>{
        const id=reportId(report.id),url=String(report.meme_url||"");
        return '<article class="card report">'+
          '<button class="preview-button" type="button" data-preview="'+escapeHtml(url)+'" data-title="'+escapeHtml(report.meme_title||"UNTITLED")+'">'+
            '<img src="'+escapeHtml(url)+'" alt="'+escapeHtml(report.meme_title||"UNTITLED")+'" data-fallback="'+escapeHtml(placeholder(report))+'">'+
          '</button>'+
          '<div class="report-main">'+
            '<div class="report-top"><div><span class="badge '+escapeHtml(report.status)+'">'+escapeHtml(report.status)+'</span><span class="badge" style="margin-left:8px">#'+escapeHtml(id)+'</span></div><span class="meta">'+escapeHtml(formatDate(report.created_at))+'</span></div>'+
            '<h3 style="margin-top:16px">'+escapeHtml(report.meme_title||"UNTITLED")+'</h3>'+
            '<div class="reason">WHAT\'S WRONG: <strong>'+escapeHtml(report.reason||"UNSPECIFIED")+'</strong></div>'+
            '<div class="meta"><span class="id">MEME ID: '+escapeHtml(report.meme_id||"N/A")+'</span><span>AUTHOR: '+escapeHtml(report.author||"UNKNOWN")+'</span><span>DEVICE: '+escapeHtml(report.device_id||"UNKNOWN")+'</span></div>'+
            '<div class="copy-row"><span class="path">FILE: '+escapeHtml(storagePath(url))+'</span><button class="copy-button secondary" type="button" data-copy="'+escapeHtml(url)+'">Copy URL</button></div>'+
            (report.details?'<div class="details"><div class="label">Reporter\'s comment</div><p>'+escapeHtml(report.details)+'</p></div>':"")+
            '<div class="actions">'+
              (report.status!=="resolved"?'<button class="resolve" data-id="'+escapeHtml(id)+'" data-action="resolved" type="button">Resolve</button>':"")+
              (report.status!=="dismissed"?'<button class="danger" data-id="'+escapeHtml(id)+'" data-action="dismissed" type="button">Dismiss</button>':"")+
              (report.meme_id?'<button class="danger" data-id="'+escapeHtml(id)+'" data-action="archive_meme" data-meme-id="'+escapeHtml(report.meme_id)+'" type="button">Remove Meme</button><button class="danger" data-id="'+escapeHtml(id)+'" data-action="blacklist_meme" data-meme-id="'+escapeHtml(report.meme_id)+'" type="button">Blacklist + Remove</button>'+(String(report.reason||'').toUpperCase()==='NSFW'?'<button class="secondary" style="background:#dd0061;color:#fff;" data-id="'+escapeHtml(id)+'" data-action="mark_nsfw" data-meme-id="'+escapeHtml(report.meme_id)+'" type="button">Mark NSFW</button>':''):"")+
            '</div>'+
          '</div>'+
        '</article>';
      }).join(""):'<div class="card empty">NO REPORTS MATCH THE CURRENT FILTERS.</div>';
      document.querySelectorAll("img[data-fallback]").forEach(image=>image.addEventListener("error",()=>{image.src=image.dataset.fallback;image.removeAttribute("data-fallback")},{once:true}));
    };
    const load=async()=>{
      const response=await fetch("/reports?format=json&limit=250",{headers:authHeaders()});
      if(response.status===401){sessionStorage.removeItem("meme-capsule-report-token");state.token="";showDashboard(false);$("login-error").textContent="Unauthorized: check the admin API token.";return}
      if(!response.ok){const message=await response.text();throw new Error(message||"Unable to load reports ("+response.status+").")}
      const data=await response.json();state.reports=Array.isArray(data.reports)?data.reports:[];showDashboard(true);render();
    };
    const updateReport=async(button)=>{
      const id=button.dataset.id,action=button.dataset.action,original=button.textContent;
      const destructive=action==="archive_meme"||action==="blacklist_meme";
      if(destructive&&!window.confirm(action==="blacklist_meme"?"Blacklist and remove this meme from the public collection?":"Remove this meme from the public collection?"))return;
      button.disabled=true;button.textContent="Updating...";
      try{
        const response=await fetch("/reports",{method:"PATCH",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify({id,action,meme_id:button.dataset.memeId})});
        if(!response.ok){const raw=await response.text();let message=raw;try{message=JSON.parse(raw).error||raw}catch{}throw new Error(message||"Update failed ("+response.status+").")}
        showToast(action==="archive_meme"?"Meme removed and report resolved.":action==="blacklist_meme"?"Meme blacklisted, removed, and report resolved.":action==="mark_nsfw"?"Meme marked NSFW and report resolved.":"Report #"+id+" marked "+action+".","success");await load();
      }catch(error){button.disabled=false;button.textContent=original;showToast(error instanceof Error?error.message:"Unable to update report.")}
    };
    $("unlock").addEventListener("click",async()=>{state.token=$("token").value.trim();if(!state.token){$("login-error").textContent="Admin API token is required.";return}$("login-error").textContent="";sessionStorage.setItem("meme-capsule-report-token",state.token);try{await load()}catch(error){$("login-error").textContent=error instanceof Error?error.message:"Unable to open report desk."}});
    $("token").addEventListener("keydown",event=>{if(event.key==="Enter")$("unlock").click()});
    $("refresh").addEventListener("click",()=>load().catch(error=>showToast(error instanceof Error?error.message:"Unable to refresh reports.")));
    $("logout").addEventListener("click",()=>{sessionStorage.removeItem("meme-capsule-report-token");state.token="";$("token").value="";showDashboard(false)});
    $("search").addEventListener("input",render);$("status").addEventListener("change",render);
    $("reports").addEventListener("click",async event=>{
      const button=event.target.closest("button");if(!button)return;
      if(button.dataset.id&&button.dataset.action){await updateReport(button);return}
      if(button.dataset.copy){try{await navigator.clipboard.writeText(button.dataset.copy);showToast("Meme URL copied.","success")}catch{showToast("Clipboard access failed. Copy the URL manually.")};return}
      if(button.dataset.preview){$("lightbox-image").src=button.dataset.preview;$("lightbox-image").alt=button.dataset.title||"Meme preview";$("lightbox").classList.remove("hidden")}
    });
    $("lightbox-close").addEventListener("click",()=>$("lightbox").classList.add("hidden"));
    $("lightbox").addEventListener("click",event=>{if(event.target===$("lightbox"))$("lightbox").classList.add("hidden")});
    document.addEventListener("keydown",event=>{if(event.key==="Escape")$("lightbox").classList.add("hidden")});
    if(state.token)load().catch(()=>{state.token="";showDashboard(false)});
  </script>
</body>
</html>`;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("format") !== "json") {
    return new Response(dashboardHtml, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const status = url.searchParams.get("status");
  const query = url.searchParams.get("q")?.trim() || "";
  const limitValue = Number(url.searchParams.get("limit") || "100");
  const limit = Number.isFinite(limitValue) ? Math.min(Math.max(Math.floor(limitValue), 1), 250) : 100;
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (status && ["pending", "resolved", "dismissed"].includes(status)) {
    where.push("status = ?");
    params.push(status);
  }
  if (query) {
    where.push("(meme_url LIKE ? OR meme_title LIKE ? OR meme_id LIKE ? OR author LIKE ? OR reason LIKE ? OR device_id LIKE ? OR details LIKE ?)");
    const pattern = `%${query}%`;
    params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }

  const result = await env.DB.prepare(`
    SELECT id, meme_id, meme_url, meme_title, author, source, reason, details, device_id, status, created_at, updated_at
    FROM meme_reports
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).bind(...params, limit).all<ReportRow>();

  return json({ reports: result.results || [] });
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  let payload: { id?: string | number; action?: ReportAction; meme_id?: string };
  try {
    payload = await request.json() as { id?: string | number; action?: ReportAction; meme_id?: string };
  } catch {
    return json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const id = payload.id === undefined || payload.id === null ? "" : String(payload.id).trim();
  const action = payload.action;
  if (!id || !action || !["pending", "resolved", "dismissed", "archive_meme", "blacklist_meme", "mark_nsfw"].includes(action)) {
    return json({ error: "A report id and valid moderation action are required." }, { status: 400 });
  }

  const report = await env.DB.prepare(
    "SELECT meme_id FROM meme_reports WHERE id = ?"
  ).bind(id).first<{ meme_id: string | null }>();
  if (!report) {
    return json({ error: "Report not found." }, { status: 404 });
  }

  if (action === "mark_nsfw") {
    const memeId = String(report.meme_id || "").trim();
    if (!memeId) {
      return json({ error: "This report is not linked to a meme ID, so NSFW flag cannot be set." }, { status: 400 });
    }

    const meme = await env.DB.prepare("SELECT id FROM memes WHERE id = ?").bind(memeId).first<{ id: string }>();
    if (!meme) {
      return json({ error: "The reported meme no longer exists." }, { status: 404 });
    }

    await env.DB.prepare(
      "UPDATE memes SET is_nsfw = 1, nsfw_flagged_by = 'report' WHERE id = ?"
    ).bind(memeId).run();
  }

  if (action === "archive_meme" || action === "blacklist_meme") {
    const memeId = String(report.meme_id || "").trim();
    if (!memeId) {
      return json({ error: "This report is not linked to a meme ID, so the meme cannot be removed safely." }, { status: 400 });
    }

    const meme = await env.DB.prepare("SELECT id FROM memes WHERE id = ?").bind(memeId).first<{ id: string }>();
    if (!meme) {
      return json({ error: "The reported meme no longer exists." }, { status: 404 });
    }

    if (action === "blacklist_meme") {
      const columns = await env.DB.prepare("PRAGMA table_info(content_blacklist)").all<{
        name: string;
        notnull: number;
        dflt_value: string | null;
      }>();
      const available = new Set((columns.results || []).map((column) => column.name));
      const values: Record<string, string | number> = {};
      const idColumn = ["meme_id", "id", "content_id"].find((column) => available.has(column));
      if (!idColumn) {
        return json({ error: "content_blacklist has no supported meme identifier column." }, { status: 500 });
      }
      values[idColumn] = memeId;
      if (available.has("reason")) values.reason = "User report";
      if (available.has("source")) values.source = "Meme Capsule Reports";
      if (available.has("report_id")) values.report_id = id;
      if (available.has("created_at")) values.created_at = Date.now();
      if (available.has("updated_at")) values.updated_at = Date.now();

      const entries = Object.entries(values);
      const quoteIdentifier = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;
      await env.DB.prepare(
        `INSERT OR REPLACE INTO content_blacklist (${entries.map(([column]) => quoteIdentifier(column)).join(", ")})
         VALUES (${entries.map(() => "?").join(", ")})`
      ).bind(...entries.map(([, value]) => value)).run();
    }

    await env.DB.prepare(
      "UPDATE memes SET status = 'archived', is_active = 0 WHERE id = ?"
    ).bind(memeId).run();
  }

  const status: ReportStatus = (action === "archive_meme" || action === "blacklist_meme" || action === "mark_nsfw")
    ? "resolved"
    : action;
  const result = await env.DB.prepare(
    "UPDATE meme_reports SET status = ?, updated_at = ? WHERE id = ?"
  ).bind(status, Date.now(), id).run();

  if (!result.meta.changes) {
    return json({ error: "Report not found or status was unchanged." }, { status: 404 });
  }

  return json({ success: true, id, status, action });
};
