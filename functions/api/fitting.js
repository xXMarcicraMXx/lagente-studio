// Receives the "Book a fitting" form and writes one row to D1.
// Bindings expected on the Pages project: DB (D1 database).

const FIELDS = ["name", "company", "role", "email", "job"];
const LIMITS = { name: 120, company: 160, role: 120, email: 254, job: 4000 };

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return await request.json();
  const form = await request.formData();
  const out = {};
  for (const [key, value] of form.entries()) out[key] = value;
  return out;
}

function page(title, message) {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>body{font:16px/1.6 system-ui;margin:0;display:grid;place-items:center;min-height:100vh;
background:#f7f7f5;color:#101114}div{max-width:34rem;padding:2rem;text-align:center}
a{color:inherit}</style>
<div><h1 style="font-weight:400">${title}</h1><p>${message}</p>
<p><a href="/">Back to the atelier</a></p></div>`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const wantsJson = (request.headers.get("content-type") || "").includes("application/json");

  const fail = (status, why) =>
    wantsJson
      ? new Response(JSON.stringify({ ok: false, error: why }), {
          status,
          headers: { "content-type": "application/json" },
        })
      : new Response(page("That did not send.", "Write to studio@lagente.ai and we will pick it up from there."), {
          status,
          headers: { "content-type": "text/html; charset=utf-8" },
        });

  let body;
  try {
    body = await readBody(request);
  } catch {
    return fail(400, "unreadable body");
  }

  // Honeypot: a field no person can see. Filled means a bot, so accept and drop.
  if (clean(body.website, 200)) {
    return wantsJson
      ? new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } })
      : new Response(page("It is with us.", "You will hear back within two working days."), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
  }

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
  } catch (error) {
    return fail(500, "write failed");
  }

  return wantsJson
    ? new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } })
    : new Response(page("It is with us.", "You will hear back within two working days, from a person."), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
}

export async function onRequestGet() {
  return new Response("Method not allowed", { status: 405 });
}
