const fs   = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('sermons-data.json', 'utf8'));

function capitalize(str) {
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function parsePassageReference(passage) {
  if (!passage || typeof passage !== 'string') return { chapter: Infinity, verse: Infinity };
  const firstMatch = passage.match(/(\d+)(?::(\d+))?/);
  if (!firstMatch) return { chapter: Infinity, verse: Infinity };
  const chapter = Number(firstMatch[1]);
  const verse = firstMatch[2] ? Number(firstMatch[2]) : 1;
  return { chapter, verse };
}

function sortSermonsByReference(sermons) {
  return [...sermons].sort((a, b) => {
    const refA = parsePassageReference(a.passage);
    const refB = parsePassageReference(b.passage);
    if (refA.chapter !== refB.chapter) return refA.chapter - refB.chapter;
    return refA.verse - refB.verse;
  });
}

function generateBookHTML(book, bookData) {
  const sermons   = sortSermonsByReference(bookData.sermons);
  const subtitle  = bookData.subtitle;
  const bookTitle = capitalize(book.replace(/-/g, ' '));
  const pageTitle = `Sermons from ${bookTitle}`;
  const hasPassage = sermons.some(s => s.passage);

  let tableRows = '';
  sermons.forEach(sermon => {
    const passageCell = sermon.passage ? `<td>${sermon.passage}</td>` : '';
    const titleCell   = `<td><a href="${sermon.url}">${sermon.title}</a></td>`;
    tableRows += `
                <tr>
                    ${passageCell}
                    ${titleCell}
                </tr>`;
  });

  const subtitleHTML = subtitle ? `<h3>${subtitle}</h3>` : '';

  // The static table is the fallback; the Supabase loader will replace it if configured
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
    <script src="../js/supabase-config.js"></script>
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
<script>
  // Dynamic Supabase loader — replaces static content when Supabase is configured
  (function () {
    var BOOK_SLUG = '${book}';
    var config = window.__SUPABASE_CONFIG__;
    if (!config || !config.url || !config.anonKey) return;

    var url = config.url;
    var key = config.anonKey;

    function supabaseGet(path) {
      return fetch(url + '/rest/v1' + path, {
        headers: {
          'apikey': key,
          'Authorization': 'Bearer ' + key,
        }
      }).then(function (r) { return r.json(); });
    }

    supabaseGet(
      '/sermons?book_slug=eq.' + encodeURIComponent(BOOK_SLUG) +
      '&published=eq.true&select=id,title,passage&order=passage.asc,title.asc'
    ).then(function (sermons) {
      if (!sermons || !sermons.length) return;

      var ids = sermons.map(function (s) { return s.id; });
      supabaseGet(
        '/media_links?sermon_id=in.(' + ids.join(',') + ')&select=sermon_id,url,sort_order&order=sort_order.asc'
      ).then(function (links) {
        var mediaMap = {};
        (links || []).forEach(function (l) {
          if (!mediaMap[l.sermon_id]) mediaMap[l.sermon_id] = [];
          mediaMap[l.sermon_id].push(l.url);
        });

        // Also fetch series subtitle
        supabaseGet('/series?book_slug=eq.' + encodeURIComponent(BOOK_SLUG) + '&select=subtitle').then(function (series) {
          var sub = series && series[0] && series[0].subtitle;
          var subArea = document.getElementById('subtitle-area');
          if (subArea && sub) subArea.innerHTML = '<h3>' + escHtml(sub) + '</h3>';
        }).catch(function(){});

        var tbody = document.getElementById('sermons-tbody');
        var hasPass = sermons.some(function(s){ return s.passage; });

        // Update table header
        var thead = document.querySelector('table thead tr');
        if (thead && hasPass && thead.children.length === 1) {
          thead.insertAdjacentHTML('afterbegin', '<th>Passage</th>');
        }

        var rows = '';
        sermons.forEach(function (s) {
          var passCell = s.passage ? '<td>' + escHtml(s.passage) + '</td>' : (hasPass ? '<td></td>' : '');
          var urls = mediaMap[s.id] || [];
          var titleCell;
          if (urls.length > 0) {
            titleCell = '<td><a href="' + escAttr(urls[0]) + '">' + escHtml(s.title) + '</a>';
            if (urls.length > 1) {
              titleCell += ' ' + urls.slice(1).map(function(u,i){
                return '<a href="' + escAttr(u) + '" style="font-size:.85em;margin-left:6px">[' + (i+2) + ']</a>';
              }).join('');
            }
            titleCell += '</td>';
          } else {
            titleCell = '<td>' + escHtml(s.title) + '</td>';
          }
          rows += '<tr>' + passCell + titleCell + '</tr>';
        });
        if (tbody) tbody.innerHTML = rows;
      });
    }).catch(function(){});

    function escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function escAttr(s) {
      return String(s).replace(/"/g,'&quot;');
    }
  })();
</script>
</html>`;

  return html;
}

function formatDate(dateStr) {
  const date  = new Date(dateStr + 'T00:00:00Z');
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const day   = date.getUTCDate();
  return `${month} ${day}`;
}

function updateLibrary(latestSermon) {
  const libraryPath = 'library.html';
  let html = fs.readFileSync(libraryPath, 'utf8');
  const formattedDate = formatDate(latestSermon.date);
  // Target the specific recent-link anchor by id
  html = html.replace(/<a id="recent-link"[^>]*href="[^"]*">/, `<a id="recent-link" data-loading="true" href="${latestSermon.url}">`);
  html = html.replace(/<div class="recent-title"[^>]*>\s*[^<]*\s*<\/div>/, `<div class="recent-title" id="recent-title">\n                    ${latestSermon.title}\n                </div>`);
  html = html.replace(/<div class="scripture"[^>]*>\s*[^<]*\s*<\/div>/, `<div class="scripture" id="recent-passage">\n                    ${latestSermon.passage}\n                </div>`);
  html = html.replace(/<div class="recent-date"[^>]*>\s*[^<]*\s*<\/div>/, `<div class="recent-date" id="recent-date">\n                    ${formattedDate}\n                </div>`);
  fs.writeFileSync(libraryPath, html);
}

for (const book in data) {
  const html     = generateBookHTML(book, data[book]);
  const filePath = path.join('sermons', `${book}.html`);
  fs.writeFileSync(filePath, html);
  console.log(`Generated ${filePath}`);
}

// Find latest sermon
let latestSermon = null;
let latestDate   = null;
for (const book in data) {
  for (const sermon of data[book].sermons) {
    if (sermon.date) {
      const d = new Date(sermon.date + 'T00:00:00Z');
      if (!latestDate || d > latestDate) {
        latestDate   = d;
        latestSermon = sermon;
      }
    }
  }
}

if (latestSermon) {
  updateLibrary(latestSermon);
  console.log('Updated library.html with latest sermon');
}
