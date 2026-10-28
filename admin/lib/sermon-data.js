function cloneData(data) {
  return JSON.parse(JSON.stringify(data || {}));
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTopics(topics) {
  const seen = new Set();
  return (Array.isArray(topics) ? topics : [])
    .map(normalizeString)
    .filter(topic => {
      const key = topic.toLowerCase();
      if (!topic || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function parsePassageReference(passage) {
  if (!passage || typeof passage !== 'string') return { chapter: Infinity, verse: Infinity };
  const words = passage.trim().split(/\s+/);
  let reference = words[words.length - 1];
  for (const delimiter of ['\u2013', '-']) {
    const rangeStart = reference.indexOf(delimiter);
    if (rangeStart !== -1) reference = reference.slice(0, rangeStart);
  }

  const colon = reference.indexOf(':');
  if (colon !== -1 && colon !== reference.lastIndexOf(':')) return { chapter: 0, verse: 0 };
  const chapterText = colon === -1 ? reference : reference.slice(0, colon);
  const verseText = colon === -1 ? '' : reference.slice(colon + 1);
  const parseNumber = value => {
    if (!value) return null;
    for (let index = 0; index < value.length; index += 1) {
      const digit = value.charCodeAt(index) - 48;
      if (digit < 0 || digit > 9) return null;
    }
    return Number(value);
  };
  const chapter = parseNumber(chapterText);
  const verse = verseText ? parseNumber(verseText) : 0;
  if (chapter === null || verse === null) return { chapter: 0, verse: 0 };

  return {
    chapter,
    verse,
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
  const topics = normalizeTopics(payload.topics);
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
  if (topics.length) sermonEntry.topics = topics;

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
        added.push({ book, title: sermon.title, date: sermon.date || '', passage: sermon.passage || '', topics: normalizeTopics(sermon.topics), url: sermon.url });
      });
      continue;
    }

    const baseSermons = Array.isArray(baseBook.sermons) ? baseBook.sermons : [];
    (currentBook.sermons || []).forEach((sermon, index) => {
      const baseSermon = baseSermons[index];
      if (!baseSermon) {
        added.push({ book, title: sermon.title, date: sermon.date || '', passage: sermon.passage || '', topics: normalizeTopics(sermon.topics), url: sermon.url });
        return;
      }
      if (
        sermon.title !== baseSermon.title ||
        sermon.url !== baseSermon.url ||
        sermon.date !== baseSermon.date ||
        sermon.passage !== baseSermon.passage ||
        JSON.stringify(normalizeTopics(sermon.topics)) !== JSON.stringify(normalizeTopics(baseSermon.topics))
      ) {
        updated.push({ book, title: sermon.title, date: sermon.date || '', passage: sermon.passage || '', topics: normalizeTopics(sermon.topics), url: sermon.url });
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

function validateSermonDataset(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('A complete sermon dataset object is required.');
  }

  const nextData = {};

  for (const [rawBook, rawBookData] of Object.entries(data)) {
    const book = normalizeString(rawBook);
    if (!book) {
      throw new Error('Book slug is required.');
    }
    if (!rawBookData || typeof rawBookData !== 'object' || Array.isArray(rawBookData)) {
      throw new Error(`Book data for "${book}" is invalid.`);
    }

    const sermons = Array.isArray(rawBookData.sermons) ? rawBookData.sermons : null;
    if (!sermons) {
      throw new Error(`Sermons list for "${book}" is required.`);
    }

    const nextBookData = {};
    const subtitle = normalizeString(rawBookData.subtitle);
    if (subtitle) {
      nextBookData.subtitle = subtitle;
    }

    nextBookData.sermons = sermons.map((rawSermon, index) => {
      if (!rawSermon || typeof rawSermon !== 'object' || Array.isArray(rawSermon)) {
        throw new Error(`Sermon ${index + 1} in "${book}" is invalid.`);
      }

      const title = normalizeString(rawSermon.title);
      const url = normalizeString(rawSermon.url);
      if (!title || !url) {
        throw new Error(`Sermon ${index + 1} in "${book}" requires title and URL.`);
      }

      const sermon = { title, url };
      const passage = normalizeString(rawSermon.passage);
      const date = normalizeString(rawSermon.date);
      if (rawSermon.topics !== undefined && !Array.isArray(rawSermon.topics)) {
        throw new Error(`Topics for sermon ${index + 1} in "${book}" must be a list.`);
      }
      const topics = normalizeTopics(rawSermon.topics);
      if (passage) sermon.passage = passage;
      if (date) sermon.date = date;
      if (topics.length) sermon.topics = topics;
      return sermon;
    });

    nextBookData.sermons = sortSermonsByReference(nextBookData.sermons);
    nextData[book] = nextBookData;
  }

  return nextData;
}

module.exports = {
  applyDeleteSermon,
  applySaveSermon,
  computeAddedAndUpdated,
  findLatestSermon,
  normalizeString,
  normalizeTopics,
  parsePassageReference,
  sortSermonsByReference,
  validateSermonDataset,
};
