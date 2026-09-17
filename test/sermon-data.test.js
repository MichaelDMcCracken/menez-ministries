const assert = require('assert');
const test = require('node:test');

const { validateSermonDataset } = require('../lib/sermon-data');

test('validateSermonDataset trims and preserves compatible sermon data', () => {
  const result = validateSermonDataset({
    john: {
      subtitle: '  The Gospel  ',
      sermons: [
        { title: '  The Word  ', url: ' https://example.com/sermon ', passage: ' John 1:1 ', date: ' 2026-09-01 ' },
      ],
    },
  });

  assert.deepEqual(result, {
    john: {
      subtitle: 'The Gospel',
      sermons: [
        { title: 'The Word', url: 'https://example.com/sermon', passage: 'John 1:1', date: '2026-09-01' },
      ],
    },
  });
});

test('validateSermonDataset rejects invalid top-level payloads', () => {
  assert.throws(
    () => validateSermonDataset([]),
    /complete sermon dataset object is required/i,
  );
});

test('validateSermonDataset requires sermon title and URL', () => {
  assert.throws(
    () => validateSermonDataset({
      john: {
        sermons: [
          { title: '', url: 'https://example.com/sermon' },
        ],
      },
    }),
    /requires title and URL/i,
  );
});
