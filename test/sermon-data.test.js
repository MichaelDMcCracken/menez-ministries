const assert = require('assert');
const test = require('node:test');

const { parsePassageReference, sortSermonsByReference, validateSermonDataset } = require('../lib/sermon-data');

test('parsePassageReference ignores a leading book number like "1" or "2"', () => {
  assert.deepEqual(parsePassageReference('1 Corinthians 5:14–17'), { chapter: 5, verse: 14 });
  assert.deepEqual(parsePassageReference('2 Timothy 3:1'), { chapter: 3, verse: 1 });
});

test('parsePassageReference treats a missing verse as verse 0', () => {
  assert.deepEqual(parsePassageReference('Deuteronomy 4'), { chapter: 4, verse: 0 });
});

test('parsePassageReference treats a chapter-only book reference as chapter 0', () => {
  assert.deepEqual(parsePassageReference('1 Corinthians'), { chapter: 0, verse: 0 });
});

test('sortSermonsByReference orders sermons by starting chapter and verse, chapter-only before verse 1', () => {
  const sermons = [
    { title: 'Ch 2', passage: '1 Corinthians 2:1–5' },
    { title: 'Ch 1 v1', passage: '1 Corinthians 1:1–9' },
    { title: 'Ch 1 only', passage: '1 Corinthians 1' },
    { title: 'Intro', passage: '1 Corinthians' },
  ];

  const sorted = sortSermonsByReference(sermons).map(s => s.title);
  assert.deepEqual(sorted, ['Intro', 'Ch 1 only', 'Ch 1 v1', 'Ch 2']);
});

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
