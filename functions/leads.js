// The bench: every fitting request, newest first.
// Reachable only with the key set in the LEADS_KEY variable of the Pages project:
//   https://lagente.ai/leads?key=...        the table
//   https://lagente.ai/leads?key=...&csv=1  the same rows as CSV

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

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  if (!env.LEADS_KEY || key !== env.LEADS_KEY) {
    return new Response("Not found", { status: 404 });
  }
  if (!env.DB) {
    return new Response("No database binding on this project.", { status: 500 });
  }

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
:root{color-scheme:light dark}
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
@media(prefers-color-scheme:dark){body{background:#0e0e10;color:#f0efec}th,td{border-color:#26262b}
td.when,.dim,p.count,th{color:#9a9aa0}}
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
