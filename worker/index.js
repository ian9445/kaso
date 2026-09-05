const INDEX_HTML = __KASO_INDEX_HTML__;
const ADMIN_HTML = __KASO_ADMIN_HTML__;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function html(content, admin = false, headOnly = false, extraHeaders = {}) {
  return new Response(headOnly ? null : content, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
      ...(admin ? { "x-robots-tag": "noindex, nofollow" } : {}),
      ...extraHeaders,
    },
  });
}

function database(env) {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

async function readJson(request, maxBytes = 12000) {
  const size = Number(request.headers.get("content-length") || 0);
  if (size > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  return request.json();
}

function cleanPath(value) {
  const path = String(value || "/").trim().slice(0, 160);
  return path.startsWith("/") ? path : "/";
}

function validSessionId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(value);
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.get("cookie") || "")
      .split(/;\s*/)
      .filter(Boolean)
      .map((part) => {
        const position = part.indexOf("=");
        return position < 0 ? [part, ""] : [part.slice(0, position), part.slice(position + 1)];
      }),
  );
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function sign(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function constantTimeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function createAdminCookie(env) {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const payload = `${expiresAt}.${crypto.randomUUID()}`;
  const signature = await sign(env.ADMIN_SESSION_SECRET, payload);
  return `kaso_admin=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}

async function isAdmin(request, env) {
  if (!env.ADMIN_SESSION_SECRET) return false;
  const token = parseCookies(request).kaso_admin || "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return constantTimeEqual(parts[2], await sign(env.ADMIN_SESSION_SECRET, payload));
}

function visitorIdentity(request) {
  const stored = parseCookies(request).kaso_visitor;
  if (validSessionId(stored)) return { sessionId: stored, cookie: null };
  const sessionId = crypto.randomUUID().replaceAll("-", "");
  return {
    sessionId,
    cookie: `kaso_visitor=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
  };
}

async function recordPageView(env, sessionId, path) {
  const sessionStatement = database(env)
    .prepare(`INSERT INTO analytics_sessions (session_id, first_seen, last_seen, path)
      VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(session_id) DO UPDATE SET last_seen = CURRENT_TIMESTAMP, path = excluded.path`)
    .bind(sessionId, cleanPath(path));
  const viewStatement = database(env)
    .prepare("INSERT INTO analytics_pageviews (session_id, path, viewed_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
    .bind(sessionId, cleanPath(path));
  await database(env).batch([sessionStatement, viewStatement]);

  if (Math.random() < 0.015) {
    await database(env).batch([
      database(env).prepare("DELETE FROM analytics_sessions WHERE last_seen < datetime('now', '-1 day')"),
      database(env).prepare("DELETE FROM analytics_pageviews WHERE viewed_at < datetime('now', '-13 months')"),
    ]);
  }
}

async function submitFeedback(request, env) {
  const body = await readJson(request);
  const allowedTypes = new Set(["功能故障", "資料錯誤", "功能建議"]);
  const type = allowedTypes.has(body.type) ? body.type : "功能建議";
  const message = String(body.text || "").trim().slice(0, 2000);
  const view = String(body.view || "home").trim().slice(0, 80);
  const sessionId = validSessionId(body.sessionId) ? body.sessionId : null;
  if (message.length < 2) return json({ error: "message_required" }, 400);

  const result = await database(env)
    .prepare("INSERT INTO feedback (type, message, view, session_id, status, created_at) VALUES (?, ?, ?, ?, 'new', CURRENT_TIMESTAMP)")
    .bind(type, message, view, sessionId)
    .run();
  return json({ ok: true, id: result.meta?.last_row_id || null }, 201);
}

async function adminLogin(request, env) {
  if (!sameOrigin(request)) return json({ error: "origin_not_allowed" }, 403);
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
    return json({ error: "admin_not_configured" }, 503);
  }
  const body = await readJson(request, 2000);
  const correct = constantTimeEqual(body.username, env.ADMIN_USERNAME)
    && constantTimeEqual(body.password, env.ADMIN_PASSWORD);
  if (!correct) return json({ error: "invalid_credentials" }, 401);
  return json({ ok: true }, 200, { "set-cookie": await createAdminCookie(env) });
}

