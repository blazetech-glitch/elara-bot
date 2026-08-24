const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
let startpairing;
function getStartPairing() {
  if (!startpairing) startpairing = require('./pair');
  return startpairing;
}

const PORT = Number(process.env.PORT || 3000);
const PANEL_KEY = process.env.ELARA_PANEL_KEY || '';
const OFFICIAL_CHANNEL = process.env.TELEGRAM_OFFICIAL_CHANNEL || '@elarapairgc';
const ADAPTER_SECRET = process.env.ELARA_PAIRING_ADAPTER_SECRET || '';
const sessions = new Map();
const adapterSessions = new Map();
const telegramWorkers = new Map();
let server;
let configuredTelegramWorker;

function startConfiguredTelegramWorker() {
  const token = process.env.BOT_TOKEN;
  if (!token || configuredTelegramWorker) return;
  configuredTelegramWorker = fork(require.resolve('./bot.js'), [], {
    env: { ...process.env, BOT_TOKEN: token, TELEGRAM_OFFICIAL_CHANNEL: OFFICIAL_CHANNEL },
    stdio: 'inherit'
  });
  configuredTelegramWorker.on('exit', (code, signal) => {
    console.log(`⚠️ Configured Telegram worker stopped (code ${code ?? 'none'}, signal ${signal ?? 'none'}).`);
    configuredTelegramWorker = undefined;
  });
  console.log('✅ Configured Elara Telegram worker kept active independently of panel provider selection.');
}

function id() {
  return crypto.randomBytes(18).toString('hex');
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function authorized(req, body = {}) {
  const browserSession = /(?:^|;\s*)elara_session=([^;]+)/.exec(req.headers.cookie || '');
  if (browserSession?.[1]) return true;
  if (!PANEL_KEY) return false;
  return req.headers['x-elara-panel-key'] === PANEL_KEY || body.panelKey === PANEL_KEY;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 32 * 1024) req.destroy(new Error('request too large'));
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function adapterAuthorized(req) {
  return Boolean(ADAPTER_SECRET) && req.headers.authorization === `Bearer ${ADAPTER_SECRET}`;
}

async function validateTelegram(token) {
  const meResponse = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`);
  const me = await meResponse.json();
  if (!me.ok) throw new Error('Telegram rejected this bot token.');
  const chatResponse = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getChat?chat_id=${encodeURIComponent(OFFICIAL_CHANNEL)}`);
  const chat = await chatResponse.json();
  if (!chat.ok) throw new Error(`The official channel ${OFFICIAL_CHANNEL} is not reachable by this bot.`);
  return { username: me.result?.username || 'unknown', channelTitle: chat.result?.title || OFFICIAL_CHANNEL };
}

const HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Elara Connect</title>
<style>
:root{color-scheme:dark;--bg:#090612;--card:#151024;--pink:#ff3fa4;--cyan:#35e7ff;--muted:#a99bbd}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0,#32103a 0,transparent 35%),radial-gradient(circle at 90% 30%,#063a48 0,transparent 30%),var(--bg);color:#fff;font:16px/1.5 Inter,system-ui,sans-serif;min-height:100vh}.wrap{max-width:1050px;margin:auto;padding:38px 20px}.eyebrow{color:var(--cyan);letter-spacing:.18em;text-transform:uppercase;font-size:12px}.hero{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:28px}.hero h1{font-size:clamp(42px,8vw,82px);line-height:.9;margin:10px 0;background:linear-gradient(90deg,#fff,var(--pink),var(--cyan));-webkit-background-clip:text;color:transparent}.hero p{color:var(--muted);max-width:620px}.key{width:240px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.provider-choice{display:flex;gap:12px;margin:18px 0}.provider-choice button{margin-top:0;flex:1}.provider-card{display:none}.provider-card.active{display:block}.legacy{display:none}.card{background:linear-gradient(145deg,rgba(255,63,164,.12),rgba(53,231,255,.06));border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:24px;box-shadow:0 20px 60px #0005}.card h2{margin:0 0 6px}.card p{color:var(--muted)}label{display:block;color:#d8cce5;font-size:13px;margin:15px 0 6px}input{width:100%;border-radius:12px;border:1px solid #ffffff25;background:#08050f;color:#fff;padding:13px;font:inherit}button{margin-top:16px;border:0;border-radius:12px;padding:13px 18px;background:linear-gradient(90deg,var(--pink),#a64cff);color:#fff;font-weight:800;cursor:pointer}button.alt{background:linear-gradient(90deg,var(--cyan),#4b7cff);color:#041018}.copy-button{display:none;background:linear-gradient(90deg,#35e7ff,#4b7cff);color:#041018}.status{margin-top:16px;padding:12px;border-radius:12px;background:#0005;color:#dcd4e4;min-height:48px;white-space:pre-wrap;border-left:3px solid var(--cyan)}.status.success{border-left-color:#52f5a7;color:#bfffdc}.status.error{border-left-color:#ff668f;color:#ffd1df}.status.waiting{border-left-color:#ffcf5a}.fine{font-size:12px;color:var(--muted);margin-top:22px}@media(max-width:760px){.hero{display:block}.key{width:100%;margin-top:20px}.grid{grid-template-columns:1fr}}
</style></head><body><main class="wrap"><div class="hero"><div><div class="eyebrow">Elara secure connection portal</div><h1>Elara<br>Connect</h1><p>Choose a service, complete the secure connection step, and continue into Elara’s normal bot logic. Credentials are never displayed back in the browser.</p></div><div class="key"><div class="eyebrow">Private session</div><p class="fine">Your browser receives an isolated Elara session automatically. No panel key is required.</p></div></div><div class="provider-choice"><button class="alt" onclick="showProvider('whatsapp')">1) WhatsApp</button><button class="alt" onclick="showProvider('telegram')">2) Telegram</button></div><section class="grid"><article id="whatsappCard" class="card provider-card"><div class="eyebrow">01 / WhatsApp</div><h2>Link a WhatsApp device</h2><p>Enter a phone number with country code. Elara will request a WhatsApp pairing code.</p><label>Phone number</label><input id="waNumber" placeholder="255625606354" inputmode="tel"><button onclick="pairWhatsApp()">Request pairing code</button><div class="status" id="waStatus">Waiting for a number.</div><button id="copyWaCode" class="copy-button" onclick="copyWhatsAppCode()">Copy pairing code</button></article><article id="telegramCard" class="card provider-card"><div class="eyebrow">02 / Telegram</div><h2>Connect Telegram</h2><p>Enter a Telegram bot token. Elara validates it and checks access to the official channel.</p><label>Bot token</label><input id="tgToken" type="password" placeholder="Token is never shown again"><button class="alt" onclick="connectTelegram()">Connect Telegram</button><div class="status" id="tgStatus">Waiting for a token.</div></article></section><p class="fine">Choose one provider above. Elara keeps the configured Telegram worker running independently; selecting WhatsApp does not stop Telegram. Each browser connection receives its own isolated Elara session. Enter a WhatsApp number or Telegram token below to continue into normal Elara logic.</p></main><script>
const key=()=>'';const headers=()=>({'content-type':'application/json'});function showProvider(provider){document.querySelectorAll('.provider-card').forEach(card=>card.classList.remove('active'));document.getElementById(provider+'Card').classList.add('active');}showProvider('whatsapp');
async function pairWhatsApp(){const status=document.getElementById('waStatus');const copy=document.getElementById('copyWaCode');const button=document.querySelector('#whatsappCard button:not(.copy-button)');const number=document.getElementById('waNumber').value.trim();copy.style.display='none';copy.dataset.code='';copy.textContent='Copy pairing code';status.className='status waiting';status.textContent='Step 1 of 4 — Starting an isolated WhatsApp session…';button.disabled=true;try{const r=await fetch('/api/whatsapp/pair',{method:'POST',headers:headers(),body:JSON.stringify({number})});const d=await r.json();if(!r.ok)throw Error(d.error||'Pairing request failed');status.textContent='Step 2 of 4 — Session created. Waiting for WhatsApp to issue a code…';let finished=false;let polls=0;let timer;const stop=(message,kind='')=>{finished=true;clearInterval(timer);button.disabled=false;status.className='status '+kind;status.textContent=message};const poll=async()=>{if(finished)return;polls++;try{const s=await fetch('/api/whatsapp/status/'+d.sessionId,{cache:'no-store'});const x=await s.json();if(!s.ok)return stop(x.error||'The pairing session could not be found. Start again.','error');if(x.code){copy.dataset.code=x.code;copy.style.display='inline-block';status.className='status waiting';status.textContent='Step 3 of 4 — Code ready: '+x.code+'\\nEnter this code on the target WhatsApp phone. The page will keep checking the connection.'}if(x.status==='connecting')status.textContent='Step 3 of 4 — WhatsApp accepted the request. Waiting for the device to finish logging in…';if(x.status==='reconnecting')status.textContent='Step 3 of 4 — Reconnecting to WhatsApp securely…';if(x.status==='connected'){copy.style.display='none';return stop('Step 4 of 4 — Connected successfully. Elara normal WhatsApp logic is now active for '+number+'.','success')}if(x.status==='error')return stop('Pairing failed: '+(x.error||'WhatsApp returned an error. Start again.'),'error');if(x.status==='disconnected'&&polls>3)return stop('The WhatsApp connection closed before login completed. Start pairing again and enter the code promptly.','error');if(polls>=360)return stop('The pairing code expired or the connection took too long. Start a new pairing session.','error')}catch(error){if(polls>=6)return stop('Connection status could not be checked. Refresh the page and try again.','error')}};timer=setInterval(poll,1000);await poll()}catch(e){button.disabled=false;status.className='status error';status.textContent=e.message}}\nasync function copyWhatsAppCode(){const copy=document.getElementById('copyWaCode');if(!copy.dataset.code)return;try{await navigator.clipboard.writeText(copy.dataset.code);copy.textContent='Copied';setTimeout(()=>{copy.textContent='Copy pairing code'},1200)}catch{copy.textContent='Copy failed — select the code above'}}
async function connectTelegram(){const status=document.getElementById('tgStatus');status.textContent='Validating token and official channel…';try{const r=await fetch('/api/telegram/connect',{method:'POST',headers:headers(),body:JSON.stringify({token:document.getElementById('tgToken').value})});const d=await r.json();if(!r.ok)throw Error(d.error||'Telegram connection failed');document.getElementById('tgToken').value='';status.textContent='Connected as @'+d.username+'\\nOfficial channel verified: '+d.channelTitle+'\\nNormal Telegram logic is active.'}catch(e){status.textContent=e.message}}
</script></body></html>`;

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/privacy') {
    try {
      const policy = fs.readFileSync(path.join(__dirname, 'PRIVACY.md'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end(policy);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Privacy policy temporarily unavailable.');
    }
  }
  if (req.method === 'GET' && url.pathname === '/') {
    const existing = /(?:^|;\s*)elara_session=([^;]+)/.exec(req.headers.cookie || '');
    const headers = { 'content-type': 'text/html; charset=utf-8' };
    if (!existing) headers['set-cookie'] = `elara_session=${id()}; Path=/; HttpOnly; SameSite=Lax`;
    res.writeHead(200, headers);
    return res.end(HTML);
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/whatsapp/status/')) {
    if (!authorized(req)) return json(res, 401, { error: 'Connection session required.' });
    const session = sessions.get(url.pathname.split('/').pop());
    if (!session || session.type !== 'whatsapp') return json(res, 404, { error: 'Pairing session not found.' });
    return json(res, 200, { sessionId: session.id, status: session.status, code: session.code || null, expiresAt: session.expiresAt || null, updatedAt: session.updatedAt || null, error: session.error || null });
  }
  if (req.method === 'POST' && (url.pathname === '/pair' || url.pathname === '/disconnect')) {
    if (!adapterAuthorized(req)) return json(res, 401, { error: 'Pairing adapter authorization required.' });
    let body;
    try { body = await readBody(req); } catch (error) { return json(res, 400, { error: error.message }); }
    const ownerId = Number(body.ownerId);
    const sessionRef = String(body.sessionRef || '').trim();
    const phoneNumber = String(body.phoneNumber || '').replace(/[^0-9]/g, '');
    if (!Number.isInteger(ownerId) || ownerId < 1 || !sessionRef) return json(res, 400, { error: 'ownerId and sessionRef are required.' });
    const key = `${ownerId}:${sessionRef}`;
    if (url.pathname === '/disconnect') {
      const session = adapterSessions.get(key);
      const pairing = getStartPairing();
      if (session && pairing.disconnectSession) pairing.disconnectSession(session.phoneNumber);
      adapterSessions.set(key, { ...session, ownerId, sessionRef, phoneNumber: session?.phoneNumber || phoneNumber, status: 'disconnected' });
      return json(res, 200, { success: true, status: 'disconnected' });
    }
    if (!/^\d{7,15}$/.test(phoneNumber)) return json(res, 400, { error: 'A valid phone number is required.' });
    const existing = adapterSessions.get(key);
    const session = { ownerId, sessionRef, phoneNumber, status: existing?.status === 'connected' ? 'connected' : 'awaiting_pairing', code: null, expiresAt: null, lastError: null };
    adapterSessions.set(key, session);
    const pairing = getStartPairing();
    if (pairing.disconnectSession) pairing.disconnectSession(phoneNumber);
    pairing(phoneNumber, {
      onPairingCode: code => { session.code = code; session.expiresAt = new Date(Date.now() + 180000).toISOString(); },
      onConnectionUpdate: state => { session.status = state === 'open' ? 'connected' : 'awaiting_pairing'; }
    }).catch(error => { session.status = 'awaiting_pairing'; session.lastError = error.message; });
    return json(res, 202, { sessionRef, status: session.status, code: session.code, expiresAt: session.expiresAt });
  }
  if (req.method === 'GET' && url.pathname === '/status') {
    if (!adapterAuthorized(req)) return json(res, 401, { error: 'Pairing adapter authorization required.' });
    const ownerId = Number(url.searchParams.get('ownerId'));
    const sessionRef = String(url.searchParams.get('sessionRef') || '').trim();
    const session = adapterSessions.get(`${ownerId}:${sessionRef}`);
    if (!session) return json(res, 404, { error: 'Session not found.' });
    return json(res, 200, { sessionRef: session.sessionRef, status: session.status, code: session.code, expiresAt: session.expiresAt, lastError: session.lastError });
  }
  if (req.method === 'POST' && (url.pathname === '/api/whatsapp/pair' || url.pathname === '/api/telegram/connect')) {
    let body;
    try { body = await readBody(req); } catch (error) { return json(res, 400, { error: error.message }); }
    if (!authorized(req, body)) return json(res, 401, { error: 'Panel access key required.' });
    if (url.pathname === '/api/whatsapp/pair') {
      const number = String(body.number || '').replace(/[^0-9]/g, '');
      if (!/^\d{7,15}$/.test(number)) return json(res, 400, { error: 'Enter a valid phone number with country code.' });
      const session = { id: id(), type: 'whatsapp', number, status: 'requesting', createdAt: Date.now(), updatedAt: Date.now(), code: null, expiresAt: null, error: null };
      sessions.set(session.id, session);
      const pairing = getStartPairing();
      if (pairing.disconnectSession) pairing.disconnectSession(number);
      pairing(number, { onPairingCode: code => { session.code = code; session.status = 'awaiting_pairing'; session.expiresAt = new Date(Date.now() + 180000).toISOString(); session.updatedAt = Date.now(); }, onPairingError: error => { session.status = 'error'; session.error = error.message; session.updatedAt = Date.now(); }, onConnectionUpdate: (state, detail) => { session.updatedAt = Date.now(); if (state === 'open') { session.status = 'connected'; session.error = null; } else if (state === 'connecting') session.status = 'connecting'; else if (state === 'close') session.status = 'reconnecting'; else if (state === 'error') { session.status = 'error'; session.error = detail?.message || detail?.error || 'WhatsApp closed the connection before login completed.'; } } }).catch(error => { session.status = 'error'; session.error = error.message; session.updatedAt = Date.now(); });
      return json(res, 202, { sessionId: session.id, status: session.status });
    }
    const token = String(body.token || '').trim();
    if (!token) return json(res, 400, { error: 'Telegram bot token is required.' });
    try {
      const telegram = await validateTelegram(token);
      const sessionId = id();
      const worker = fork(require.resolve('./bot.js'), [], { env: { ...process.env, BOT_TOKEN: token, TELEGRAM_OFFICIAL_CHANNEL: OFFICIAL_CHANNEL }, stdio: 'ignore' });
      telegramWorkers.set(sessionId, worker);
      return json(res, 200, { sessionId, status: 'connected', username: telegram.username, channelTitle: telegram.channelTitle });
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  return json(res, 404, { error: 'Not found.' });
}

function startPanelServer() {
  if (server) return server;
  server = http.createServer((req, res) => handle(req, res).catch(error => json(res, 500, { error: 'Internal panel error.' })));
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Elara Connect panel listening on port ${PORT}`);
    startConfiguredTelegramWorker();
  });
  return server;
}

module.exports = { startPanelServer, sessions };
