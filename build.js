const fs = require('fs');
const path = require('path');

const {
  sortSermonsByReference,
  findLatestSermon,
} = require('./lib/sermon-data');

function capitalize(str) {
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function generateBookHTML(book, bookData, options = {}) {
  const sermons = sortSermonsByReference(bookData.sermons);
  const subtitle = bookData.subtitle;
  const bookTitle = options.heading || capitalize(book.replace(/-/g, ' '));
  const pageTitle = options.pageTitle || `Sermons from ${bookTitle}`;
  const hasPassage = sermons.some(s => s.passage);
  const hasDate = sermons.some(s => s.date);

  let tableRows = '';
  sermons.forEach(sermon => {
    const passageCell = sermon.passage ? `<td>${sermon.passage}</td>` : '';
    const titleCell = `<td><a href="${sermon.url}">${sermon.title}</a></td>`;
    const dateCell = hasDate ? `<td class="date-cell">${sermon.date ? formatFullDate(sermon.date) : ''}</td>` : '';
    tableRows += `
                <tr>
                    ${passageCell}
                    ${titleCell}
                    ${dateCell}
                </tr>`;
  });

  const subtitleHTML = subtitle ? `<h3>${subtitle}</h3>` : '';

  return `<!DOCTYPE html>
<html lang="en">

<head>
    <title>${escapeHTML(pageTitle)}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="../css/main.css">
    <link rel="stylesheet" href="https://use.typekit.net/vod1yaf.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap" rel="stylesheet">
</head>
<body>
    <a href="../library.html">
        <div class="banner">
            <h1>Sermon Library</h1>
            <h3>Pastor Scott Menez</h3>
        </div>
    </a>
    <main>
        <h1>${escapeHTML(pageTitle)}</h1>
        <div id="subtitle-area">${subtitleHTML}</div>
        <hr>
        <div id="sermon-list">
        <table style="margin-left:auto; margin-right: auto;">
            <thead>
                <tr>
                    ${hasPassage ? '<th>Passage</th>' : ''}
                    <th>Title</th>
                    ${hasDate ? '<th>Date</th>' : ''}
                </tr>
            </thead>
            <tbody id="sermons-tbody">${tableRows}
            </tbody>
        </table>
        </div>
    </main>
</body>
<footer>
    © 2024 Menez Ministries
</footer>
</html>`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00Z');
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const day = date.getUTCDate();
  return `${month} ${day}`;
}

function formatFullDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function replaceTag(html, marker, replacement) {
  const start = html.indexOf(marker);
  if (start === -1) {
    return html;
  }

  const end = html.indexOf('>', start);
  if (end === -1) {
    return html;
  }

  return html.slice(0, start) + replacement + html.slice(end + 1);
}

function replaceDivBlock(html, className, id, value) {
  const marker = `<div class="${className}"`;
  const start = html.indexOf(marker);
  if (start === -1) {
    return html;
  }

  const contentStart = html.indexOf('>', start);
  if (contentStart === -1) {
    return html;
  }

  const end = html.indexOf('</div>', contentStart);
  if (end === -1) {
    return html;
  }

  return html.slice(0, start) +
    `<div class="${className}" id="${id}">\n                    ${value}\n                </div>` +
    html.slice(end + '</div>'.length);
}

function updateLibraryHTML(html, latestSermon) {
  if (!latestSermon || !latestSermon.date) {
    return html;
  }

  const formattedDate = formatDate(latestSermon.date);
  let nextHtml = replaceTag(html, '<a id="recent-link"', `<a id="recent-link" data-loading="true" href="${latestSermon.url}">`);
  nextHtml = replaceDivBlock(nextHtml, 'recent-title', 'recent-title', latestSermon.title);
  nextHtml = replaceDivBlock(nextHtml, 'scripture', 'recent-passage', latestSermon.passage || '');
  nextHtml = replaceDivBlock(nextHtml, 'recent-date', 'recent-date', formattedDate);
  return nextHtml;
}

function updateBookLinks(html, data) {
  const booksByName = new Map(
    Object.keys(data).map(book => [book.replace(/-/g, ' ').toLowerCase(), book]),
  );
  const marker = '<div class="gr">';
  const closingTag = '</div>';
  const parts = [];
  let cursor = 0;

  while (cursor < html.length) {
    const start = html.indexOf(marker, cursor);
    if (start === -1) break;

    const contentStart = start + marker.length;
    const end = html.indexOf(closingTag, contentStart);
    if (end === -1) break;

    const content = html.slice(contentStart, end);
    const book = content.includes('<')
      ? undefined
      : booksByName.get(content.trim().toLowerCase());

    parts.push(html.slice(cursor, contentStart));
    if (book) {
      const label = content.trim().replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]);
      parts.push(`<a href="sermons/${encodeURIComponent(book)}.html">${label}</a>`);
    } else {
      parts.push(content);
    }
    parts.push(closingTag);
    cursor = end + closingTag.length;
  }

  parts.push(html.slice(cursor));
  return parts.join('');
}

