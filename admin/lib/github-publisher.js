const crypto = require('crypto');

const DEFAULT_OWNER = 'MichaelDMcCracken';
const DEFAULT_REPO = 'menez-ministries';

function gitBlobSha(content) {
  return crypto.createHash('sha1')
    .update(`blob ${Buffer.byteLength(content)}\0${content}`)
    .digest('hex');
}

function encodeGitPath(filePath) {
  return filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function encodeRef(ref) {
  return ref.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function createGitHubPublisher(options = {}) {
  const fetchImpl = options.fetchImpl || global.fetch;
  const token = options.token || process.env.GITHUB_TOKEN;
  const owner = options.owner || process.env.GITHUB_OWNER || DEFAULT_OWNER;
  const repo = options.repo || process.env.GITHUB_REPO || DEFAULT_REPO;
  let branch = options.branch || process.env.GITHUB_BRANCH || '';

  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.');
  }

  if (!token) {
    throw new Error('GITHUB_TOKEN is not configured.');
  }

  async function request(method, apiPath, body) {
    const response = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}${apiPath}`, {
      method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'User-Agent': 'menez-ministries-admin',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        parsed = null;
      }
    }
    if (!response.ok) {
      const message = parsed && parsed.message ? parsed.message : text || `${method} ${apiPath} failed`;
      throw new Error(message);
    }

    return parsed;
  }

  async function getBranch() {
    if (branch) {
      return branch;
    }

    const repoInfo = await request('GET', '', undefined);
    branch = repoInfo.default_branch;
    return branch;
  }

  async function getFileText(filePath, refOverride) {
    const ref = refOverride || await getBranch();
    const result = await request('GET', `/contents/${encodeGitPath(filePath)}?ref=${encodeURIComponent(ref)}`, undefined);
    return Buffer.from(result.content.replace(/\n/g, ''), 'base64').toString('utf8');
  }

  async function getBranchState(refOverride) {
    const ref = refOverride || await getBranch();
    const branchRef = await request('GET', `/git/ref/heads/${encodeRef(ref)}`, undefined);
    const commit = await request('GET', `/git/commits/${branchRef.object.sha}`, undefined);
    const tree = await request('GET', `/git/trees/${commit.tree.sha}?recursive=1`, undefined);
    return {
      branch: ref,
      commitSha: commit.sha,
      treeSha: commit.tree.sha,
      treeEntries: tree.tree || [],
    };
  }

  async function commitFiles(files, message, refOverride) {
    const state = await getBranchState(refOverride);
    const changedEntries = Object.entries(files)
      .filter(([, content]) => typeof content === 'string')
      .filter(([filePath, content]) => {
        const currentEntry = state.treeEntries.find(entry => entry.path === filePath);
        return !currentEntry || currentEntry.sha !== gitBlobSha(content);
      })
      .map(([filePath, content]) => ({
        path: filePath,
        mode: '100644',
        type: 'blob',
        content,
      }));

    if (changedEntries.length === 0) {
      return { commitSha: null, changed: false, branch: state.branch };
    }

    const tree = await request('POST', '/git/trees', {
      base_tree: state.treeSha,
      tree: changedEntries,
    });

    const commit = await request('POST', '/git/commits', {
      message,
      tree: tree.sha,
      parents: [state.commitSha],
    });

    await request('PATCH', `/git/refs/heads/${encodeRef(state.branch)}`, {
      sha: commit.sha,
      force: false,
    });

    return { commitSha: commit.sha, changed: true, branch: state.branch };
  }

  return {
    commitFiles,
    getBranch,
    getBranchState,
    getFileText,
  };
}

module.exports = {
  createGitHubPublisher,
  gitBlobSha,
};
