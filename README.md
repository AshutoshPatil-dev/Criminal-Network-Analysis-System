# Criminal-Network-Analysis-System

> NEXUS — Police Intelligence Workspace

A restricted law-enforcement intelligence dashboard demo: link analysis, entity
profiles, pattern anomaly radar, FIR / case reporting with OCR intake, officer
management, and an immutable audit trail. English and Hindi UI.

Built to demonstrate a realistic investigative workflow — query a person or
asset, map associations in an interactive graph, file intelligence reports,
auto-fill a printable FIR from a scanned document, attach evidence (CDR /
transaction records) with checksums, and have every action land in an audit log.

## Features

- **Dashboard & search** — global search across persons, phones, vehicles, locations and organisations.
- **Network graph** — interactive Cytoscape graph of entities and associations with time/colour filtering.
- **Entity profiles** — attributes, movements, owned assets, known associates, risk score.
- **Pattern radar** — anomaly and pattern cards with severity, linked back to subjects.
- **Report builder** — structured intelligence reports (identity + evidence details, file uploads) with instant findings toast and AI link analysis.
- **FIR report builder** —
  - image/photo upload of a real FIR that **auto-fills the form (OCR)** — lazily loads Tesseract.js in the browser — a **Handwriting scan** option adds upscaling + contrast/sharpen preprocessing and fuzzy label matching so messy or handwritten FIRs still resolve fields — then **you verify** each field (OCR-tagged `⟵ OCR`, per-field confidence).
  - printable FIR document (Print/PDF with print stylesheet) and **Export Word** (`.doc`).
  - evidence attachments (CDR, transaction records, other files) with per-file checksums.
- **Officer profiles** — admins add officers (email, name, rank, badge, district, state, phone, role) with an **initial password**; each officer is a Supabase Auth user backed by a `profiles` row. You cannot delete your own account.
- **Auth** — Supabase Auth sign-in only (no self-registration). Officer accounts are provisioned by an admin; no credentials means no sign-in.
- **Audit trail** — immutable-ish log of every action with timestamps, actor, filter by level.
- **i18n** — English / हिन्दी toggle.

## Tech

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vite.dev)
- [Tailwind CSS 4](https://tailwindcss.com) (Vite plugin)
- [Cytoscape.js](https://cytoscape.org) for the network graph
- [Supabase](https://supabase.com) (Auth, Postgres, Storage) — optional
- [Oxlint](https://oxc.rs/docs/guide/usage/linter/rules) for linting

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

A Supabase project is **required**: create `.env` with your URL + anon key
before anything works (no offline mode).

## Supabase setup (optional, for persistence)

1. Create a free project at <https://supabase.com/dashboard>.
2. **Project Settings → API** and copy the URL + anon key.
3. Open **SQL Editor** → paste `supabase/schema.sql` → **Run**. This creates the
   `profiles` (officer roster, keyed to `auth.users`), case/report/FIR tables and
   the `case-files` storage bucket. `profiles` is protected by RLS: only an admin
   (`public.is_admin()`) may create/update/delete rows; users read their own row.
4. Create `.env` in the project root with the two values:

   ```env
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   ```

5. Restart `npm run dev`. **Bootstrap the first admin** (there is no
   self-registration): Auth → Users → Add user for yourself, then run the SQL
   snippet at the bottom of `schema.sql` to insert your `profiles` row with
   `role = 'admin'`.
6. As admin, use **Officers → Add Officer** to create each officer's account
   (email + initial password) — signUp creates the Auth user and `profiles` row
   in one step. New users are listed under Auth → Users (confirm them if email
   confirmation is enabled).
7. Never commit the real `.env` — it is gitignored.

## Deploy to Cloudflare Pages

The app is a static Vite SPA, so Cloudflare Pages is a natural fit (free tier, global CDN, HTTPS).

**Via the dashboard (recommended):**
1. Push this repo to GitHub, then in Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** and pick the repo.
2. Framework preset: **Vite**. Build command `npm run build`, build output directory `dist`.
3. **Settings → Environment variables** — add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Production). They are inlined at build time, so save and re-deploy.
4. The `public/_redirects` file (`/* /index.html 200`) gives you SPA fallback for any path.

**Via Wrangler CLI:**
```bash
npm install -g wrangler           # or: npx wrangler@latest login
npx wrangler login
npm run deploy:pages              # builds dist + deploys to the Pages project
```
First deploy asks you to authorize and creates/links the project. `wrangler.toml` is not required for Pages — the project name lives in the `deploy:pages` script.

## Scripts

| Command            | Description                  |
| ------------------ | ---------------------------- |
| `npm run dev`      | Start Vite dev server        |
| `npm run build`    | Type-check + production build |
| `npm run lint`     | Run Oxlint                   |
| `npm run preview`  | Preview the production build |
| `npm run deploy:pages` | Build and deploy to Cloudflare Pages (wrangler) |

## Project structure

```
nexus/
├─ public/               # static assets + _redirects (Cloudflare SPA fallback)
├─ src/
│  ├─ components/        # screens & UI (Dashboard, NetworkGraph, ReportEntry,
│  │                     #  FirReport, Officers, Login, AuditLogs, …)
│  ├─ lib/               # supabase client, aiAnalyzer, firExtractor (OCR), graph
│  ├─ store.tsx          # app state, auth session, officers/FIR CRUD, routing
│  ├─ i18n.ts            # English / Hindi strings
│  └─ types.ts           # shared types
└─ supabase/
   ├─ schema.sql         # fresh-project schema (tables + RLS + storage bucket)
   ├─ seed_data.sql      # demo case graph (entities, relationships, FIRs)
   ├─ harden_rls.sql     # production-grade RLS: authenticated-only, owner/admin-scoped
   └─ migration_profiles.sql  # run on an existing DB to switch officers → profiles
```

## Security notes

- This is a **demonstration** tool, not production police software. The case
  graph is fictional and loaded from `supabase/seed_data.sql`; reports, FIR
  documents and audit entries are written to the database at runtime.
- The officer roster (`profiles`) is the only truly locked-down table in the base
  schema: RLS + `public.is_admin()` limit creates/updates/deletes to the signed-in
  admin, with users able to read their own row. Auth-account creation uses client
  `signUp` (safe without a service-role key); deleting a profile does **not**
  delete the Auth user — remove it manually in Auth → Users.
- **Run `supabase/harden_rls.sql` for the hardened posture** (recommended even for
  demos). It revokes the permissive anon policies so every case table, report,
  audit log, FIR document and storage object is `authenticated`-role only;
  reports/FIR documents are editable/deletable by their author or an admin, and
  storage objects by their owner. The app re-fetches case data after sign-in, so
  no code change is needed. Without hardening, the demo schema keeps anon
  read/write for the case tables.
- No offline/demo mode exists: without a configured Supabase project the app only
  shows the sign-in gate; with hardening, signing out also blanks case data.
- Operations posture: the frontend ships only the (public) anon key; the
  service_role key and database password must never be placed in the client or
  the repo — `.env` is gitignored and contains placeholders. `npm audit` reports
  zero known vulnerabilities; dynamic HTML is never injected (no
  `dangerouslySetInnerHTML`/`eval` — React escapes all user text).
- Enable **"Confirm email"** in Supabase Auth settings for real deployments and
  set a sensible JWT expiry; SSRF/over-quota concerns apply to any demo hosting.
- OCR on uploaded FIR images runs client-side; attach-only evidence is checksummed
  (SHA-256) but not cryptographically bound. The Tesseract.js CDN dependency is
  version-pinned with SRI.