function getTopicEntries(data) {
  const topicLabels = new Map();
  for (const bookData of Object.values(data)) {
    for (const sermon of bookData.sermons || []) {
      for (const topic of Array.isArray(sermon.topics) ? sermon.topics : []) {
        const label = typeof topic === 'string' ? topic.trim() : '';
        if (label && !topicLabels.has(label.toLowerCase())) {
          topicLabels.set(label.toLowerCase(), label);
        }
      }
    }
  }

  const usedSlugs = new Set();
  return [...topicLabels.values()].sort((a, b) => a.localeCompare(b)).map(label => {
    const baseSlug = label.toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'topic';
    let slug = baseSlug;
    let suffix = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }
    usedSlugs.add(slug);
    return { label, slug };
  });
}

function updateTopicLinks(html, topicEntries) {
  const startMarker = '<!-- TOPICS_START -->';
  const endMarker = '<!-- TOPICS_END -->';
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1) return html;
  const links = topicEntries.map(({ label, slug }) =>
    `<div class="gr"><a href="sermons/topic-${slug}.html">${escapeHTML(label)}</a></div>`,
  ).join('\n                ');
  const contentStart = start + startMarker.length;
  return html.slice(0, contentStart) + links + html.slice(end);
}

function buildSiteFiles(data, libraryHtml) {
  const files = {};

  for (const book of Object.keys(data)) {
    files[path.posix.join('sermons', `${book}.html`)] = generateBookHTML(book, data[book]);
  }

  const topicEntries = getTopicEntries(data);
  for (const { label, slug } of topicEntries) {
    const sermons = Object.values(data).flatMap(bookData =>
      (bookData.sermons || []).filter(sermon =>
        (Array.isArray(sermon.topics) ? sermon.topics : [])
          .some(topic => typeof topic === 'string' && topic.trim().toLowerCase() === label.toLowerCase()),
      ),
    );
    files[path.posix.join('sermons', `topic-${slug}.html`)] = generateBookHTML(
      slug,
      { sermons },
      { heading: label, pageTitle: `Sermons about ${label}` },
    );
  }

  if (libraryHtml) {
    const updatedLibrary = updateLibraryHTML(libraryHtml, findLatestSermon(data));
    files['library.html'] = updateTopicLinks(updateBookLinks(updatedLibrary, data), topicEntries);
  }

  return files;
}

function runBuild(options = {}) {
  const dataPath = options.dataPath || path.join(process.cwd(), 'sermons-data.json');
  const libraryPath = options.libraryPath || path.join(process.cwd(), 'library.html');
  const sermonsDir = options.sermonsDir || path.join(process.cwd(), 'sermons');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const libraryHtml = fs.readFileSync(libraryPath, 'utf8');
  const files = buildSiteFiles(data, libraryHtml);

  for (const [filePath, contents] of Object.entries(files)) {
    const absolutePath = filePath === 'library.html'
      ? libraryPath
      : path.join(sermonsDir, path.basename(filePath));
    fs.writeFileSync(absolutePath, contents);
    if (filePath !== 'library.html') {
      console.log(`Generated ${filePath}`);
    }
  }

  if (files['library.html']) {
    console.log('Updated library.html with latest sermon');
  }

  return files;
}

module.exports = {
  buildSiteFiles,
  formatDate,
  formatFullDate,
  generateBookHTML,
  getTopicEntries,
  runBuild,
  updateLibraryHTML,
};

if (require.main === module) {
  runBuild();
}
