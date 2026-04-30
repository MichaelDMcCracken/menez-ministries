const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { exec } = require('child_process');

const PORT = 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'sermons-data.json');
const ADMIN_FILE = path.join(ROOT, 'admin.html');

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

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
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

    if (pathname === '/add-sermon' && req.method === 'POST') {
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

        const data = loadData();
        if (!data[bookSlug]) {
          data[bookSlug] = { sermons: [] };
          if (subtitle) {
            data[bookSlug].subtitle = subtitle;
          }
        }

        const sermonEntry = { title, url: urlValue };
        if (passage) sermonEntry.passage = passage;
        if (date) sermonEntry.date = date;

        data[bookSlug].sermons.push(sermonEntry);
        saveData(data);

        sendJson(res, 200, { message: 'Sermon saved successfully.' });
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Unable to save sermon.' });
      }
      return;
    }

    if (pathname === '/build' && req.method === 'POST') {
      exec('npm run build', { cwd: ROOT }, (error, stdout, stderr) => {
        if (error) {
          sendJson(res, 500, {
            error: 'Build failed. See stderr for details.',
            stdout: stdout.toString(),
            stderr: stderr.toString()
          });
          return;
        }
        sendJson(res, 200, {
          message: 'Build completed successfully.',
          stdout: stdout.toString(),
          stderr: stderr.toString()
        });
      });
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
