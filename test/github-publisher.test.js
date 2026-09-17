const assert = require('assert');
const crypto = require('crypto');
const test = require('node:test');

const {
  clearGitHubPublisherCache,
  createGitHubPublisher,
} = require('../lib/github-publisher');

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  };
}

function decodeBase64Url(segment) {
  const padded = segment + '='.repeat((4 - (segment.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function bearer(value) {
  return ['Bearer', value].join(' ');
}

test.beforeEach(() => {
  clearGitHubPublisherCache();
});

test('uses the configured fallback token for repository requests', async () => {
  const calls = [];
  const staticAuth = 'fallback-auth';
  const publisher = createGitHubPublisher({
    token: staticAuth,
    branch: 'main',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(200, {
        content: Buffer.from('{"books":[]}\n').toString('base64'),
      });
    },
  });

  const dataText = await publisher.getFileText('sermons-data.json');

  assert.equal(dataText, '{"books":[]}\n');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers.Authorization, bearer(staticAuth));
  assert.ok(calls[0].url.includes('/repos/MichaelDMcCracken/menez-ministries/contents/sermons-data.json?ref=main'));
});

test('uses one GitHub App installation token request for concurrent reads and reuses the cached token', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { format: 'pem', type: 'spki' },
    privateKeyEncoding: { format: 'pem', type: 'pkcs1' },
  });
  const escapedPrivateKey = privateKey.replace(/\n/g, '\\n');
  const seenAuthorizations = [];
  const installationAuth = 'install-auth-1';
  let installationRequests = 0;
  const nowMs = Date.parse('2026-01-01T00:00:00.000Z');
  const publisher = createGitHubPublisher({
    appId: '123456',
    privateKey: escapedPrivateKey,
    installationId: '987654',
    branch: 'main',
    now: () => nowMs,
    fetchImpl: async (url, options) => {
      const parsedUrl = new URL(url);
      seenAuthorizations.push(options.headers.Authorization);

      if (parsedUrl.pathname === '/app/installations/987654/access_tokens') {
        installationRequests += 1;
        const [, encodedPayload] = options.headers.Authorization.slice('Bearer '.length).split('.');
        const payload = JSON.parse(decodeBase64Url(encodedPayload));

        assert.equal(payload.iss, '123456');

        return jsonResponse(201, {
          token: installationAuth,
          expires_at: new Date(nowMs + (10 * 60 * 1000)).toISOString(),
        });
      }

      return jsonResponse(200, {
        content: Buffer.from('test file\n').toString('base64'),
      });
    },
  });

  await Promise.all([
    publisher.getFileText('sermons-data.json'),
    publisher.getFileText('library.html'),
  ]);
  await publisher.getFileText('library.html');

  assert.equal(installationRequests, 1);
  assert.ok(seenAuthorizations[0].startsWith('Bearer '));
  assert.notEqual(seenAuthorizations[0], bearer(installationAuth));
  assert.equal(seenAuthorizations[1], bearer(installationAuth));
  assert.equal(seenAuthorizations[2], bearer(installationAuth));
  assert.equal(seenAuthorizations[3], bearer(installationAuth));
});

test('refreshes the GitHub App installation token after it expires', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { format: 'pem', type: 'spki' },
    privateKeyEncoding: { format: 'pem', type: 'pkcs1' },
  });
  let nowMs = Date.parse('2026-01-01T00:00:00.000Z');
  let installationRequests = 0;
  const repositoryAuthorizations = [];
  const publisher = createGitHubPublisher({
    appId: '333333',
    privateKey,
    installationId: '444444',
    branch: 'main',
    now: () => nowMs,
    fetchImpl: async (url, options) => {
      const parsedUrl = new URL(url);

      if (parsedUrl.pathname === '/app/installations/444444/access_tokens') {
        installationRequests += 1;
        return jsonResponse(201, {
          token: `install-auth-${installationRequests}`,
          expires_at: new Date(nowMs + (2 * 60 * 1000)).toISOString(),
        });
      }

      repositoryAuthorizations.push(options.headers.Authorization);
      return jsonResponse(200, {
        content: Buffer.from('test file\n').toString('base64'),
      });
    },
  });

  await publisher.getFileText('sermons-data.json');
  await publisher.getFileText('library.html');
  nowMs += 3 * 60 * 1000;
  await publisher.getFileText('library.html');

  assert.equal(installationRequests, 2);
  assert.deepEqual(repositoryAuthorizations, [
    bearer('install-auth-1'),
    bearer('install-auth-1'),
    bearer('install-auth-2'),
  ]);
});
