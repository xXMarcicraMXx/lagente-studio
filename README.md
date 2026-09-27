# L'Agente Studio

One Cloudflare Worker: two static pages, the form that receives fitting requests,
and what happens right after a request lands.

    public/
      index.html                  the atelier
      start.html                  the form
    src/index.js                  the Worker
      POST /api/fitting           validates, writes one row to D1, then — off the request path —
                                  emails the prospect and sends Marcello a Telegram note
      GET  /leads?key=…           the bench: every request, plus CSV
      GET  /api/health            {ok, build}
    schema.sql                    the D1 table, fresh install
    migrations/                   changes to an existing table, run once each
    wrangler.jsonc                bindings (ASSETS, DB)
    .dev.vars.example             local secrets template

## What happens when someone books a fitting

1. The row is written. Required: name, company, email. Optional: role, site, the job.
2. The prospect gets an automatic email within a minute — it says it is automatic,
   promises a human reply within two working days, and asks three questions.
   Italian if the request comes from Italy, English otherwise.
3. Marcello gets a Telegram message with who, where, and the job.

If the email or the note fails, the prospect still sees "It is with us": the
failure is logged, never shown. Neither step is on the request path.

## Secrets

Set with `npx wrangler secret put NAME` (production) or in `.dev.vars` (local).

| Name | Used for | If missing |
|---|---|---|
| `FORM_SECRET` | the key in the `/leads` URL | `/leads` answers 404 |
| `RESEND_API_KEY` | the automatic email, via Resend | email is printed to the log, not sent |
| `TELEGRAM_BOT_TOKEN` | the note to Marcello | note is printed to the log, not sent |
| `TELEGRAM_CHAT_ID` | which chat receives it | same |

## Before the email can go out: DNS

`lagente.ai` mail lives on Google Workspace with DMARC `p=reject`. An email
sent from `studio@lagente.ai` without an aligned DKIM signature is **rejected**,
not filtered. So, once, in Resend:

1. Add the domain `lagente.ai` and pick the region.
2. Add the DKIM record Resend shows (a `TXT` on `resend._domainkey.lagente.ai` or similar)
   and the return-path `MX`/`TXT` it asks for.
3. Add `include:amazonses.com` (or whatever Resend states) to the existing SPF —
   the current record is `v=spf1 include:_spf.google.com -all`; it becomes
   `v=spf1 include:_spf.google.com include:<resend-include> -all`. One SPF record only.
4. Wait for "Verified", then `wrangler secret put RESEND_API_KEY`.

The `Reply-To` is `studio@lagente.ai`. That mailbox has to exist on Workspace
and someone has to read it — the pages already promise it.

## Local

    cp .dev.vars.example .dev.vars
    npx wrangler d1 execute lagente-leads --local --file=schema.sql
    npx wrangler dev

Then open http://localhost:8787/start.html, submit, and watch the terminal:
with no keys in `.dev.vars` both the email and the note are printed there.
The bench is at http://localhost:8787/leads?key=local-bench.

## Deploy

    npx wrangler d1 execute lagente-leads --remote --file=migrations/0001-optional-fields.sql   # once
    npx wrangler deploy

Bump `BUILD` in `src/index.js` to the short SHA you are deploying, so
`/api/health` tells the truth.

## Not in this repo, still needed

- A privacy notice linked from the form. "It trains nothing" is a promise, not a notice.
- Confirmation that `studio@lagente.ai` exists and is read.
