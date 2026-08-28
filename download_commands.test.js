const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'case.js'), 'utf8');

test('generic WhatsApp download uses normalized quoted media download when available', () => {
  assert.match(source, /typeof m\.quoted\.download === 'function'/);
  assert.match(source, /await m\.quoted\.download\(\)/);
  assert.match(source, /m\.quoted\.msg\?\.mimetype/);
  assert.match(source, /WhatsApp quoted download error/);
});

test('YouTube audio handlers use current provider downloadUrl response fields', () => {
  assert.match(source, /api\.bk9\.dev\/download\/ytmp3/);
  assert.match(source, /result\?\.downloadUrl \|\| result\?\.download_url/);
  assert.match(source, /audioData\?\.BK9\?\.downloadUrl/);
  assert.match(source, /fetchMediaBuffer\(downloadUrl/);
});

test('Facebook handler uses the active BK9 fb route and normalizes SD video URLs', () => {
  assert.match(source, /api\.bk9\.dev\/download\/fb/);
  assert.match(source, /facebookResult\?\.sdVideo \|\| facebookResult\?\.sd/);
  assert.match(source, /const fbvid = sdVideo/);
  assert.match(source, /url: fbvid/);
});

test('Instagram handler avoids the dead Vercel endpoint and handles provider messages', () => {
  assert.match(source, /api\.bk9\.dev\/download\/instagram/);
  assert.doesNotMatch(source, /delirius-apiofc\.vercel\.app\/download\/instagram/);
  assert.match(source, /Instagram media is unavailable for this link/);
});
