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
 * Idempotency strategy (no per-row GET requests):
 *   1. Fetch ALL existing sermon rows once (title + book_slug).
 *   2. Fetch ALL existing media_link rows once (sermon_id + url).
 *   3. Compute the sets of new rows to insert in memory.
 *   4. Batch-insert sermons in one POST, then batch-insert media links in one POST.
 *
 * This reduces ~1,700 sequential HTTP calls to ~6 total, regardless of corpus size.
 */

const fs   = require('fs');
const path = require('path');

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'apikey':        SUPABASE_SERVICE_ROLE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
};

async function supabaseRequest(method, endpoint, body, extraHeaders) {
  const url  = `${SUPABASE_URL}/rest/v1${endpoint}`;
  const opts = {
    method,
    headers: Object.assign({}, BASE_HEADERS, extraHeaders),
  };
  if (body !== undefined && body !== null) {
    opts.body = JSON.stringify(body);
  }
  const res  = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${method} ${endpoint} → HTTP ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Fetch every row of a table using range-paging to avoid the default 1 000-row limit. */
async function fetchAll(endpoint) {
  const pageSize = 1000;
  let offset = 0;
  const all  = [];
  while (true) {
    const rows = await supabaseRequest(
      'GET',
      `${endpoint}&limit=${pageSize}&offset=${offset}`,
      null,
      { 'Range-Unit': 'items', 'Prefer': 'count=none' },
    );
    if (!rows || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

function detectProvider(url) {
  if (!url) return null;
  if (url.includes('soundcloud.com'))                      return 'soundcloud';
  if (url.includes('youtu.be') || url.includes('youtube.com')) return 'youtube';
  if (url.includes('vimeo.com'))                           return 'vimeo';
  return 'other';
}

async function run() {
  const dataPath = path.join(__dirname, '..', 'sermons-data.json');
  const raw  = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(raw);

  // ── 1. Ensure the default speaker exists (1 GET + optional 1 POST) ───────
  const speakerName = 'Pastor Scott Menez';
  console.log('Checking speaker…');
  const existingSpeakers = await supabaseRequest(
    'GET',
    `/speakers?name=eq.${encodeURIComponent(speakerName)}&select=id`,
  );
  let speakerId;
  if (existingSpeakers.length === 0) {
    const [sp] = await supabaseRequest('POST', '/speakers', { name: speakerName }, { 'Prefer': 'return=representation' });
    speakerId  = sp.id;
    console.log(`  Created speaker: ${speakerName} (${speakerId})`);
  } else {
    speakerId = existingSpeakers[0].id;
    console.log(`  Speaker exists: ${speakerName} (${speakerId})`);
  }

  // ── 2. Upsert series for books that have a subtitle (1 GET + ≤N POSTs) ───
  console.log('\nChecking series…');
  const existingSeriesRows = await fetchAll('/series?select=id,book_slug');
  const existingSeriesBySlug = Object.fromEntries(
    existingSeriesRows.map(s => [s.book_slug, s.id]),
  );
  const seriesIdBySlug = {};

  for (const [bookSlug, bookData] of Object.entries(data)) {
    if (!bookData.subtitle) continue;
    if (existingSeriesBySlug[bookSlug]) {
      seriesIdBySlug[bookSlug] = existingSeriesBySlug[bookSlug];
    } else {
      const [s] = await supabaseRequest(
        'POST',
        '/series',
        { name: bookSlug, book_slug: bookSlug, subtitle: bookData.subtitle },
        { 'Prefer': 'return=representation' },
      );
      seriesIdBySlug[bookSlug] = s.id;
      console.log(`  Created series for ${bookSlug}: ${bookData.subtitle}`);
    }
  }

  // ── 3. Fetch all existing sermons in one request ──────────────────────────
  console.log('\nFetching existing sermons…');
  const existingSermons = await fetchAll('/sermons?select=id,title,book_slug');
  // Build a Set of "title|book_slug" keys for fast lookup
  const existingSermonKeys = new Set(
    existingSermons.map(s => `${s.title}|${s.book_slug}`),
  );
  console.log(`  Found ${existingSermons.length} existing sermon(s).`);

  // ── 4. Build list of sermons to insert ────────────────────────────────────
  const sermonsToInsert = [];
  for (const [bookSlug, bookData] of Object.entries(data)) {
    for (const sermon of bookData.sermons || []) {
      const key = `${sermon.title}|${bookSlug}`;
      if (existingSermonKeys.has(key)) continue;
      sermonsToInsert.push({
        title:      sermon.title,
        passage:    sermon.passage || null,
        book_slug:  bookSlug,
        date:       sermon.date || null,
        speaker_id: speakerId,
        series_id:  seriesIdBySlug[bookSlug] || null,
        published:  true,
        // store original URL temporarily so we can build media_links below;
        // this field does NOT exist in the DB — removed before insert
        _url: sermon.url || null,
      });
    }
  }

  console.log(`\n${sermonsToInsert.length} new sermon(s) to insert, ${existingSermonKeys.size} already exist.`);

  let totalInserted = 0;
  let totalMediaInserted = 0;

  if (sermonsToInsert.length > 0) {
    // ── 5. Batch-insert all new sermons in one POST ─────────────────────────
    // Strip the temporary _url field before sending to Supabase
    const dbRows = sermonsToInsert.map(({ _url, ...row }) => row); // eslint-disable-line no-unused-vars

    console.log('Inserting sermons…');
    const inserted = await supabaseRequest(
      'POST',
      '/sermons',
      dbRows,
      { 'Prefer': 'return=representation' },
    );
    totalInserted = inserted.length;
    console.log(`  Inserted ${totalInserted} sermon(s).`);

    // Build a map from "title|book_slug" → inserted id so we can create media links
    const insertedIdMap = Object.fromEntries(
      inserted.map(s => [`${s.title}|${s.book_slug}`, s.id]),
    );

    // ── 6. Fetch all existing media links in one request ────────────────────
    console.log('Fetching existing media links…');
    const existingLinks = await fetchAll('/media_links?select=sermon_id,url');
    const existingLinkKeys = new Set(
      existingLinks.map(l => `${l.sermon_id}|${l.url}`),
    );

    // ── 7. Build list of media links to insert ───────────────────────────────
    const mediaToInsert = [];
    for (const sermon of sermonsToInsert) {
      if (!sermon._url) continue;
      const sermonId = insertedIdMap[`${sermon.title}|${sermon.book_slug}`];
      if (!sermonId) continue;
      const linkKey = `${sermonId}|${sermon._url}`;
      if (existingLinkKeys.has(linkKey)) continue;
      mediaToInsert.push({
        sermon_id:  sermonId,
        url:        sermon._url,
        provider:   detectProvider(sermon._url),
        sort_order: 0,
      });
    }

    // ── 8. Batch-insert all media links in one POST ──────────────────────────
    if (mediaToInsert.length > 0) {
      console.log('Inserting media links…');
      await supabaseRequest(
        'POST',
        '/media_links',
        mediaToInsert,
        { 'Prefer': 'return=minimal' },
      );
      totalMediaInserted = mediaToInsert.length;
      console.log(`  Inserted ${totalMediaInserted} media link(s).`);
    }
  } else {
    // Still fetch media links to report any that might be missing for existing sermons
    console.log('No new sermons to insert.');
  }

  console.log(
    `\n✅ Migration complete: ${totalInserted} sermon(s) inserted, ` +
    `${totalMediaInserted} media link(s) inserted, ` +
    `${existingSermonKeys.size} sermon(s) already existed (skipped).`,
  );
}

run().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
