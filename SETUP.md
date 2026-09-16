# Sermon Site Setup Guide

This project now uses the repository's checked-in JSON data file as the
source of truth instead of Supabase.

---

## Overview

| Component        | Location       | Purpose                                |
|-----------------|----------------|----------------------------------------|
| Public website  | GitHub Pages   | Sermon library visible to all          |
| Admin dashboard | Browser + Node server | Add or edit sermon metadata      |
| Data store      | `sermons-data.json` | Source of truth for generated pages |

---

## Step 1 — Install Dependencies

From the repository root:

```bash
npm install
```

---

## Step 2 — Run the Admin Server

For local use, run:

```bash
npm run admin
```

Then open the local URL shown in the terminal, such as
<http://localhost:3000/admin>.

For hosted remote use, deploy the repository to a Node-capable server and run:

```bash
npm start
```

Then open that hosted server's `/admin` URL in your browser.

The admin page edits `sermons-data.json` directly through the server.

---

## Step 3 — Save Sermon Changes

In the admin UI:

1. Choose an existing book slug or add a new one.
2. Enter the sermon title, passage, date, and audio URL.
3. Click **Save sermon**.

---

## Step 4 — Regenerate the Static Site

After editing the data, rebuild the generated pages:

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

If you are using the hosted admin server, the **Build & Push** button can do
this for you as long as the server has a writable repository checkout and Git
credentials configured for push access.

---

## How the System Works

1. `sermons-data.json` stores sermon metadata.
2. `admin-server.js` serves the admin interface and writes updates to
   `sermons-data.json`.
3. `build.js` regenerates the public sermon pages from the JSON data.
4. GitHub Pages serves the committed static files.

---

## Files Involved

| File | Description |
|------|-------------|
| `admin.html` | Browser-based admin interface |
| `admin-server.js` | Admin server for local or hosted use |
| `build.js` | Static site generator |
| `sermons-data.json` | Sermon metadata |
| `library.html` | Public landing page |
| `sermons/*.html` | Generated sermon pages |

---

## Troubleshooting

- If the admin page does not load, confirm the admin server is still running.
- If generated pages look outdated, run `npm run build` again.
- If `git push` fails, verify your Git credentials and remote configuration.