async function adminMetrics(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "unauthorized" }, 401);
  const db = database(env);
  const [online, month, unique, today, series] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS value FROM analytics_sessions WHERE last_seen >= datetime('now', '-2 minutes')").first(),
    db.prepare("SELECT COUNT(*) AS value FROM analytics_pageviews WHERE viewed_at >= datetime('now', '+8 hours', 'start of month', '-8 hours')").first(),
    db.prepare("SELECT COUNT(DISTINCT session_id) AS value FROM analytics_pageviews WHERE viewed_at >= datetime('now', '+8 hours', 'start of month', '-8 hours')").first(),
    db.prepare("SELECT COUNT(*) AS value FROM analytics_pageviews WHERE date(viewed_at, '+8 hours') = date('now', '+8 hours')").first(),
    db.prepare(`WITH RECURSIVE dates(day) AS (
      SELECT date('now', '+8 hours', '-13 days')
      UNION ALL SELECT date(day, '+1 day') FROM dates WHERE day < date('now', '+8 hours')
    )
    SELECT dates.day AS day, COUNT(analytics_pageviews.id) AS views
    FROM dates LEFT JOIN analytics_pageviews ON date(analytics_pageviews.viewed_at, '+8 hours') = dates.day
    GROUP BY dates.day ORDER BY dates.day`).all(),
  ]);
  return json({
    onlineNow: Number(online?.value || 0),
    monthlyViews: Number(month?.value || 0),
    monthlyVisitors: Number(unique?.value || 0),
    todayViews: Number(today?.value || 0),
    daily: (series.results || []).map((row) => ({ day: row.day, views: Number(row.views || 0) })),
    timezone: "Asia/Taipei",
    generatedAt: new Date().toISOString(),
  });
}

async function adminFeedback(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "unauthorized" }, 401);
  const result = await database(env)
    .prepare("SELECT id, type, message, view, status, created_at FROM feedback ORDER BY created_at DESC, id DESC LIMIT 100")
    .all();
  return json({ items: result.results || [] });
}

async function updateFeedback(request, env, id) {
  if (!(await isAdmin(request, env))) return json({ error: "unauthorized" }, 401);
  if (!sameOrigin(request)) return json({ error: "origin_not_allowed" }, 403);
  const body = await readJson(request, 2000);
  const allowed = new Set(["new", "processing", "done"]);
  if (!allowed.has(body.status)) return json({ error: "invalid_status" }, 400);
  const result = await database(env)
    .prepare("UPDATE feedback SET status = ? WHERE id = ?")
    .bind(body.status, id)
    .run();
  return json({ ok: true, changed: result.meta?.changes || 0 });
}

async function handleApi(request, env, ctx, pathname) {
  try {
    if (pathname === "/api/health" && request.method === "GET") return json({ ok: true, database: Boolean(env.DB) });
    if (pathname === "/api/feedback" && request.method === "POST") return submitFeedback(request, env);
    if (pathname === "/api/admin/login" && request.method === "POST") return adminLogin(request, env);
    if (pathname === "/api/admin/session" && request.method === "GET") return json({ authenticated: await isAdmin(request, env) });
    if (pathname === "/api/admin/logout" && request.method === "POST") {
      if (!sameOrigin(request)) return json({ error: "origin_not_allowed" }, 403);
      return json({ ok: true }, 200, { "set-cookie": "kaso_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
    }
    if (pathname === "/api/admin/metrics" && request.method === "GET") return adminMetrics(request, env);
    if (pathname === "/api/admin/feedback" && request.method === "GET") return adminFeedback(request, env);
    const feedbackMatch = pathname.match(/^\/api\/admin\/feedback\/(\d+)$/);
    if (feedbackMatch && request.method === "PATCH") return updateFeedback(request, env, Number(feedbackMatch[1]));
    return json({ error: "not_found" }, 404);
  } catch (error) {
    console.error("KASO API error", error);
    if (error?.message === "PAYLOAD_TOO_LARGE") return json({ error: "payload_too_large" }, 413);
    if (error instanceof SyntaxError) return json({ error: "invalid_json" }, 400);
    return json({ error: "service_unavailable" }, 503);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    if (pathname.startsWith("/api/")) return handleApi(request, env, ctx, pathname);

    if ((request.method === "GET" || request.method === "HEAD") && (pathname === "/" || pathname === "/index.html")) {
      if (request.method === "HEAD" || !env.DB) return html(INDEX_HTML, false, request.method === "HEAD");
      const visitor = visitorIdentity(request);
      ctx.waitUntil(recordPageView(env, visitor.sessionId, pathname).catch((error) => console.error("KASO analytics error", error)));
      return html(INDEX_HTML, false, false, visitor.cookie ? { "set-cookie": visitor.cookie } : {});
    }
    if ((request.method === "GET" || request.method === "HEAD") && (pathname === "/admin" || pathname === "/admin.html")) {
      return html(ADMIN_HTML, true, request.method === "HEAD");
    }
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  },
};
