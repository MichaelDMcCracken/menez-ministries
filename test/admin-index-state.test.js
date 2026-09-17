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
  return context.window.__SERMON_ADMIN_TEST_HOOKS__;
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
  const script = loadAdminScript();
  assert.doesNotMatch(script, />Chapter \$\{/);
  assert.doesNotMatch(script, />Verse \$\{/);
});
