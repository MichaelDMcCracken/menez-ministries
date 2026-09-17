const assert = require('assert');
const test = require('node:test');

const { generateBookHTML, formatFullDate } = require('../build');

test('formatFullDate renders a human readable month, day, and year', () => {
  assert.equal(formatFullDate('2026-03-15'), 'Mar 15, 2026');
});

test('generateBookHTML only adds a Date column when a sermon has a date', () => {
  const withoutDates = generateBookHTML('john', {
    sermons: [{ title: 'The Word', url: 'https://example.com', passage: 'John 1:1' }],
  });
  assert.ok(!withoutDates.includes('<th>Date</th>'));

  const withDates = generateBookHTML('john', {
    sermons: [{ title: 'The Word', url: 'https://example.com', passage: 'John 1:1', date: '2026-03-15' }],
  });
  assert.ok(withDates.includes('<th>Date</th>'));
  assert.ok(withDates.includes('Mar 15, 2026'));
});

test('generateBookHTML orders sermons by starting chapter and verse', () => {
  const html = generateBookHTML('john', {
    sermons: [
      { title: 'Second', url: 'https://example.com/2', passage: 'John 3:16' },
      { title: 'First', url: 'https://example.com/1', passage: 'John 1:1' },
    ],
  });

  assert.ok(html.indexOf('First') < html.indexOf('Second'));
});
