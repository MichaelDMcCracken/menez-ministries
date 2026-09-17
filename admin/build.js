const fs = require('fs');
const path = require('path');

const {
  sortSermonsByReference,
  findLatestSermon,
} = require('./lib/sermon-data');

function capitalize(str) {
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function generateBookHTML(book, bookData) {
  const sermons = sortSermonsByReference(bookData.sermons);
  const subtitle = bookData.subtitle;
  const bookTitle = capitalize(book.replace(/-/g, ' '));
  const pageTitle = `Sermons from ${bookTitle}`;
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
    <title>${pageTitle}</title>
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
        <h1>${pageTitle}</h1>
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

function buildSiteFiles(data, libraryHtml) {
  const files = {};

  for (const book of Object.keys(data)) {
    files[path.posix.join('sermons', `${book}.html`)] = generateBookHTML(book, data[book]);
  }

  if (libraryHtml) {
    files['library.html'] = updateLibraryHTML(libraryHtml, findLatestSermon(data));
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
  runBuild,
  updateLibraryHTML,
};

if (require.main === module) {
  runBuild();
}
