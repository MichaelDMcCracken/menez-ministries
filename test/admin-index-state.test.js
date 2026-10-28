const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('vm');

function createElement() {
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    style: {},
    className: '',
    classList: {
      add() {},
      remove() {},
      contains() { return false; },
      toggle() { return false; },
    },
    addEventListener() {},
    setAttribute() {},
    querySelector() { return null; },
    closest() { return null; },
    nextElementSibling: null,
  };
}

function loadAdminScript() {
  const htmlPath = path.join(__dirname, '..', 'admin', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script[^>]*>([\s\S]*)<\/script>/i);
  if (!match) {
    throw new Error('Inline admin script not found');
  }
  return match[1];
}

function loadAdminHooks() {
  const { context } = loadAdminRuntime();
  return context.window.__SERMON_ADMIN_TEST_HOOKS__;
}

function loadAdminRuntime() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, createElement());
      }
      return elements.get(id);
    },
  };

  const context = {
    console,
    document,
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    window: {
      __SERMON_ADMIN_DISABLE_AUTOLOAD__: true,
      addEventListener() {},
    },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    confirm: () => true,
    setTimeout,
    clearTimeout,
  };

  vm.createContext(context);
  vm.runInContext(loadAdminScript(), context);
  return { context, elements };
}

test('resolveStagedState restores when base signature matches', () => {
  const hooks = loadAdminHooks();
  const staged = { baseSignature: 'abc', workingData: { john: { sermons: [] } } };
  const result = hooks.resolveStagedState(staged, 'abc');
  assert.equal(result.action, 'restore');
  assert.deepEqual(result.workingData, staged.workingData);
});

test('resolveStagedState discards when base signature differs', () => {
  const hooks = loadAdminHooks();
  const staged = { baseSignature: 'abc', workingData: { john: { sermons: [] } } };
  const result = hooks.resolveStagedState(staged, 'xyz');
  assert.equal(result.action, 'discard');
});

test('chapter and verse option labels are numeric-only', () => {
  const { context, elements } = loadAdminRuntime();
  elements.get('book').value = 'genesis';
  context.renderChapterOptions();

  assert.match(elements.get('start-chapter').innerHTML, /<option value="1">1<\/option>/);
  assert.doesNotMatch(elements.get('start-chapter').innerHTML, />Chapter /);
  assert.match(elements.get('start-verse').innerHTML, /<option value="1">1<\/option>/);
  assert.doesNotMatch(elements.get('start-verse').innerHTML, />Verse /);
  assert.match(elements.get('end-chapter').innerHTML, /<option value="1">1<\/option>/);
  assert.doesNotMatch(elements.get('end-chapter').innerHTML, />Chapter /);

  elements.get('end-chapter').value = '1';
  context.updateEndVerseOptions();
  assert.match(elements.get('end-verse').innerHTML, /<option value="1">1<\/option>/);
  assert.doesNotMatch(elements.get('end-verse').innerHTML, />Verse /);
});

test('admin topic input accepts new comma-separated tags and publishes them', () => {
  const hooks = loadAdminHooks();

  assert.deepEqual(Array.from(hooks.parseTopicInput(' Marriage, parenting, marriage, ')), ['Marriage', 'parenting']);
  assert.deepEqual(
    JSON.parse(JSON.stringify(hooks.sanitizeForPublish({
      john: {
        sermons: [{ title: 'The Word', url: 'https://example.com', topics: ['Marriage', 'Parenting'] }],
      },
    }))),
    {
      john: {
        sermons: [{ title: 'The Word', url: 'https://example.com', topics: ['Marriage', 'Parenting'] }],
      },
    },
  );
});

test('legacy admin page loads and saves comma-separated topic tags', () => {
  const htmlPath = path.join(__dirname, '..', 'admin.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /<label for="topics">Topics \(optional\)<\/label>\s*<input id="topics" name="topics"/);
  assert.match(html, /document\.getElementById\('topics'\)\.value = Array\.isArray\(sermon\.topics\) \? sermon\.topics\.join\(', '\) : '';/);
  assert.match(html, /topics: document\.getElementById\('topics'\)\.value\.split\(','\)\.map\(topic => topic\.trim\(\)\)\.filter\(Boolean\)/);
});

test('admin topic suggestions use an accessible custom menu instead of a native datalist', () => {
  const htmlPath = path.join(__dirname, '..', 'admin', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /id="topics"[^>]*role="combobox"[^>]*aria-autocomplete="list"[^>]*aria-controls="topic-suggestions"/);
  assert.match(html, /id="topic-suggestions" class="topic-suggestions" role="listbox"[^>]*hidden/);
  assert.doesNotMatch(html, /<datalist\b/);
  assert.match(html, /\.topic-suggestions\s*\{[^}]*background:\s*#fff;/);
  assert.match(html, /\.topic-suggestions li\s*\{[^}]*color:\s*#111;/);
});

test('custom topic suggestions filter existing tags by the current prefix', () => {
  const hooks = loadAdminHooks();

  assert.deepEqual(
    Array.from(hooks.filterTopicSuggestions(['Marriage', 'Parenting', 'Faith'], '')),
    ['Marriage', 'Parenting', 'Faith'],
  );
  assert.deepEqual(
    Array.from(hooks.filterTopicSuggestions(['Marriage', 'Parenting', 'Faith'], '   ')),
    ['Marriage', 'Parenting', 'Faith'],
  );
  assert.deepEqual(
    Array.from(hooks.filterTopicSuggestions(['Marriage', 'Parenting', 'Faith'], 'mar')),
    ['Marriage'],
  );
  assert.deepEqual(Array.from(hooks.filterTopicSuggestions(['Marriage'], 'marriage')), []);
});
