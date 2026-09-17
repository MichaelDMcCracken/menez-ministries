const crypto = require('crypto');

const DEFAULT_OWNER = 'MichaelDMcCracken';
const DEFAULT_REPO = 'menez-ministries';
const GITHUB_API_BASE_URL = 'https://api.github.com';
const INSTALLATION_TOKEN_REFRESH_WINDOW_MS = 60 * 1000;
const INSTALLATION_TOKEN_FALLBACK_TTL_MS = 50 * 60 * 1000;
const installationTokenCache = new Map();
const installationTokenRequestCache = new Map();

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

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function normalizePrivateKey(privateKey) {
  return typeof privateKey === 'string'
    ? privateKey.replace(/\r\n/g, '\n').replace(/\\n/g, '\n')
    : '';
}

function createGitHubAppJwt(appId, privateKey, nowMs) {
  const signer = crypto.createSign('RSA-SHA256');
  const issuedAt = Math.floor(nowMs / 1000) - 60;
  const expiresAt = issuedAt + (9 * 60);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({ iat: issuedAt, exp: expiresAt, iss: appId }));
  const unsignedToken = `${header}.${payload}`;

  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${unsignedToken}.${signature}`;
}

async function readJsonResponse(response, fallbackMessage) {
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
    const message = parsed && parsed.message ? parsed.message : text || fallbackMessage;
    throw new Error(message);
  }

  return parsed;
}

function getInstallationCacheKey(owner, repo, appId, installationId) {
  return `${owner}/${repo}:${appId}:${installationId}`;
}

function getExpirationTime(expiresAt, nowMs) {
  const parsed = Date.parse(expiresAt || '');
  return Number.isFinite(parsed)
    ? parsed
    : nowMs + INSTALLATION_TOKEN_FALLBACK_TTL_MS;
}

async function getInstallationAccessToken(fetchImpl, owner, repo, appId, privateKey, installationId, nowMs) {
  const cacheKey = getInstallationCacheKey(owner, repo, appId, installationId);
  const cached = installationTokenCache.get(cacheKey);

  if (cached && cached.expiresAtMs - INSTALLATION_TOKEN_REFRESH_WINDOW_MS > nowMs) {
    return cached.token;
  }

  const pendingRequest = installationTokenRequestCache.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const requestPromise = (async () => {
    const jwt = createGitHubAppJwt(appId, privateKey, nowMs);
    const response = await fetchImpl(`${GITHUB_API_BASE_URL}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + jwt,
        'Content-Type': 'application/json',
        'User-Agent': 'menez-ministries-admin',
      },
    });
    const result = await readJsonResponse(response, 'Unable to create GitHub installation token.');

    if (!result || !result.token) {
      throw new Error('GitHub did not return an installation access token.');
    }

    installationTokenCache.set(cacheKey, {
      token: result.token,
      expiresAtMs: getExpirationTime(result.expires_at, nowMs),
    });

    return result.token;
  })();

  installationTokenRequestCache.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    installationTokenRequestCache.delete(cacheKey);
  }
}

function clearGitHubPublisherCache() {
  installationTokenCache.clear();
  installationTokenRequestCache.clear();
}

function createGitHubPublisher(options = {}) {
  const fetchImpl = options.fetchImpl || global.fetch;
  const owner = options.owner || process.env.GITHUB_OWNER || DEFAULT_OWNER;
  const repo = options.repo || process.env.GITHUB_REPO || DEFAULT_REPO;
  const configuredToken = options.token || process.env.GITHUB_TOKEN;
  const appId = options.appId || process.env.GITHUB_APP_ID || '';
  const privateKey = normalizePrivateKey(options.privateKey || process.env.GITHUB_APP_PRIVATE_KEY || '');
  const installationId = options.installationId || process.env.GITHUB_INSTALLATION_ID || '';
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const useGitHubApp = !options.token && Boolean(appId && privateKey && installationId);
  let branch = options.branch || process.env.GITHUB_BRANCH || '';

  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.');
  }

  if (!useGitHubApp && !configuredToken) {
    throw new Error('Configure GitHub App credentials or set GITHUB_TOKEN.');
  }

  async function getAuthorizationHeader() {
    if (useGitHubApp) {
      const installationToken = await getInstallationAccessToken(
        fetchImpl,
        owner,
        repo,
        appId,
        privateKey,
        installationId,
        now(),
      );
      return 'Bearer ' + installationToken;
    }

    return 'Bearer ' + configuredToken;
  }

  async function request(method, apiPath, body) {
    const response = await fetchImpl(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}${apiPath}`, {
      method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': await getAuthorizationHeader(),
        'Content-Type': 'application/json',
        'User-Agent': 'menez-ministries-admin',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return readJsonResponse(response, `${method} ${apiPath} failed`);
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
  clearGitHubPublisherCache,
  createGitHubAppJwt,
  createGitHubPublisher,
  gitBlobSha,
  normalizePrivateKey,
};
