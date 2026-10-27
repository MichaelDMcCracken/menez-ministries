const assert = require('assert');
const test = require('node:test');

const builders = [require('../build'), require('../admin/build')];
const { generateBookHTML, formatFullDate } = builders[0];

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

test('buildSiteFiles links books with sermons in the library', () => {
  const data = {
    galatians: { sermons: [{ title: 'Grace', url: 'https://example.com/grace' }] },
    john: { sermons: [{ title: 'The Word', url: 'https://example.com/word' }] },
  };
  const libraryHtml = [
    '<div class="gr">Galatians</div>',
    '<div class="gr"><a href="sermons/john.html">John</a></div>',
    '<div class="gr">Hebrews</div>',
  ].join('');

  for (const builder of builders) {
    const files = builder.buildSiteFiles(data, libraryHtml);
    assert.match(files['library.html'], /<div class="gr"><a href="sermons\/galatians\.html">Galatians<\/a><\/div>/);
    assert.match(files['library.html'], /<div class="gr"><a href="sermons\/john\.html">John<\/a><\/div>/);
    assert.match(files['library.html'], /<div class="gr">Hebrews<\/div>/);
  }
});
