# Menez Ministries Sermon Site

This repository contains a static sermon website plus a local admin UI for adding and editing sermons, building the generated pages, and pushing updates to a GitHub repository.

## Overview

- `admin.html` is the local admin interface for adding or updating sermon entries.
- `admin-server.js` runs a local server to support the admin page and perform build/push actions.
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

Start the admin server:

```bash
npm run admin
```

Then open `admin.html` in your browser using the local server URL shown in the terminal. The admin UI allows you to:

- Add or edit sermon entries
- Save changes to `sermons-data.json`
- Build generated pages
- Build and push updates automatically

## Using the Admin UI

1. In the admin page, choose an existing book slug or add a new one.
2. Enter sermon details: title, passage, date, and audio URL.
3. Click **Save sermon**.
4. After saving, use either:
   - **Build now** to regenerate the site files locally, or
   - **Build & Push** to build, commit, and push the changes to the repository.

## Manual Build Commands

If you need to run build commands from the terminal instead of using the admin page:

```bash
npm run build
```

This regenerates the site files from the current `sermons-data.json`.

## Build & Push

The admin UI includes a **Build & Push** button that will:

1. Run `npm run build`
2. Stage the generated site files and `sermons-data.json`
3. Commit the changes with the provided commit message
4. Push the commit to the repository remote

If you prefer to do this manually in the terminal, use Git commands after building:

```bash
git add sermons-data.json library.html sermons
git commit -m "Update sermons and generated pages"
git push
```

## Notes

- The repo includes a `CNAME` file and generated `sermons/` pages.
- If you are installing on a new machine, make sure your GitHub credentials are configured so `git push` succeeds.
- If the admin page does not show the success message immediately, refresh the page and verify the local server is running.

## Troubleshooting

- If `npm install` fails, confirm Node.js and npm are installed correctly.
- If `git push` fails, check your Git remote, branch, and authentication settings.
- If the admin server does not start, ensure `admin-server.js` is present and the port is not blocked.
