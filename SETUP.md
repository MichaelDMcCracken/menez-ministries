# Supabase CMS — Setup Guide

This document describes every manual step needed to finish deploying the
Supabase-backed sermon management system.

---

## Overview

| Component        | Hosting        | Purpose                         |
|-----------------|----------------|---------------------------------|
| Public website  | GitHub Pages   | Sermon library visible to all   |
| Admin dashboard | Vercel         | Pastor adds/edits sermons       |
| Database        | Supabase       | Source of truth for sermon data |

---

## Step 1 — Create a Supabase Project

1. Go to <https://supabase.com> and create a free account.
2. Create a new project (choose a region close to your users).
3. Note down:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **Anon (public) key** — starts with `eyJ…` (safe to expose in browser)
   - **Service-role key** — starts with `eyJ…` (**keep this secret**)

---

## Step 2 — Run the Database Migration

In the Supabase dashboard, go to **SQL Editor** and paste the contents of:

```
supabase/migrations/001_initial_schema.sql
```

Click **Run**. This creates the `sermons`, `media_links`, `series`, and
`speakers` tables along with RLS policies.

---

## Step 3 — Create an Admin User

In the Supabase dashboard:

1. Go to **Authentication → Users**.
2. Click **Invite user** (or **Add user**).
3. Enter the pastor's email and a strong password.

> Only authenticated users can write data. Public visitors can only read
> published sermons (enforced by Row Level Security).

---

## Step 4 — Migrate Existing Sermon Data

Run the migration script once to import all 577 sermons from
`sermons-data.json` into Supabase:

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node scripts/migrate-to-supabase.js
```

The script is idempotent — safe to re-run; it skips sermons that already exist.

---

## Step 5 — Configure the Public Website

Edit `js/supabase-config.js` and replace the placeholder values:

```js
window.__SUPABASE_CONFIG__ = {
  url:     'https://your-project.supabase.co',
  anonKey: 'your-anon-key-here',
};
```

Then regenerate the static sermon pages:

```bash
node build.js
```

Commit and push — GitHub Pages will serve the updated pages automatically.

> The anon key is safe to commit. It can only read **published** sermons
> because of the Row Level Security policies in the database.

---

## Step 6 — Deploy the Admin Dashboard to Vercel

### Option A — Vercel via GitHub (recommended)

1. Go to <https://vercel.com> and import the `menez-ministries` repository.
2. Set the **Root Directory** to `admin`.
3. No build step is required (static HTML/JS).
4. Vercel will deploy on every push.

### Option B — Vercel CLI

```bash
npm i -g vercel
cd admin
vercel --prod
```

### Set the custom domain

In the Vercel dashboard:
1. Go to **Project Settings → Domains**.
2. Add `admin.flatrabbitministries.com`.
3. Follow the DNS instructions to point the subdomain to Vercel.

---

## Step 7 — Configure the Admin Dashboard

Edit `admin/config.js` and replace the placeholder values:

```js
window.__ADMIN_SUPABASE_URL__      = 'https://your-project.supabase.co';
window.__ADMIN_SUPABASE_ANON_KEY__ = 'your-anon-key-here';
```

Commit and push (or deploy via Vercel CLI).

---

## Environment Variables Summary

| Variable                    | Where used                          | Notes                        |
|-----------------------------|-------------------------------------|------------------------------|
| `SUPABASE_URL`              | Migration script (server-side only) | Never expose in browser      |
| `SUPABASE_SERVICE_ROLE_KEY` | Migration script (server-side only) | **Never commit or expose**   |
| `js/supabase-config.js`     | Public website (client-side)        | Anon key — safe to expose    |
| `admin/config.js`           | Admin dashboard (client-side)       | Anon key — safe to expose    |

---

## How the System Works After Setup

### Adding a new sermon (pastor's workflow)

1. Visit `admin.flatrabbitministries.com` and sign in.
2. Click **+ Add Sermon**.
3. Fill in title, book, passage, date, media URL.
4. Check **Published**.
5. Click **Add**.

The sermon appears immediately on the public website — no Git, no builds,
no deployments needed.

### How the public website stays current

Each sermon book page (e.g. `sermons/1-corinthians.html`) contains a
JavaScript snippet that fetches live data from Supabase on page load.
If Supabase is unreachable, the statically-generated fallback content is
shown instead.

`library.html` also dynamically loads and displays the most recent
published sermon with a date.

---

## Files Changed

| File | Description |
|------|-------------|
| `supabase/migrations/001_initial_schema.sql` | Database schema + RLS |
| `scripts/migrate-to-supabase.js` | One-time data migration |
| `js/supabase-config.js` | Public site Supabase config (fill in values) |
| `admin/index.html` | Admin dashboard (single-page app) |
| `admin/config.js` | Admin Supabase config (fill in values) |
| `admin/vercel.json` | Vercel routing config |
| `build.js` | Updated to generate Supabase-aware sermon pages |
| `library.html` | Updated to dynamically load most-recent sermon |
| `sermons/*.html` | Regenerated with Supabase dynamic loader |
| `.env.example` | Environment variable reference |
| `.gitignore` | Excludes `.env` and `node_modules` |

---

## Remaining Decisions for Your Input

1. **GitHub Actions for public-site config** — if you don't want to commit
   the anon key directly in `js/supabase-config.js`, a GitHub Actions
   workflow can inject it as a secret during deployment. Let me know if you
   want this set up.

2. **Email confirmation for new admin users** — by default Supabase sends a
   confirmation email. You can disable this in
   **Authentication → Settings → Email Auth**.

3. **Password reset** — the admin dashboard does not currently include a
   "Forgot password" flow. Supabase's dashboard can be used to reset
   passwords manually for now.

4. **Series management** — the migration script creates one series record
   per book that has a subtitle. You can rename or reorganize these in the
   admin under the **Series** tab.
