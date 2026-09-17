# Menez Ministries Sermon Site

This repository contains a static sermon website plus a JSON-backed admin UI for adding and editing sermons in a browser, building the generated pages, and publishing updates to GitHub.

## Overview

- `admin.html` is the browser-based admin interface used by the local server.
- `admin/index.html` is the hosted admin entrypoint for Vercel-style deployments.
- `admin-server.js` runs the local admin server and performs build/push actions.
- `api/` and `admin/api/` provide hosted GitHub-backed API endpoints for remote browser editing.
- `build.js` generates the static site files.
- `sermons-data.json` stores the sermon metadata.
- `package.json` defines the Node scripts and dependencies.

## Prerequisites

The machine you are installing on must have:

- A GitHub account
- Git installed
- Node.js and npm installed
- A terminal or command prompt

If the machine does not have these installed yet, install them first.

### Install Git

1. Download Git from https://git-scm.com/downloads
2. Install Git using the installer for macOS, Windows, or Linux.
3. Verify installation:

```bash
git --version
```

### Install Node.js and npm

1. Download Node.js from https://nodejs.org/
2. Install the current LTS version.
3. Verify installation:

```bash
node --version
npm --version
```

### GitHub account

If you do not already have a GitHub account:

1. Sign up at https://github.com/
2. Set up GitHub authentication for cloning and pushing.

#### HTTPS access

1. Use your GitHub username and password, or a personal access token if prompted.
2. You can clone via HTTPS with:

```bash
git clone https://github.com/<username>/<repo-name>.git
```

3. If you want to avoid repeated credential prompts, configure a credential helper:

```bash
git config --global credential.helper cache
```

#### SSH access

1. Generate an SSH key if you do not already have one:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

2. Copy the public key and add it to GitHub: https://github.com/settings/keys

```bash
cat ~/.ssh/id_ed25519.pub
```

3. Test SSH access:

```bash
ssh -T git@github.com
```

4. Clone via SSH with:

```bash
git clone git@github.com:<username>/<repo-name>.git
```

#### Verify GitHub access

After configuring HTTPS or SSH, verify you can clone and push to GitHub from the machine.

## Clone the Repository

Open a terminal and run one of the following:

HTTPS:

```bash
git clone https://github.com/<username>/<repo-name>.git
```

SSH:

```bash
git clone git@github.com:<username>/<repo-name>.git
```

cd menez-ministries

If you already have the repository locally, just `cd` into the folder.

## Install Dependencies

From the repository root:

```bash
npm install
```

This installs the dependencies declared in `package.json`.

## Run the Admin Interface

Start the admin server locally:

```bash
npm run admin
```

Then open `/admin` in your browser using the local server URL shown in the terminal. The admin UI allows you to:

- Add or edit sermon entries
- Save changes to `sermons-data.json`
- Build generated pages
- Build and push updates automatically

## Host the Admin Interface Remotely

If you want the pastor to add or edit sermons from a browser without local repo
access, deploy the hosted admin to Vercel.

The hosted dashboard calls server-side API routes that:

- read `sermons-data.json` from GitHub
- regenerate `library.html` and `sermons/*.html`
- commit the updated files back to the repository with a server-side credential

### Required environment variables

- `GITHUB_TOKEN` — a GitHub App installation token or fine-grained token with
  contents write access to this repository
- `GITHUB_OWNER` — defaults to `MichaelDMcCracken`
- `GITHUB_REPO` — defaults to `menez-ministries`
- `GITHUB_BRANCH` — optional; defaults to the repository's default branch

### Deployment notes

- The existing Vercel project can keep using `admin/` as its root directory.
- If you deploy the whole repository on Vercel instead, the hosted dashboard is
  available at `/admin/`.
- The pastor only needs the deployed admin URL in a browser; no GitHub account,
  Git, Node, or CLI access is required.

## Using the Admin UI

1. In the admin page, choose an existing book slug or add a new one.
2. Enter sermon details: title, passage, date, and audio URL.
3. Click **Save sermon**.
4. If you are using the local admin server, use either:
   - **Build now** to regenerate the site files locally, or
   - **Build & Push** to build, commit, and push the changes to the repository.
5. If you are using the hosted admin deployment, **Save sermon** immediately
   writes the updated JSON and regenerated pages back to GitHub through the
   server-side API.

## Manual Build Commands

If you need to run build commands from the terminal instead of using the admin page:

```bash
npm run build
```

This regenerates the site files from the current `sermons-data.json`.

## Build & Push

The admin UI includes a **Build & Push** button that will:

1. On the local admin server: run `npm run build`, stage the generated site
   files and `sermons-data.json`, commit them, and push to the repository
   remote
2. On the hosted admin deployment: rebuild the generated pages from the current
   `sermons-data.json` and commit any resulting changes through the GitHub API

If you prefer to do this manually in the terminal, use Git commands after building:

```bash
git add sermons-data.json library.html sermons
git commit -m "Update sermons and generated pages"
git push
```

## Notes

- The repo includes a `CNAME` file and generated `sermons/` pages.
- If you are installing on a new machine, make sure your GitHub credentials are configured so `git push` succeeds.
- If the local admin page does not show the success message immediately, refresh the page and verify the admin server is running.

## Troubleshooting

- If `npm install` fails, confirm Node.js and npm are installed correctly.
- If `git push` fails, check your Git remote, branch, and authentication settings.
- If the admin server does not start, ensure `admin-server.js` is present and the port is not blocked.
