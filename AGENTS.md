# Nexus — Agent Workflow Rules

## Feature branching (required)
- Every new actual feature is developed on its own branch, never directly on `main`.
- Branch naming: `feat/<short-name>` (e.g. `feat/ocr-fill-scan`).
- Create the branch from `main`, do all work there, and commit on the branch.
- Build/lint must pass before asking to merge:
  - Build: `npm run build`
  - Lint: `npm run lint` (existing 14 warnings are pre-existing and acceptable)

## Merge approval (required)
- When feature work on a branch is complete, always ask the user for permission to merge — do NOT merge or push to `main` without explicit approval.
- Ask via the question/choice window (not plain text), e.g. "Merge feat/<name> into main and push?" with merge / keep-on-branch options.
- Only after approval: merge into `main` and push.

## Conventions / notes
- `.env` contains real Supabase credentials and is gitignored — never commit it or add a service_role key.
- RLS and seed data live in `supabase/*.sql`; user runs them in the Supabase SQL editor (client anon key has no write policies).
- The user cannot view attached images in this model context — rely on textual descriptions for UI work.
- Headless login-gate test: `node 'C:\Users\ashut\AppData\Local\Temp\opencode\auth-officers-fir-test.js'`.