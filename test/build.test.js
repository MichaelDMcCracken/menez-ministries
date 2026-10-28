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

test('buildSiteFiles generates topical sermon pages and library links', () => {
  const data = {
    john: {
      sermons: [
        { title: 'The Word', url: 'https://example.com/word', passage: 'John 1:1', topics: ['Faith', 'Marriage'] },
      ],
    },
    various: {
      sermons: [
        { title: 'A General Message', url: 'https://example.com/general', topics: ['faith'] },
      ],
    },
  };
  const libraryHtml = '<div class="gr">Various</div><div class="topic-links"><!-- TOPICS_START --><!-- TOPICS_END --></div>';

  for (const builder of builders) {
    const files = builder.buildSiteFiles(data, libraryHtml);
    assert.match(files['library.html'], /sermons\/various\.html">Various<\/a>/);
    assert.match(files['library.html'], /sermons\/topic-faith\.html">Faith<\/a>/);
    assert.match(files['library.html'], /sermons\/topic-marriage\.html">Marriage<\/a>/);
    assert.match(files['sermons/topic-faith.html'], /Sermons about Faith/);
    assert.match(files['sermons/topic-faith.html'], /The Word/);
    assert.match(files['sermons/topic-faith.html'], /A General Message/);
  }
});

test('buildSiteFiles escapes topic labels and disambiguates matching slugs', () => {
  const data = {
    john: {
      sermons: [
        { title: 'One', url: 'https://example.com/1', topics: ['Faith & Hope', 'Faith Hope'] },
      ],
    },
  };
  const files = builders[0].buildSiteFiles(
    data,
    '<div class="topic-links"><!-- TOPICS_START --><!-- TOPICS_END --></div>',
  );

  assert.ok(files['sermons/topic-faith-hope.html']);
  assert.ok(files['sermons/topic-faith-hope-2.html']);
  assert.match(files['library.html'], /Faith &amp; Hope/);
});

test('buildSiteFiles replaces stale topical links on subsequent builds', () => {
  const firstBuild = builders[0].buildSiteFiles({
    john: { sermons: [{ title: 'The Word', url: 'https://example.com', topics: ['Marriage'] }] },
  }, '<div class="topic-links"><!-- TOPICS_START --><!-- TOPICS_END --></div>');
  const secondBuild = builders[0].buildSiteFiles({
    john: { sermons: [{ title: 'The Word', url: 'https://example.com', topics: ['Parenting'] }] },
  }, firstBuild['library.html']);

  assert.doesNotMatch(secondBuild['library.html'], /topic-marriage/);
  assert.match(secondBuild['library.html'], /topic-parenting/);
});
