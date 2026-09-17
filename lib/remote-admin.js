const { buildSiteFiles } = require('../build');
const {
  applyDeleteSermon,
  applySaveSermon,
  normalizeString,
} = require('./sermon-data');

function defaultCommitMessage(prefix) {
  return `${prefix} (${new Date().toISOString().slice(0, 10)})`;
}

async function loadRemoteRepositoryState(publisher) {
  const [dataText, libraryHtml] = await Promise.all([
    publisher.getFileText('sermons-data.json'),
    publisher.getFileText('library.html'),
  ]);

  return {
    data: JSON.parse(dataText),
    libraryHtml,
  };
}

function serializeDataFile(data) {
  return JSON.stringify(data, null, 2) + '\n';
}

async function publishDataAndSite(publisher, data, libraryHtml, commitMessage) {
  const files = buildSiteFiles(data, libraryHtml);
  files['sermons-data.json'] = serializeDataFile(data);
  return publisher.commitFiles(files, commitMessage);
}

async function saveSermonRemotely(publisher, payload) {
  const { data, libraryHtml } = await loadRemoteRepositoryState(publisher);
  const nextData = applySaveSermon(data, payload);
  const commitMessage = normalizeString(payload.commitMessage) || defaultCommitMessage('Update sermons and generated pages');
  return publishDataAndSite(publisher, nextData, libraryHtml, commitMessage);
}

async function deleteSermonRemotely(publisher, payload) {
  const { data, libraryHtml } = await loadRemoteRepositoryState(publisher);
  const nextData = applyDeleteSermon(data, payload);
  const commitMessage = normalizeString(payload.commitMessage) || defaultCommitMessage('Delete sermon and regenerate pages');
  return publishDataAndSite(publisher, nextData, libraryHtml, commitMessage);
}

async function rebuildSiteRemotely(publisher, payload = {}) {
  const { data, libraryHtml } = await loadRemoteRepositoryState(publisher);
  const files = buildSiteFiles(data, libraryHtml);
  const commitMessage = normalizeString(payload.commitMessage) || defaultCommitMessage('Rebuild generated sermon pages');
  return publisher.commitFiles(files, commitMessage);
}

module.exports = {
  deleteSermonRemotely,
  loadRemoteRepositoryState,
  rebuildSiteRemotely,
  saveSermonRemotely,
};
