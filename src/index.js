// L'Agente Studio.
// Static pages come from public/ through the ASSETS binding. Two routes are
// handled here: the fitting form writes to D1, and /leads reads it back.
// After a write, two things happen off the request path: Marcello gets a
// Telegram note, and the prospect gets an automatic email with three questions.

const BUILD = "f1b3446";

const FIELDS = ["name", "company", "role", "email", "job", "site"];
const LIMITS = { name: 120, company: 160, role: 120, email: 254, job: 4000, site: 300 };
const REQUIRED = ["name", "company"];

const FROM = "Marcello · L'Agente Studio <studio@lagente.ai>";
const REPLY_TO = "studio@lagente.ai";

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

// ---------------------------------------------------------------------------
// The automatic email. It says it is automatic; the reply will not be.
// Italian when the request comes from Italy (or the form says so), English otherwise.

function firstName(name) {
  return (name || "").split(/\s+/)[0] || "";
}

function emailCopy(row, lang) {
  const who = firstName(row.name);
  if (lang === "it") {
    return {
      subject: "Ricevuto — tre domande veloci prima di risponderti",
      text: `Ciao ${who},

il tuo messaggio è appena arrivato. Questa email è automatica; la risposta no. Le leggo tutte io e rispondo entro due giorni lavorativi.

Perché la risposta sia utile e non generica, tre cose veloci, anche a spanne:

1. Cosa fa ${row.company}, e chi sono i vostri clienti?
2. Qual è il lavoro che si mangia più ore ogni settimana, e da dove vi arriva di solito?
3. Dove vive quel lavoro oggi: Google Workspace, Microsoft 365, altro?

Basta rispondere qui. Resta tra noi e non addestra niente.

Marcello
L'Agente Studio · The AI Atelier

—
MITICLA S.R.L.S. · Via Perarello 25, 35010 Vigodarzere (PD), Italia
Ricevi questa email perché ci hai scritto da lagente.ai. Rispondi "stop" e non scriveremo più.`,
    };
  }
  return {
    subject: "Got it — three quick questions before I write back",
    text: `Hi ${who},

Your note just came in. This message is automatic; the reply won't be. I read every one of these myself and write back within two working days.

So that my reply is useful rather than generic, three quick things — rough answers are fine:

1. What does ${row.company} do, and who are your clients?
2. What's the one job that eats the most hours each week, and how does that work usually reach you?
3. Where does that work live today: Google Workspace, Microsoft 365, something else?

Just hit reply. It stays between us and trains nothing.

Marcello
L'Agente Studio · The AI Atelier

—
MITICLA S.R.L.S. · Via Perarello 25, 35010 Vigodarzere (PD), Italy
You're receiving this because you wrote to us at lagente.ai. Reply "stop" and we won't write again.`,
  };
}

function textToHtml(text) {
  const paragraphs = escape(text).split(/\n\n+/);
  return `<!doctype html><meta charset="utf-8"><div style="font:16px/1.65 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#101114;max-width:38rem">${paragraphs
    .map((p) => `<p style="margin:0 0 1em">${p.replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`;
}

async function sendEmail(env, row, lang) {
  const copy = emailCopy(row, lang);
  if (!env.RESEND_API_KEY) {
    // Local or not yet configured: show what would have gone out, send nothing.
    console.log(`[email:dry-run] to=${row.email} lang=${lang}\nSubject: ${copy.subject}\n\n${copy.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [row.email],
      reply_to: REPLY_TO,
      subject: copy.subject,
      text: copy.text,
      html: textToHtml(copy.text),
    }),
  });
  if (!res.ok) console.error(`[email] resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// ---------------------------------------------------------------------------
// The Telegram note to Marcello. Plain text, no secrets, no link with the key in it.

async function notifyTelegram(env, row, country) {
  const lines = [
    `Nuova richiesta di fitting`,
    `${row.name}${row.role ? " · " + row.role : ""}`,
    `${row.company}${row.site ? " · " + row.site : ""}`,
    row.email,
    country ? `Paese: ${country}` : null,
    row.job ? `\n${row.job.slice(0, 400)}${row.job.length > 400 ? "…" : ""}` : "\n(nessuna descrizione del lavoro)",
    `\n→ lagente.ai/leads`,
  ].filter(Boolean);
  const text = lines.join("\n");

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.log(`[telegram:dry-run]\n${text}`);
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
  });
  if (!res.ok) console.error(`[telegram] ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// ---------------------------------------------------------------------------

async function receiveFitting(request, env, ctx) {
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
  for (const field of REQUIRED) if (!row[field]) return fail(422, "missing fields");
  if (!isEmail(row.email)) return fail(422, "bad email");

  if (!env.DB) return fail(500, "no database binding");

  const country = request.headers.get("cf-ipcountry") || "";

  try {
    await env.DB.prepare(
      `INSERT INTO fittings (created_at, name, company, role, email, job, site, country, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        new Date().toISOString(),
        row.name,
        row.company,
        row.role || null,
        row.email,
        row.job || null,
        row.site || null,
        country,
        request.headers.get("cf-connecting-ip") || "",
        (request.headers.get("user-agent") || "").slice(0, 300)
      )
      .run();
  } catch {
    return fail(500, "write failed");
  }

  // Everything after the write happens off the request: the prospect gets
  // "It is with us" at once, whatever happens to the email or the note.
  const lang = clean(body.lang, 5) === "it" || country === "IT" ? "it" : "en";
  const after = Promise.allSettled([sendEmail(env, row, lang), notifyTelegram(env, row, country)]);
  if (ctx && ctx.waitUntil) ctx.waitUntil(after);
  else await after;

  return ok();
}

async function showLeads(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  // Without the right key the page does not exist. It does not announce itself.
  if (!env.FORM_SECRET || key !== env.FORM_SECRET) return new Response("Not found", { status: 404 });
  if (!env.DB) return new Response("No database binding on this project.", { status: 500 });

  const { results } = await env.DB.prepare(
    `SELECT id, created_at, name, company, role, email, job, site, country
       FROM fittings ORDER BY id DESC LIMIT 500`
  ).all();
  const rows = results || [];

  if (url.searchParams.get("csv")) {
    const head = "id,created_at,name,company,role,email,job,site,country\n";
    const body = rows
      .map((r) => [r.id, r.created_at, r.name, r.company, r.role, r.email, r.job, r.site, r.country].map(csvCell).join(","))
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
<td><strong>${escape(r.name)}</strong><br><span class="dim">${escape(r.role || "—")}</span></td>
<td>${escape(r.company)}<br><a href="mailto:${escape(r.email)}">${escape(r.email)}</a>${
        r.site ? `<br><span class="dim">${escape(r.site)}</span>` : ""
      }</td>
<td class="job">${r.job ? escape(r.job) : '<span class="dim">—</span>'}</td>
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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // A marker to tell which build is live. It says nothing about the data
    // and nothing about whether the secrets are set.
    if (url.pathname === "/api/health") {
      return json({ ok: true, build: BUILD });
    }

    if (url.pathname === "/api/fitting") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      return receiveFitting(request, env, ctx);
    }

    if (url.pathname === "/leads") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return showLeads(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
