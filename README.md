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
  - image/photo upload of a real FIR that **auto-fills the form (OCR)** — offline demo uses a bundled sample FIR; when online it lazily loads Tesseract.js — then **you verify** each field (OCR-tagged `⟵ OCR`, per-field confidence).
  - printable FIR document (Print/PDF with print stylesheet) and **Export Word** (`.doc`).
  - evidence attachments (CDR, transaction records, other files) with per-file checksums.
- **Officer profiles** — add/edit/delete officers with badge, rank, district, contact and role; you cannot delete your own account.
- **Auth** — Supabase Auth sign-in / registration; quick demo access for seeded officers. Without credentials the app runs in **offline demo mode** (any password for a seeded officer email).
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

No configuration is required: without a `.env` the app runs entirely offline
(demo data, mock OCR, no Supabase persistence). Click any **Quick demo access**
officer (e.g. *Inspector R. Sharma*) to sign in, or use a seeded officer email
listed in `src/data/mockData.ts` with any password.

## Supabase setup (optional, for persistence)

1. Create a free project at <https://supabase.com/dashboard>.
2. **Project Settings → API** and copy the URL + anon key.
3. Open **SQL Editor** → paste `supabase/schema.sql` → **Run**. This creates the `officers` and `fir_documents` tables and the `case-files` storage bucket, with Row Level Security policies.
4. Create `.env` in the project root with the two values:

   ```env
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   ```

5. Restart `npm run dev`. New officers registered from the Login screen become
   Supabase Auth users (enable/confirm accounts in the Supabase Auth dashboard).
   Never commit the real `.env` — it is gitignored.

## Scripts

| Command            | Description                  |
| ------------------ | ---------------------------- |
| `npm run dev`      | Start Vite dev server        |
| `npm run build`    | Type-check + production build |
| `npm run lint`     | Run Oxlint                   |
| `npm run preview`  | Preview the production build |

## Project structure

```
nexus/
├─ public/               # static assets
├─ src/
│  ├─ components/        # screens & UI (Dashboard, NetworkGraph, ReportEntry,
│  │                     #  FirReport, Officers, Login, AuditLogs, …)
│  ├─ lib/               # supabase client, aiAnalyzer, firExtractor (OCR)
│  ├─ data/mockData.ts   # demo entities, audit seeds, officer seeds
│  ├─ store.tsx          # app state, auth session, officers/FIR CRUD, routing
│  ├─ i18n.ts            # English / Hindi strings
│  └─ types.ts           # shared types
└─ supabase/
   └─ schema.sql         # tables + RLS policies + storage bucket
```

## Security notes

- This is a **demonstration** tool, not production police software. Data shown
  is fictional and seeded locally.
- Persistence is guarded by Supabase Row Level Security; the anon key is only a
  public client key and should never be used as an authority.
- OCR on uploaded FIR images runs client-side; attach-only evidence is checksummed
  but not cryptographically bound.