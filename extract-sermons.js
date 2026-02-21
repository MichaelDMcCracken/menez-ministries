const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const sermonsDir = 'sermons';
const outputFile = 'sermons-data.json';

const data = {};

fs.readdirSync(sermonsDir).forEach(file => {
  if (path.extname(file) === '.html') {
    const bookSlug = path.basename(file, '.html');
    const filePath = path.join(sermonsDir, file);
    const html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html);
    const sermons = [];
    $('tbody tr').each((i, row) => {
      const tds = $(row).find('td');
      if (tds.length >= 1) {
        const passage = tds.length > 1 ? $(tds[0]).text().trim() : '';
        const a = $(tds[tds.length - 1]).find('a');
        const title = a.text().replace(/\s+/g, ' ').trim();
        const url = a.attr('href');
        if (title && url) {
          sermons.push({ passage, title, url });
        }
      }
    });
    const subtitle = $('main h3').first().text().trim() || null;
    if (sermons.length > 0) {
      data[bookSlug] = { sermons, subtitle };
    }
  }
});

fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
console.log('Extracted sermons data to', outputFile);