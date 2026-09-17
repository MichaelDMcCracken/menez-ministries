# Sermon Site Setup Guide

This project now uses the repository's checked-in JSON data file as the source
of truth instead of Supabase.

---

## Overview

| Component        | Location       | Purpose                                |
|-----------------|----------------|----------------------------------------|
| Public website  | GitHub Pages   | Sermon library visible to all          |
| Admin dashboard | Browser + API backend | Add or edit sermon metadata      |
| Data store      | `sermons-data.json` | Source of truth for generated pages |

---

## Step 1 — Install Dependencies

From the repository root:

```bash
npm install
```

---

## Step 2 — Choose an Admin Workflow

For local use, run:

```bash
npm run admin
```

Then open the local URL shown in the terminal, such as
<http://localhost:3000/admin>.

For hosted remote use, deploy the admin dashboard to Vercel. The simplest
option is to keep `admin/` as the Vercel project root so `admin/index.html` and
`admin/api/*` are deployed together.

Set these server-side environment variables in Vercel:

- `GITHUB_TOKEN` — GitHub App installation token or fine-grained token with
  repository contents write access
- `GITHUB_OWNER` — optional; defaults to `MichaelDMcCracken`
- `GITHUB_REPO` — optional; defaults to `menez-ministries`
- `GITHUB_BRANCH` — optional; defaults to the repo default branch

The hosted admin page reads and writes `sermons-data.json` through the GitHub
API, regenerates the static pages server-side, and commits the results back to
the repository. The pastor only needs the deployed dashboard URL in a browser,
not a GitHub account, Git, Node, or CLI tools.

---

## Step 3 — Save Sermon Changes

In the admin UI:

1. Choose an existing book slug or add a new one.
2. Enter the sermon title, passage, date, and audio URL.
3. Click **Save sermon**.

On the hosted admin deployment, saving also regenerates the static pages and
commits the updated files back to GitHub through the server-side API.

---

## Step 4 — Regenerate the Static Site

After editing the data locally, rebuild the generated pages:

```bash
npm run build
```

This updates `library.html` and the generated `sermons/*.html` pages from the
current `sermons-data.json`.

---

## Step 5 — Commit and Push

After reviewing the generated changes:

```bash
git add sermons-data.json library.html sermons
git commit -m "Update sermons"
git push
```

If you are using the hosted admin deployment, the **Build & Push** button uses
the GitHub API and server-side credentials instead of a writable checkout, and
plain **Save sermon** already publishes the updated JSON plus regenerated pages.

---

## How the System Works

1. `sermons-data.json` stores sermon metadata.
2. The local admin server writes updates directly to local files.
3. The hosted admin API reads and writes the same JSON file through GitHub.
4. `build.js` regenerates the public sermon pages from the JSON data.
5. GitHub Pages serves the committed static files.

---

## Files Involved

| File | Description |
|------|-------------|
| `admin.html` | Browser-based admin interface for local use |
| `admin/index.html` | Hosted admin dashboard entrypoint |
| `admin/api/*` | Hosted admin serverless API routes |
| `api/*` | Hosted API routes when deploying the repo root |
| `admin-server.js` | Local admin server |
| `build.js` | Static site generator |
| `lib/github-publisher.js` | Commits updates to GitHub through the API |
| `sermons-data.json` | Sermon metadata |
| `library.html` | Public landing page |
| `sermons/*.html` | Generated sermon pages |

---

## Troubleshooting

- If the admin page does not load, confirm the admin server is still running.
- If generated pages look outdated, run `npm run build` again.
- If `git push` fails, verify your Git credentials and remote configuration.
