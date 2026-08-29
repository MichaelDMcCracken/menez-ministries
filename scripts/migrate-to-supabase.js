/**
 * migrate-to-supabase.js
 *
 * Reads sermons-data.json and inserts all records into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/migrate-to-supabase.js
 *
 * The script is idempotent: it checks for existing sermons by
 * title + book_slug before inserting, so it is safe to re-run.
 */

const fs   = require('fs');
const path = require('path');

const SUPABASE_URL             = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_SERVICE_ROLE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
  'Prefer': 'return=representation',
};

async function supabase(method, path, body) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function detectProvider(url) {
  if (!url) return null;
  if (url.includes('soundcloud.com')) return 'soundcloud';
  if (url.includes('youtu.be') || url.includes('youtube.com')) return 'youtube';
  if (url.includes('vimeo.com')) return 'vimeo';
  return 'other';
}

async function run() {
  const dataPath = path.join(__dirname, '..', 'sermons-data.json');
  const raw = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(raw);

  // Ensure the default speaker exists
  const speakerName = 'Pastor Scott Menez';
  let speakers = await supabase('GET', `/speakers?name=eq.${encodeURIComponent(speakerName)}&select=id`);
  let speakerId;
  if (speakers.length === 0) {
    const [sp] = await supabase('POST', '/speakers', { name: speakerName });
    speakerId = sp.id;
    console.log(`Created speaker: ${speakerName} (${speakerId})`);
  } else {
    speakerId = speakers[0].id;
    console.log(`Speaker already exists: ${speakerName} (${speakerId})`);
  }

  let totalInserted = 0;
  let totalSkipped  = 0;

  for (const [bookSlug, bookData] of Object.entries(data)) {
    const sermonList = bookData.sermons || [];

    // Upsert series/subtitle if the book has one
    let seriesId = null;
    if (bookData.subtitle) {
      let existing = await supabase(
        'GET',
        `/series?book_slug=eq.${encodeURIComponent(bookSlug)}&select=id`
      );
      if (existing.length === 0) {
        const [s] = await supabase('POST', '/series', {
          name: bookSlug,
          book_slug: bookSlug,
          subtitle: bookData.subtitle,
        });
        seriesId = s.id;
        console.log(`  Created series for ${bookSlug}: ${bookData.subtitle}`);
      } else {
        seriesId = existing[0].id;
      }
    }

    console.log(`\nProcessing ${bookSlug} (${sermonList.length} sermons)…`);

    for (const sermon of sermonList) {
      // Check if already migrated (by title + book_slug)
      const encoded = encodeURIComponent(sermon.title);
      const check = await supabase(
        'GET',
        `/sermons?title=eq.${encoded}&book_slug=eq.${encodeURIComponent(bookSlug)}&select=id`
      );
      if (check.length > 0) {
        totalSkipped++;
        continue;
      }

      // Insert sermon
      const [inserted] = await supabase('POST', '/sermons', {
        title:      sermon.title,
        passage:    sermon.passage || null,
        book_slug:  bookSlug,
        date:       sermon.date || null,
        speaker_id: speakerId,
        series_id:  seriesId,
        published:  true,   // existing sermons are all published
      });

      // Insert media link
      if (sermon.url) {
        await supabase('POST', '/media_links', {
          sermon_id: inserted.id,
          url:       sermon.url,
          provider:  detectProvider(sermon.url),
          sort_order: 0,
        });
      }

      totalInserted++;
    }
  }

  console.log(`\n✅ Migration complete: ${totalInserted} inserted, ${totalSkipped} already existed.`);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
