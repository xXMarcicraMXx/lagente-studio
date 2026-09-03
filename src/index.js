// L'Agente Studio.
// Static pages come from public/ through the ASSETS binding. Two routes are
// handled here: the fitting form writes to D1, and /leads reads it back.

const BUILD = "f1b3446";

const FIELDS = ["name", "company", "role", "email", "job"];
const LIMITS = { name: 120, company: 160, role: 120, email: 254, job: 4000 };

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function escape(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(value) {
  return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json" },
  });
}

function page(title, message, status) {
  const html = `<!doctype html><meta charset="utf-8"><title>${escape(title)}</title>
<style>body{font:16px/1.6 system-ui;margin:0;display:grid;place-items:center;min-height:100vh;
background:#f7f7f5;color:#101114}div{max-width:34rem;padding:2rem;text-align:center}a{color:inherit}
@media(prefers-color-scheme:dark){body{background:#0e0e10;color:#f0efec}}</style>
<div><h1 style="font-weight:400">${escape(title)}</h1><p>${escape(message)}</p>
<p><a href="/">Back to the atelier</a></p></div>`;
  return new Response(html, {
    status: status || 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return await request.json();
  const form = await request.formData();
  const out = {};
  for (const [key, value] of form.entries()) out[key] = value;
  return out;
}

async function receiveFitting(request, env) {
  const wantsJson = (request.headers.get("content-type") || "").includes("application/json");
  const ok = () =>
    wantsJson
      ? json({ ok: true })
      : page("It is with us.", "You will hear back within two working days, from a person.");
  const fail = (status, why) =>
    wantsJson
      ? json({ ok: false, error: why }, status)
      : page("That did not send.", "Write to studio@lagente.ai and we will pick it up from there.", status);

  let body;
  try {
    body = await readBody(request);
  } catch {
    return fail(400, "unreadable body");
  }

  // Honeypot: a field no person can see. Filled means a bot, so accept and drop.
  if (clean(body.website, 200)) return ok();

  const row = {};
  for (const field of FIELDS) row[field] = clean(body[field], LIMITS[field]);
  if (!row.name || !row.company || !row.role || !row.job) return fail(422, "missing fields");
  if (!isEmail(row.email)) return fail(422, "bad email");

  if (!env.DB) return fail(500, "no database binding");

  try {
    await env.DB.prepare(
      `INSERT INTO fittings (created_at, name, company, role, email, job, country, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        new Date().toISOString(),
        row.name,
        row.company,
        row.role,
        row.email,
        row.job,
        request.headers.get("cf-ipcountry") || "",
        request.headers.get("cf-connecting-ip") || "",
        (request.headers.get("user-agent") || "").slice(0, 300)
      )
      .run();
  } catch {
    return fail(500, "write failed");
  }

  return ok();
}

async function showLeads(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  // Without the right key the page does not exist. It does not announce itself.
  if (!env.FORM_SECRET || key !== env.FORM_SECRET) return new Response("Not found", { status: 404 });
  if (!env.DB) return new Response("No database binding on this project.", { status: 500 });

  const { results } = await env.DB.prepare(
    `SELECT id, created_at, name, company, role, email, job, country
       FROM fittings ORDER BY id DESC LIMIT 500`
  ).all();
  const rows = results || [];

  if (url.searchParams.get("csv")) {
    const head = "id,created_at,name,company,role,email,job,country\n";
    const body = rows
      .map((r) => [r.id, r.created_at, r.name, r.company, r.role, r.email, r.job, r.country].map(csvCell).join(","))
      .join("\n");
    return new Response(head + body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="fittings.csv"',
      },
    });
  }

  const table = rows
    .map(
      (r) => `<tr>
<td class="when">${escape(r.created_at).replace("T", " ").slice(0, 16)}</td>
<td><strong>${escape(r.name)}</strong><br><span class="dim">${escape(r.role)}</span></td>
<td>${escape(r.company)}<br><a href="mailto:${escape(r.email)}">${escape(r.email)}</a></td>
<td class="job">${escape(r.job)}</td>
<td class="dim">${escape(r.country)}</td>
</tr>`
    )
    .join("");

  const html = `<!doctype html><meta charset="utf-8"><title>The bench</title>
<meta name="robots" content="noindex">
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:2rem 1.25rem;background:#f7f7f5;color:#101114}
h1{font-weight:400;font-size:1.5rem;margin:0 0 .25rem}
p.count{color:#6b6b71;margin:0 0 1.5rem}
table{border-collapse:collapse;width:100%;max-width:78rem}
th,td{text-align:left;vertical-align:top;padding:.85rem .75rem;border-bottom:1px solid #dcdbd6}
th{font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;color:#6b6b71;font-weight:600}
td.when{white-space:nowrap;color:#6b6b71;font-variant-numeric:tabular-nums}
td.job{max-width:34rem;white-space:pre-wrap}
.dim{color:#6b6b71}
a.csv{display:inline-block;margin-bottom:1.5rem;color:inherit}
@media(prefers-color-scheme:dark){body{background:#0e0e10;color:#f0efec}
th,td{border-color:#26262b}td.when,.dim,p.count,th{color:#9a9aa0}}
</style>
<h1>The bench</h1>
<p class="count">${rows.length} fitting request${rows.length === 1 ? "" : "s"}.</p>
<a class="csv" href="?key=${encodeURIComponent(key)}&csv=1">Download CSV</a>
<table><thead><tr><th>When</th><th>Who</th><th>Where</th><th>The job</th><th>Country</th></tr></thead>
<tbody>${table || '<tr><td colspan="5" class="dim">Nothing yet.</td></tr>'}</tbody></table>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // A marker to tell which build is live. It says nothing about the data
    // and nothing about whether the secret is set.
    if (url.pathname === "/api/health") {
      return json({ ok: true, build: BUILD });
    }

    if (url.pathname === "/api/fitting") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      return receiveFitting(request, env);
    }

    if (url.pathname === "/leads") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return showLeads(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
