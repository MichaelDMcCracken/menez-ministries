const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { exec } = require('child_process');

const PORT = 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'sermons-data.json');
const ADMIN_FILE = path.join(ROOT, 'admin.html');

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

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
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

    if ((pathname === '/' || pathname === '/admin') && req.method === 'GET') {
      try {
        const html = fs.readFileSync(ADMIN_FILE, 'utf8');
        sendHtml(res, html);
      } catch (error) {
        res.writeHead(500);
        res.end('Unable to load admin page');
      }
      return;
    }

    if (pathname === '/data' && req.method === 'GET') {
      try {
        const data = loadData();
        sendJson(res, 200, data);
      } catch (error) {
        sendJson(res, 500, { error: 'Unable to read sermon data' });
      }
      return;
    }

    if (pathname === '/added-sermons' && req.method === 'GET') {
      try {
        const currentData = loadData();
        let headData = {};
        try {
          const { stdout } = await execCommand('git show HEAD:sermons-data.json', { cwd: ROOT });
          headData = JSON.parse(stdout);
        } catch (error) {
          headData = {};
        }

        const added = [];
        const updated = [];

        for (const book in currentData) {
          const currentBook = currentData[book];
          const headBook = headData[book];
          if (!headBook) {
            currentBook.sermons.forEach(sermon => {
              added.push({ book, title: sermon.title, date: sermon.date || '', passage: sermon.passage || '', url: sermon.url });
            });
            continue;
          }

          const headSermons = Array.isArray(headBook.sermons) ? headBook.sermons : [];
          currentBook.sermons.forEach((sermon, index) => {
            const headSermon = headSermons[index];
            if (!headSermon) {
              added.push({ book, title: sermon.title, date: sermon.date || '', passage: sermon.passage || '', url: sermon.url });
              return;
            }
            if (sermon.title !== headSermon.title || sermon.url !== headSermon.url || sermon.date !== headSermon.date || sermon.passage !== headSermon.passage) {
              updated.push({ book, title: sermon.title, date: sermon.date || '', passage: sermon.passage || '', url: sermon.url });
            }
          });
        }

        sendJson(res, 200, { added, updated });
      } catch (error) {
        sendJson(res, 500, { error: 'Unable to compute unpublished sermon changes' });
      }
      return;
    }

    if ((pathname === '/add-sermon' || pathname === '/save-sermon') && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const bookSlug = normalizeString(body.book);
        const title = normalizeString(body.title);
        const urlValue = normalizeString(body.url);

        if (!bookSlug || !title || !urlValue) {
          sendJson(res, 400, { error: 'Book slug, sermon title, and URL are required.' });
          return;
        }

        const subtitle = normalizeString(body.subtitle);
        const passage = normalizeString(body.passage);
        const date = normalizeString(body.date);
        const originalBook = normalizeString(body.originalBook);
        const sermonIndex = Number.isFinite(body.sermonIndex) ? Number(body.sermonIndex) : (body.sermonIndex !== undefined ? Number(body.sermonIndex) : undefined);

        const data = loadData();
        if (!data[bookSlug]) {
          data[bookSlug] = { sermons: [] };
        }
        if (subtitle) {
          data[bookSlug].subtitle = subtitle;
        }

        const sermonEntry = { title, url: urlValue };
        if (passage) sermonEntry.passage = passage;
        if (date) sermonEntry.date = date;

        if (originalBook && Number.isInteger(sermonIndex) && data[originalBook] && data[originalBook].sermons[sermonIndex]) {
          if (originalBook === bookSlug) {
            data[bookSlug].sermons[sermonIndex] = sermonEntry;
          } else {
            data[originalBook].sermons.splice(sermonIndex, 1);
            if (data[originalBook].sermons.length === 0) {
              delete data[originalBook];
            }
            data[bookSlug].sermons.push(sermonEntry);
          }
        } else {
          data[bookSlug].sermons.push(sermonEntry);
        }

        function parsePassageReference(passage) {
          if (!passage || typeof passage !== 'string') return { chapter: Infinity, verse: Infinity };
          const match = passage.match(/(\d+)(?::(\d+))?/);
          if (!match) return { chapter: Infinity, verse: Infinity };
          return { chapter: Number(match[1]), verse: match[2] ? Number(match[2]) : 1 };
        }

        function sortSermonsByReference(sermons) {
          sermons.sort((a, b) => {
            const refA = parsePassageReference(a.passage);
            const refB = parsePassageReference(b.passage);
            if (refA.chapter !== refB.chapter) return refA.chapter - refB.chapter;
            return refA.verse - refB.verse;
          });
        }

        sortSermonsByReference(data[bookSlug].sermons);
        saveData(data);

        sendJson(res, 200, { message: 'Sermon saved successfully.' });
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Unable to save sermon.' });
      }
      return;
    }

    if (pathname === '/delete-sermon' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const bookSlug = normalizeString(body.book);
        const sermonIndex = Number(body.sermonIndex);

        if (!bookSlug || Number.isNaN(sermonIndex) || sermonIndex < 0) {
          sendJson(res, 400, { error: 'Book slug and sermon index are required.' });
          return;
        }

        const data = loadData();
        if (!data[bookSlug] || !data[bookSlug].sermons[sermonIndex]) {
          sendJson(res, 400, { error: 'Sermon not found.' });
          return;
        }

        data[bookSlug].sermons.splice(sermonIndex, 1);
        if (data[bookSlug].sermons.length === 0) {
          delete data[bookSlug];
        }

        saveData(data);
        sendJson(res, 200, { message: 'Sermon deleted successfully.' });
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Unable to delete sermon.' });
      }
      return;
    }

    if (pathname === '/build' && req.method === 'POST') {
      try {
        const { stdout, stderr } = await execCommand('npm run build', { cwd: ROOT });
        sendJson(res, 200, {
          message: 'Build completed successfully.',
          stdout,
          stderr
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

    if (pathname === '/build-push' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        let commitMessage = normalizeString(body.commitMessage);
        if (!commitMessage) {
          commitMessage = `Update sermons and generated pages (${new Date().toISOString().slice(0, 10)})`;
        }

        await execCommand('npm run build', { cwd: ROOT });
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

    res.writeHead(404);
    res.end('Not found');
  });
}

const server = createServer();
server.listen(PORT, () => {
  console.log(`Admin server is running at http://localhost:${PORT}`);
  console.log('Open that address in your browser and add sermons locally.');
});
