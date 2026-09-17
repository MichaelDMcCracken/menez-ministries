const { createGitHubPublisher } = require('./github-publisher');
const {
  deleteSermonRemotely,
  loadRemoteRepositoryState,
  publishChangesRemotely,
  rebuildSiteRemotely,
  saveSermonRemotely,
} = require('./remote-admin');

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(text || '{}');
}

function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  sendJson(res, 405, { error: 'Method not allowed.' });
}

function withPublisher(handler) {
  return async (req, res) => {
    try {
      const publisher = createGitHubPublisher();
      await handler(req, res, publisher);
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Remote admin request failed.' });
    }
  };
}

function dataHandler() {
  return withPublisher(async (req, res, publisher) => {
    if (req.method !== 'GET') {
      return methodNotAllowed(res, ['GET']);
    }

    const { data } = await loadRemoteRepositoryState(publisher);
    sendJson(res, 200, data);
  });
}

function addedSermonsHandler() {
  return withPublisher(async (req, res) => {
    if (req.method !== 'GET') {
      return methodNotAllowed(res, ['GET']);
    }

    sendJson(res, 200, { added: [], updated: [] });
  });
}

function saveSermonHandler() {
  return withPublisher(async (req, res, publisher) => {
    if (req.method !== 'POST') {
      return methodNotAllowed(res, ['POST']);
    }

    try {
      const result = await saveSermonRemotely(publisher, await readJsonBody(req));
      sendJson(res, 200, {
        message: result.changed
          ? 'Sermon saved, rebuilt, and committed to GitHub.'
          : 'No changes were needed.',
        commitSha: result.commitSha,
        branch: result.branch,
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Unable to save sermon.' });
    }
  });
}

function deleteSermonHandler() {
  return withPublisher(async (req, res, publisher) => {
    if (req.method !== 'POST') {
      return methodNotAllowed(res, ['POST']);
    }

    try {
      const result = await deleteSermonRemotely(publisher, await readJsonBody(req));
      sendJson(res, 200, {
        message: result.changed
          ? 'Sermon deleted, rebuilt, and committed to GitHub.'
          : 'No changes were needed.',
        commitSha: result.commitSha,
        branch: result.branch,
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Unable to delete sermon.' });
    }
  });
}

function buildHandler() {
  return withPublisher(async (req, res, publisher) => {
    if (req.method !== 'POST') {
      return methodNotAllowed(res, ['POST']);
    }

    try {
      const result = await rebuildSiteRemotely(publisher, await readJsonBody(req));
      sendJson(res, 200, {
        message: result.changed
          ? 'Generated pages rebuilt and committed to GitHub.'
          : 'Generated pages already match the current JSON data.',
        commitSha: result.commitSha,
        branch: result.branch,
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Unable to rebuild generated pages.' });
    }
  });
}

function publishChangesHandler() {
  return withPublisher(async (req, res, publisher) => {
    if (req.method !== 'POST') {
      return methodNotAllowed(res, ['POST']);
    }

    try {
      const result = await publishChangesRemotely(publisher, await readJsonBody(req));
      sendJson(res, 200, {
        message: result.changed
          ? 'Staged sermon changes published, rebuilt, and committed to GitHub.'
          : 'No changes were needed.',
        commitSha: result.commitSha,
        branch: result.branch,
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Unable to publish staged changes.' });
    }
  });
}

module.exports = {
  addedSermonsHandler,
  buildHandler,
  dataHandler,
  deleteSermonHandler,
  publishChangesHandler,
  saveSermonHandler,
};
