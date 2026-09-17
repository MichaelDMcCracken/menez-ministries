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

  let tableRows = '';
  sermons.forEach(sermon => {
    const passageCell = sermon.passage ? `<td>${sermon.passage}</td>` : '';
    const titleCell = `<td><a href="${sermon.url}">${sermon.title}</a></td>`;
    tableRows += `
                <tr>
                    ${passageCell}
                    ${titleCell}
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

function updateLibraryHTML(html, latestSermon) {
  if (!latestSermon || !latestSermon.date) {
    return html;
  }

  const formattedDate = formatDate(latestSermon.date);
  let nextHtml = html.replace(/<a id="recent-link"[^>]*href="[^"]*">/, `<a id="recent-link" data-loading="true" href="${latestSermon.url}">`);
  nextHtml = nextHtml.replace(/<div class="recent-title"[^>]*>\s*[^<]*\s*<\/div>/, `<div class="recent-title" id="recent-title">\n                    ${latestSermon.title}\n                </div>`);
  nextHtml = nextHtml.replace(/<div class="scripture"[^>]*>\s*[^<]*\s*<\/div>/, `<div class="scripture" id="recent-passage">\n                    ${latestSermon.passage || ''}\n                </div>`);
  nextHtml = nextHtml.replace(/<div class="recent-date"[^>]*>\s*[^<]*\s*<\/div>/, `<div class="recent-date" id="recent-date">\n                    ${formattedDate}\n                </div>`);
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
  generateBookHTML,
  runBuild,
  updateLibraryHTML,
};

if (require.main === module) {
  runBuild();
}
