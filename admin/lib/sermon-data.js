function cloneData(data) {
  return JSON.parse(JSON.stringify(data || {}));
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePassageReference(passage) {
  if (!passage || typeof passage !== 'string') return { chapter: Infinity, verse: Infinity };
  const match = passage.match(/(\d+)(?::(\d+))?/);
  if (!match) return { chapter: Infinity, verse: Infinity };
  return {
    chapter: Number(match[1]),
    verse: match[2] ? Number(match[2]) : 1,
  };
}

function sortSermonsByReference(sermons) {
  return [...(Array.isArray(sermons) ? sermons : [])].sort((a, b) => {
    const refA = parsePassageReference(a.passage);
    const refB = parsePassageReference(b.passage);
    if (refA.chapter !== refB.chapter) return refA.chapter - refB.chapter;
    return refA.verse - refB.verse;
  });
}

function applySaveSermon(data, payload) {
  const bookSlug = normalizeString(payload.book);
  const title = normalizeString(payload.title);
  const url = normalizeString(payload.url);

  if (!bookSlug || !title || !url) {
    throw new Error('Book slug, sermon title, and URL are required.');
  }

  const subtitle = normalizeString(payload.subtitle);
  const passage = normalizeString(payload.passage);
  const date = normalizeString(payload.date);
  const originalBook = normalizeString(payload.originalBook);
  const sermonIndex = Number.isFinite(payload.sermonIndex)
    ? Number(payload.sermonIndex)
    : (payload.sermonIndex !== undefined ? Number(payload.sermonIndex) : undefined);

  const nextData = cloneData(data);
  if (!nextData[bookSlug]) {
    nextData[bookSlug] = { sermons: [] };
  }
  if (subtitle) {
    nextData[bookSlug].subtitle = subtitle;
  }

  const sermonEntry = { title, url };
  if (passage) sermonEntry.passage = passage;
  if (date) sermonEntry.date = date;

  if (originalBook && Number.isInteger(sermonIndex) && nextData[originalBook] && nextData[originalBook].sermons[sermonIndex]) {
    if (originalBook === bookSlug) {
      nextData[bookSlug].sermons[sermonIndex] = sermonEntry;
    } else {
      nextData[originalBook].sermons.splice(sermonIndex, 1);
      if (nextData[originalBook].sermons.length === 0) {
        delete nextData[originalBook];
      }
      nextData[bookSlug].sermons.push(sermonEntry);
    }
  } else {
    nextData[bookSlug].sermons.push(sermonEntry);
  }

  nextData[bookSlug].sermons = sortSermonsByReference(nextData[bookSlug].sermons);
  return nextData;
}

function applyDeleteSermon(data, payload) {
  const bookSlug = normalizeString(payload.book);
  const sermonIndex = Number(payload.sermonIndex);

  if (!bookSlug || Number.isNaN(sermonIndex) || sermonIndex < 0) {
    throw new Error('Book slug and sermon index are required.');
  }

  const nextData = cloneData(data);
  if (!nextData[bookSlug] || !nextData[bookSlug].sermons[sermonIndex]) {
    throw new Error('Sermon not found.');
  }

  nextData[bookSlug].sermons.splice(sermonIndex, 1);
  if (nextData[bookSlug].sermons.length === 0) {
    delete nextData[bookSlug];
  }

  return nextData;
}

function computeAddedAndUpdated(currentData, baseData) {
  const added = [];
  const updated = [];

  for (const book of Object.keys(currentData || {})) {
    const currentBook = currentData[book];
    const baseBook = baseData ? baseData[book] : undefined;

    if (!baseBook) {
      (currentBook.sermons || []).forEach(sermon => {
        added.push({ book, title: sermon.title, date: sermon.date || '', passage: sermon.passage || '', url: sermon.url });
      });
      continue;
    }

    const baseSermons = Array.isArray(baseBook.sermons) ? baseBook.sermons : [];
    (currentBook.sermons || []).forEach((sermon, index) => {
      const baseSermon = baseSermons[index];
      if (!baseSermon) {
        added.push({ book, title: sermon.title, date: sermon.date || '', passage: sermon.passage || '', url: sermon.url });
        return;
      }
      if (
        sermon.title !== baseSermon.title ||
        sermon.url !== baseSermon.url ||
        sermon.date !== baseSermon.date ||
        sermon.passage !== baseSermon.passage
      ) {
        updated.push({ book, title: sermon.title, date: sermon.date || '', passage: sermon.passage || '', url: sermon.url });
      }
    });
  }

  return { added, updated };
}

function findLatestSermon(data) {
  let latestSermon = null;
  let latestDate = null;

  for (const book of Object.keys(data || {})) {
    for (const sermon of data[book].sermons || []) {
      if (!sermon.date) continue;
      const date = new Date(sermon.date + 'T00:00:00Z');
      if (!latestDate || date > latestDate) {
        latestDate = date;
        latestSermon = sermon;
      }
    }
  }

  return latestSermon;
}

module.exports = {
  applyDeleteSermon,
  applySaveSermon,
  computeAddedAndUpdated,
  findLatestSermon,
  normalizeString,
  parsePassageReference,
  sortSermonsByReference,
};
