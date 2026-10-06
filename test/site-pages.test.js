const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('Flat Rabbit Ministries landing-page card links to the ministry page', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<a href="ministry\.html">\s*<div class="card">[\s\S]*?<h2>Flat Rabbit Ministries<\/h2>/);
});

test('landing and sermon library styles use a mobile-friendly background', () => {
  for (const stylesheet of ['cover.css', 'main.css']) {
    const css = fs.readFileSync(path.join(root, 'css', stylesheet), 'utf8');
    assert.match(css, /@media\s*\(max-width:\s*1000px\)\s*\{\s*body\s*\{[^}]*background-image:\s*url\("\.\.\/img\/frm-cover-mobile\.jpg"\);[^}]*background-attachment:\s*scroll;/);
  }
});
