const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'backup-sermon-data.yml'),
  'utf8',
);

test('sermon data backup runs monthly with repository write access', () => {
  assert.match(workflow, /cron:\s*'0 0 1 \* \*'/);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*write/);
});

test('sermon data backup creates one dated snapshot and skips existing backups', () => {
  assert.match(workflow, /backups\/sermons-data-\$\(date -u \+%Y-%m\)\.json/);
  assert.match(workflow, /cp sermons-data\.json "\$backup_file"/);
  assert.match(workflow, /if \[ -f "\$backup_file" \]; then/);
});
