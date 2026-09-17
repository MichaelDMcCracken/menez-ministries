const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { exec } = require('child_process');

const { runBuild } = require('./build');
const {
  applyDeleteSermon,
  applySaveSermon,
  computeAddedAndUpdated,
  validateSermonDataset,
} = require('./lib/sermon-data');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'sermons-data.json');
const ADMIN_FILE = path.join(ROOT, 'admin', 'index.html');

function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      const result = {
        stdout: stdout.toString(),
        stderr: stderr.toString()
      };
      if (error) {
        reject(Object.assign(result, { error }));
      } else {
        resolve(result);
      }
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function writeBuildOutputs() {
  return runBuild({
    dataPath: DATA_FILE,
    libraryPath: path.join(ROOT, 'library.html'),
    sermonsDir: path.join(ROOT, 'sermons'),
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if ((pathname === '/' || pathname === '/admin' || pathname === '/admin/') && req.method === 'GET') {
      try {
        const html = fs.readFileSync(ADMIN_FILE, 'utf8');
        sendHtml(res, html);
      } catch (error) {
        res.writeHead(500);
        res.end('Unable to load admin page');
      }
      return;
    }

    if ((pathname === '/data' || pathname === '/api/data') && req.method === 'GET') {
      try {
        const data = loadData();
        sendJson(res, 200, data);
      } catch (error) {
        sendJson(res, 500, { error: 'Unable to read sermon data' });
      }
      return;
    }

    if ((pathname === '/added-sermons' || pathname === '/api/added-sermons') && req.method === 'GET') {
      try {
        const currentData = loadData();
        let headData = {};
        try {
          const { stdout } = await execCommand('git show HEAD:sermons-data.json', { cwd: ROOT });
          headData = JSON.parse(stdout);
        } catch (error) {
          headData = {};
        }

        sendJson(res, 200, computeAddedAndUpdated(currentData, headData));
      } catch (error) {
        sendJson(res, 500, { error: 'Unable to compute unpublished sermon changes' });
      }
      return;
    }

    if ((pathname === '/add-sermon' || pathname === '/save-sermon' || pathname === '/api/save-sermon') && req.method === 'POST') {
      try {
        const data = applySaveSermon(loadData(), await parseJsonBody(req));
        saveData(data);

        sendJson(res, 200, { message: 'Sermon saved successfully.' });
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Unable to save sermon.' });
      }
      return;
    }

    if ((pathname === '/delete-sermon' || pathname === '/api/delete-sermon') && req.method === 'POST') {
      try {
        const data = applyDeleteSermon(loadData(), await parseJsonBody(req));
        saveData(data);
        sendJson(res, 200, { message: 'Sermon deleted successfully.' });
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Unable to delete sermon.' });
      }
      return;
    }

    if ((pathname === '/build' || pathname === '/api/build') && req.method === 'POST') {
      try {
        writeBuildOutputs();
        sendJson(res, 200, {
          message: 'Build completed successfully.',
          stdout: '',
          stderr: ''
        });
      } catch (result) {
        sendJson(res, 500, {
          error: 'Build failed. See stderr for details.',
          stdout: result.stdout,
          stderr: result.stderr
        });
      }
      return;
    }

    if ((pathname === '/build-push' || pathname === '/api/build-push') && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        let commitMessage = typeof body.commitMessage === 'string' ? body.commitMessage.trim() : '';
        if (!commitMessage) {
          commitMessage = `Update sermons and generated pages (${new Date().toISOString().slice(0, 10)})`;
        }

        writeBuildOutputs();
        await execCommand('git add sermons-data.json library.html sermons', { cwd: ROOT });
        await execCommand(`git diff --cached --quiet || git commit -m ${JSON.stringify(commitMessage)}`, { cwd: ROOT });
        const { stdout, stderr } = await execCommand('git push', { cwd: ROOT });
        sendJson(res, 200, {
          message: 'Build, commit, and push completed successfully.',
          stdout,
          stderr
        });
      } catch (result) {
        sendJson(res, 500, {
          error: 'Build and push failed. See stderr for details.',
          stdout: result.stdout,
          stderr: result.stderr
        });
      }
      return;
    }

    if ((pathname === '/publish-changes' || pathname === '/api/publish-changes') && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const data = validateSermonDataset(body.data);
        saveData(data);
        writeBuildOutputs();

        let commitMessage = typeof body.commitMessage === 'string' ? body.commitMessage.trim() : '';
        if (!commitMessage) {
          commitMessage = `Publish staged sermon changes (${new Date().toISOString().slice(0, 10)})`;
        }

        await execCommand('git add sermons-data.json library.html sermons', { cwd: ROOT });
        const { stdout: stagedFiles } = await execCommand('git diff --cached --name-only', { cwd: ROOT });
        if (!stagedFiles.trim()) {
          sendJson(res, 200, {
            message: 'No changes were needed.',
            stdout: '',
            stderr: ''
          });
          return;
        }

        await execCommand(`git commit -m ${JSON.stringify(commitMessage)}`, { cwd: ROOT });
        const { stdout, stderr } = await execCommand('git push', { cwd: ROOT });
        sendJson(res, 200, {
          message: 'Staged sermon changes published successfully.',
          stdout,
          stderr
        });
      } catch (result) {
        sendJson(res, 500, {
          error: result.message || 'Unable to publish staged sermon changes.',
          stdout: result.stdout,
          stderr: result.stderr
        });
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });
}

const server = createServer();
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try another port with PORT=<port> npm run admin.`);
    process.exit(1);
  }
  throw err;
});
server.listen(PORT, () => {
  console.log(`Admin server is running at http://localhost:${PORT}`);
  console.log('Open /admin in a browser on this server to manage sermons.');
});
