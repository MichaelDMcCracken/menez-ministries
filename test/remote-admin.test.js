const assert = require('assert');
const test = require('node:test');

const { publishChangesRemotely } = require('../lib/remote-admin');

test('publishChangesRemotely validates and commits staged dataset in one operation', async () => {
  const calls = [];
  let committedFiles = null;
  let committedMessage = null;
  const publisher = {
    async getFileText(filePath) {
      calls.push(['getFileText', filePath]);
      if (filePath === 'sermons-data.json') {
        return JSON.stringify({ john: { sermons: [] } });
      }
      if (filePath === 'library.html') {
        return '<a id="recent-link"></a><div class="recent-title"></div><div class="scripture"></div><div class="recent-date"></div>';
      }
      throw new Error('Unexpected file');
    },
    async commitFiles(files, message) {
      calls.push(['commitFiles', Object.keys(files), message]);
      committedFiles = files;
      committedMessage = message;
      return { changed: true, commitSha: 'abc123', branch: 'main' };
    },
  };

  const result = await publishChangesRemotely(publisher, {
    data: {
      john: {
        sermons: [
          { title: 'Sermon', url: 'https://example.com/audio', passage: 'John 3:16' },
        ],
      },
    },
    commitMessage: 'Publish staged sermons',
  });

  assert.equal(result.changed, true);
  assert.equal(calls.filter(call => call[0] === 'commitFiles').length, 1);
  assert.equal(committedMessage, 'Publish staged sermons');
  assert.ok(typeof committedFiles['sermons-data.json'] === 'string');
  assert.match(committedFiles['sermons-data.json'], /"john"/);
  assert.match(committedFiles['sermons-data.json'], /"Sermon"/);
});

test('publishChangesRemotely rejects invalid staged dataset payload', async () => {
  const publisher = {
    async getFileText() {
      return '';
    },
    async commitFiles() {
      return {};
    },
  };

  await assert.rejects(
    publishChangesRemotely(publisher, { data: [] }),
    /complete sermon dataset object is required/i,
  );
});

test('publishChangesRemotely uses default commit message when omitted', async () => {
  let committedMessage = '';
  const publisher = {
    async getFileText(filePath) {
      if (filePath === 'sermons-data.json') return JSON.stringify({ john: { sermons: [] } });
      if (filePath === 'library.html') return '<html></html>';
      throw new Error('Unexpected file');
    },
    async commitFiles(_files, message) {
      committedMessage = message;
      return { changed: true, commitSha: 'def456', branch: 'main' };
    },
  };

  await publishChangesRemotely(publisher, {
    data: {
      john: { sermons: [{ title: 'Sermon', url: 'https://example.com/sermon' }] },
    },
  });

  assert.match(
    committedMessage,
    /^Publish staged sermon changes \(\d{4}-\d{2}-\d{2}\)$/,
  );
});
