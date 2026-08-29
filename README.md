# Menez Ministries Sermon Site

A static sermon library hosted on GitHub Pages. Sermon data is managed through a hosted Supabase CMS, so changes made in the admin dashboard are reflected live on the public site with no rebuild or Git push required.

## Architecture

| Component | Description |
|---|---|
| `index.html` / `library.html` | Public-facing static pages (GitHub Pages) |
| `sermons/*.html` | Per-book sermon list pages – fetch data dynamically from Supabase |
| `admin.html` | Admin dashboard – authenticates via Supabase Auth and performs CRUD |
| `supabase-config.js` | Supabase project URL and anon key (edit before deploying) |
| `supabase/migrations/` | SQL migrations to apply in your Supabase project |
| `generate-book-pages.js` | One-time script to regenerate dynamic book page shells |

---

## First-time Supabase Setup

### 1 · Create a Supabase project

1. Sign in at [supabase.com](https://supabase.com/) and create a new project.
2. Note your **Project URL** and **anon / public API key** from  
   *Project Settings → API*.

### 2 · Apply the database schema

Open the Supabase SQL editor (*Database → SQL Editor*) and run the contents of:

```
supabase/migrations/001_initial_schema.sql
```

### 3 · Import existing sermon data

Still in the SQL editor, run:

```
supabase/migrations/002_seed_sermons.sql
```

This inserts all 577 sermons migrated from the original `sermons-data.json`.

### 4 · Create an admin user

In Supabase go to *Authentication → Users → Add user* and create an account  
with an email and password. This is the only account that can sign in to  
`admin.html`.

### 5 · Add your credentials to `supabase-config.js`

Edit `supabase-config.js` and replace the placeholder values:

```js
const SUPABASE_URL      = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

Both values are safe to commit; Row Level Security (RLS) ensures anonymous  
visitors can only read data, and only authenticated admin users can write.

### 6 · Deploy / push to GitHub Pages

Commit and push. GitHub Pages will serve the updated site automatically.

---

## Adding or editing sermons

1. Open `admin.html` (hosted at your GitHub Pages URL or locally in a browser).
2. Sign in with your Supabase admin credentials.
3. Select a book slug (or type a new one) and fill in the sermon details.
4. Click **Save sermon**. The change is written to Supabase immediately.
5. The public site reads live from Supabase – no rebuild needed.

---

## Adding a new book

If you add sermons for a book that does not yet have its own page under  
`sermons/`, run the generator script once to create the dynamic HTML shell:

```bash
node generate-book-pages.js
```

Then commit and push the new file to GitHub Pages.

---

## Row Level Security summary

| Role | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `anon` (public) | ✅ | ❌ |
| `authenticated` (admin) | ✅ | ✅ |

Policies are defined in `supabase/migrations/001_initial_schema.sql`.

---

## File reference

| File | Purpose |
|---|---|
| `supabase-config.js` | Supabase URL + anon key – **edit this** |
| `supabase/migrations/001_initial_schema.sql` | Creates `sermons` table + RLS policies |
| `supabase/migrations/002_seed_sermons.sql` | Seeds all existing sermons |
| `admin.html` | Hosted admin dashboard (Supabase Auth + CRUD) |
| `generate-book-pages.js` | Regenerates dynamic `sermons/*.html` shells |
| `library.html` | Public sermon library index |
| `sermons/*.html` | Per-book dynamic sermon list pages |

---

## Legacy files (kept for reference, no longer active)

| File | Description |
|---|---|
| `admin-server.js` | Old local Node.js admin server |
| `build.js` | Old static site generator |
| `extract-sermons.js` | Old scraper utility |
| `sermons-data.json` | Original flat-file data store (source for seed migration) |
