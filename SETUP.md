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

- `GITHUB_APP_ID` — the App ID shown on the GitHub App settings page
- `GITHUB_APP_PRIVATE_KEY` — the full PEM private key generated for the App.
  Paste the whole key into Vercel; escaped `\n` newlines also work.
- `GITHUB_INSTALLATION_ID` — the numeric ID from the App installation for your
  GitHub account. You can copy it from the installation URL, such as
  `https://github.com/settings/installations/12345678`.
- `GITHUB_OWNER` — optional; defaults to `MichaelDMcCracken`
- `GITHUB_REPO` — optional; defaults to `menez-ministries`
- `GITHUB_BRANCH` — optional; defaults to the repo default branch
- `GITHUB_TOKEN` — optional fallback token for local/test deployments; not
  needed when the GitHub App variables above are configured

The hosted admin backend keeps those credentials server-side, creates a GitHub
App JWT as needed, exchanges it for a short-lived installation access token, and
refreshes that token automatically before it expires.

Where those GitHub App values come from:

1. In GitHub, open **Settings → Developer settings → GitHub Apps → your app**.
2. Copy the **App ID** into `GITHUB_APP_ID`.
3. In the same App settings, generate or view the private key PEM and paste it
   into `GITHUB_APP_PRIVATE_KEY`.
4. Open the App installation for your account/repository and copy the numeric ID
   from the installation URL into `GITHUB_INSTALLATION_ID`.

The hosted admin page reads and writes `sermons-data.json` through the GitHub
API, regenerates the static pages server-side, and commits the results back to
the repository. The pastor only needs the deployed dashboard URL in a browser,
not a GitHub account, Git, Node, or CLI tools.

---

## Step 3 — Stage Sermon Changes

In the admin UI:

1. Choose a Bible book.
2. Enter the sermon title, date, and audio URL.
3. Select passage chapter/verse values from dropdowns.
4. Click **Stage Changes**.

Staged changes remain unpublished until you click **Publish Changes**.

## Step 4 — Publish Staged Changes

When you click **Publish Changes**, the admin API sends the complete staged
dataset to the server, regenerates static files, and commits all staged updates
to GitHub in a single commit.

---

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
