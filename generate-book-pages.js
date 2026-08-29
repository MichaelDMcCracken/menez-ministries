/**
 * generate-book-pages.js
 *
 * Generates a lightweight dynamic HTML shell for every book slug that
 * currently appears in sermons-data.json (plus any additional slugs listed
 * in library.html that don't have sermons yet).
 *
 * Each generated page fetches its sermons live from Supabase at render time,
 * so no rebuild is needed when sermon data changes in the CMS.
 *
 * Run once after setting up Supabase, and whenever you add a new book slug:
 *   node generate-book-pages.js
 */

const fs   = require('fs');
const path = require('path');

const DATA_FILE    = path.join(__dirname, 'sermons-data.json');
const SERMONS_DIR  = path.join(__dirname, 'sermons');

const data   = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const slugs  = Object.keys(data).sort();

function capitalize(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function bookTitle(slug) {
  return capitalize(slug.replace(/-/g, ' '));
}

function generateDynamicPage(slug) {
  const title = bookTitle(slug);
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <title>Sermons from ${title}</title>
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
    <main id="main-content">
        <p>Loading sermons…</p>
    </main>
</body>
<footer>
    © 2024 Menez Ministries
</footer>
<script src="../supabase-config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script>
    (function () {
        const { createClient } = supabase;
        const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Derive book slug from the current filename (e.g. "1-corinthians.html" → "1-corinthians")
        const slug = window.location.pathname.split('/').pop().replace(/\\.html$/, '');

        function capitalize(str) {
            return str.split('-').map(function (p) {
                return p.charAt(0).toUpperCase() + p.slice(1);
            }).join(' ');
        }

        function parsePassageRef(passage) {
            if (!passage) return { chapter: Infinity, verse: Infinity };
            var m = passage.match(/(\\d+)(?::(\\d+))?/);
            if (!m) return { chapter: Infinity, verse: Infinity };
            return { chapter: Number(m[1]), verse: m[2] ? Number(m[2]) : 1 };
        }

        function sortSermons(sermons) {
            return sermons.slice().sort(function (a, b) {
                var ra = parsePassageRef(a.passage);
                var rb = parsePassageRef(b.passage);
                if (ra.chapter !== rb.chapter) return ra.chapter - rb.chapter;
                return ra.verse - rb.verse;
            });
        }

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        async function load() {
            var main = document.getElementById('main-content');
            var bookTitle = capitalize(slug);
            document.title = 'Sermons from ' + bookTitle;

            var { data: rows, error } = await db
                .from('sermons')
                .select('passage, title, url, book_subtitle')
                .eq('book_slug', slug)
                .order('id', { ascending: true });

            if (error || !rows || rows.length === 0) {
                main.innerHTML =
                    '<h1>Sermons from ' + escapeHtml(bookTitle) + '</h1>' +
                    '<hr><p>No sermons found for this book.</p>';
                return;
            }

            var subtitle = rows[0].book_subtitle || '';
            var sorted   = sortSermons(rows);
            var hasPassage = sorted.some(function (s) { return s.passage; });

            var headerCols = hasPassage ? '<th>Passage</th><th>Title</th>' : '<th>Title</th>';
            var rowsHtml = sorted.map(function (s) {
                var passageCell = hasPassage
                    ? '<td>' + escapeHtml(s.passage || '') + '</td>'
                    : '';
                return '<tr>' + passageCell +
                    '<td><a href="' + escapeHtml(s.url) + '">' + escapeHtml(s.title) + '</a></td>' +
                    '</tr>';
            }).join('');

            main.innerHTML =
                '<h1>Sermons from ' + escapeHtml(bookTitle) + '</h1>' +
                (subtitle ? '<h3>' + escapeHtml(subtitle) + '</h3>' : '') +
                '<hr>' +
                '<table style="margin-left:auto; margin-right:auto;">' +
                '<thead><tr>' + headerCols + '</tr></thead>' +
                '<tbody>' + rowsHtml + '</tbody>' +
                '</table>';
        }

        load();
    })();
</script>
</html>
`;
}

let count = 0;
for (const slug of slugs) {
  const html     = generateDynamicPage(slug);
  const filePath = path.join(SERMONS_DIR, `${slug}.html`);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Generated ${filePath}`);
  count++;
}
console.log(`\nDone. Generated ${count} book page(s).`);
