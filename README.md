# L'Agente Studio

Two static pages plus the form that receives fitting requests.

    public/       what the visitor sees (index.html, start.html)
    functions/    Cloudflare Pages Functions
      api/fitting.js  POST from the form, writes one row to D1
      leads.js        /leads?key=... reads them back, plus CSV
    schema.sql    the D1 table, run once in the database console

## Cloudflare Pages settings

- Build command: *(empty)*
- **Build output directory: `public`** — required. With the output set to the
  repository root, Pages serves `functions/` as static files instead of
  compiling it, and every endpoint answers 404.
- Bindings: D1 database bound as `DB`
- Variables: `FORM_SECRET`, the secret in the `/leads` URL
