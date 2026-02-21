const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('sermons-data.json', 'utf8'));

function capitalize(str) {
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function generateBookHTML(book, bookData) {
  const sermons = bookData.sermons;
  const subtitle = bookData.subtitle;
  const bookTitle = capitalize(book.replace(/-/g, ' '));
  const pageTitle = `Sermons from ${bookTitle}`;
  // const subtitle = "Christ-Centered Living in a Sinful World"; // Hardcoded for now, can be in data

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

  const html = `<!DOCTYPE html>
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
        ${subtitleHTML}
        <hr>
        <table style="margin-left:auto; margin-right: auto;">
            <thead>
                <tr>
                    ${hasPassage ? '<th>Passage</th>' : ''}
                    <th>Title</th>
                </tr>
            </thead>
            <tbody>${tableRows}
            </tbody>
        </table>
    </main>
</body>
<footer>
    © 2024 Menez Ministries
</footer>

</html>`;

  return html;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00Z');
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const day = date.getUTCDate();
  return `${month} ${day}`;
}

function updateLibrary(latestSermon) {
  const libraryPath = 'library.html';
  let html = fs.readFileSync(libraryPath, 'utf8');
  const formattedDate = formatDate(latestSermon.date);
  // Replace the href
  html = html.replace(/<a href="[^"]*">/, `<a href="${latestSermon.url}">`);
  // Replace title
  html = html.replace(/<div class="recent-title">\s*[^<]*\s*<\/div>/, `<div class="recent-title">\n                    ${latestSermon.title}\n                </div>`);
  // Replace scripture
  html = html.replace(/<div class="scripture">\s*[^<]*\s*<\/div>/, `<div class="scripture">\n                    ${latestSermon.passage}\n                </div>`);
  // Replace date
  html = html.replace(/<div class="recent-date">\s*[^<]*\s*<\/div>/, `<div class="recent-date">\n                    ${formattedDate}\n                </div>`);
  fs.writeFileSync(libraryPath, html);
}

for (const book in data) {
  const html = generateBookHTML(book, data[book]);
  const filePath = path.join('sermons', `${book}.html`);
  fs.writeFileSync(filePath, html);
  console.log(`Generated ${filePath}`);
}

// Find latest sermon
let latestSermon = null;
let latestDate = null;
for (const book in data) {
  for (const sermon of data[book].sermons) {
    if (sermon.date) {
      const d = new Date(sermon.date + 'T00:00:00Z');
      if (!latestDate || d > latestDate) {
        latestDate = d;
        latestSermon = sermon;
      }
    }
  }
}

if (latestSermon) {
  updateLibrary(latestSermon);
  console.log('Updated library.html with latest sermon');
}