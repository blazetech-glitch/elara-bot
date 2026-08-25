const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const path = require('node:path');
const botSource = fs.readFileSync(path.join(__dirname, 'bot.js'), 'utf8');
const pairSource = fs.readFileSync(path.join(__dirname, 'pair.js'), 'utf8');

test('Telegram exposes /restart and scopes it to owned pairs', () => {
  assert.match(botSource, /\{ command: 'restart', description: 'Restart your WhatsApp pair' \}/);
  assert.match(botSource, /bot\.onText\(\/\^\\\/restart/);
  assert.match(botSource, /getOwnedPairNumbers\(msg\.from\.id\)/);
  assert.match(botSource, /pair\.restartSession\(number/);
  assert.match(botSource, /You can only restart a WhatsApp pair owned by your Telegram account/);
});

test('pair worker exports restartSession and skips automatic reconnect during manual restart', () => {
  assert.match(pairSource, /async function restartSession\(nexusDevNumber, options = \{\}\)/);
  assert.match(pairSource, /tracker\.skipReconnect = true/);
  assert.match(pairSource, /Manual restart requested/);
  assert.match(pairSource, /module\.exports\.restartSession = restartSession/);
});
