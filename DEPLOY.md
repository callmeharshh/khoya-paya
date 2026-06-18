# Deploy Khoya·Paya to Render (always-on link for testing)

Render runs the app as one persistent Node process, so the in-memory store
works exactly like local — the full flow (file → match → coordinate → verify)
survives across clicks. The repo is already committed locally with a
`render.yaml` blueprint.

## Part A — Push to GitHub

1. Create a new **empty** repo at <https://github.com/new> — name it `khoya-paya`,
   public or private, and **do not** add a README/.gitignore/license (the repo
   already has them).
2. From the project folder, connect and push:
   ```bash
   git remote add origin https://github.com/<your-username>/khoya-paya.git
   git push -u origin main
   ```
3. If it asks for a password: GitHub no longer accepts your account password over
   HTTPS. Create a **Personal Access Token** (GitHub → Settings → Developer
   settings → Personal access tokens → Tokens (classic) → Generate, scope `repo`)
   and paste that token as the password.

## Part B — Deploy on Render

1. Go to <https://render.com> and **Sign in with GitHub** (easiest — it also
   grants Render access to your repo).
2. Dashboard → **New +** → **Blueprint**.
3. Select your `khoya-paya` repo. Render reads `render.yaml` automatically.
4. It will prompt for the one secret env var, **`GEMINI_API_KEY`** → paste your
   Gemini key. (`LLM_PROVIDER`, `GEMINI_MODEL`, `NODE_VERSION` come from
   `render.yaml` automatically.)
5. Click **Apply / Create**. The build runs (~3–5 min).
6. When it's live you get a URL like `https://khoya-paya.onrender.com`. Share it.

## What your friend should know (free tier)

- **Cold start:** a free service sleeps after ~15 min idle. The first visit after
  sleeping takes ~30–60s to wake up — tell them to be patient on first load.
- **State resets on sleep:** the 4 seeded demo cases always reload, but reports
  *they* file are lost once the service sleeps. Fine for a test.
- **Badge says "⚠ Gemini (dev)"** — expected; this test runs on Gemini. For the
  actual event, switch to Claude (set `ANTHROPIC_API_KEY`, remove `LLM_PROVIDER`).
- A click may occasionally take a couple extra seconds (Gemini 503 → auto-retry).

## Updating later

Any `git push` to `main` triggers an automatic redeploy on Render.

## Notes

- Keep the service on a **single instance** (free tier is). The in-memory store
  isn't shared across multiple instances — if you ever scale out, move to a
  database (Upstash Redis / Postgres) behind the same `lib/store.ts` interface.
- **Regenerate your Gemini key** before using it here if it was ever shared, and
  put the fresh key in Render's dashboard.
