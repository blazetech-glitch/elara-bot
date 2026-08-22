require('dotenv').config();
require('./setting/config');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const os = require('os');
const { sleep } = require('./nexstore/utils');
let localToken = {};
try {
  localToken = require('./nexstore/token');
} catch (error) {
  console.log(chalk.yellow('ℹ️ Local token file not found; using BOT_TOKEN from the deployment environment.'));
}
const BOT_TOKEN = process.env.BOT_TOKEN || localToken.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required to start the Telegram bot.');
const { autoLoadPairs } = require('./autoload');
const { tiklydown } = require('./allfunc/tiktok');

const FUNNY_LINES = [
  'Why did the bot go to school? To improve its byte-sized knowledge.',
  'Elara tried to tell a UDP joke, but nobody knows if it arrived.',
  'My code and I had a disagreement. It said it was a feature.',
  'The cloud is just someone else’s computer with excellent marketing.'
];

function extractDownloadUrl(result) {
  const candidates = [
    result?.video?.noWatermark,
    result?.video?.no_watermark,
    result?.video?.downloadAddr,
    result?.video?.download,
    result?.data?.video?.noWatermark,
    result?.data?.video?.downloadAddr,
    result?.video,
    result?.nowm,
    result?.download
  ];
  return candidates.find(value => typeof value === 'string' && /^https?:\/\//i.test(value));
}

const bot = new TelegramBot(BOT_TOKEN, { polling: { interval: 1000, autoStart: true, params: { timeout: 30 } } });

const TELEGRAM_COMMANDS = [
  { command: 'start', description: 'Open Elara start menu' },
  { command: 'menu', description: 'Show quick categorized menu' },
  { command: 'allcommands', description: 'Show all categorized commands' },
  { command: 'pair', description: 'Pair a WhatsApp number' },
  { command: 'status', description: 'Show connection status' },
  { command: 'health', description: 'Check Elara health' },
  { command: 'joke', description: 'Get a tech joke' },
  { command: 'quote', description: 'Get a coding quote' },
  { command: 'tiktok', description: 'Download a TikTok video' },
  { command: 'calc', description: 'Calculate a simple expression' },
  { command: 'poll', description: 'Create a Telegram poll' },
  { command: 'choose', description: 'Choose between options' },
  { command: 'reverse', description: 'Reverse text' },
  { command: 'caps', description: 'Convert text to uppercase' },
  { command: 'count', description: 'Count text characters' },
  { command: 'links', description: 'Show Elara links' },
  { command: 'checkchannel', description: 'Check channel membership' }
];
bot.setMyCommands(TELEGRAM_COMMANDS).then(() => console.log('✅ Telegram command menu registered.')).catch(error => console.error('⚠️ Telegram command menu registration failed:', error.message));
bot.on('polling_error', error => {
  console.error(`⚠️ Telegram polling connection error: ${error.code || 'NETWORK'} ${error.message}`);
});
bot.on('error', error => {
  console.error(`⚠️ Telegram bot transport error: ${error.message}`);
});
const adminFilePath = path.join(__dirname, 'nexstore', 'admin.json');
let adminIDs = [];


const userFilePath = path.join(__dirname, 'nexstore', 'users.json');
const pairOwnershipPath = path.join(__dirname, 'nexstore', 'pairing', 'telegram-ownership.json');
let userIDs = new Set();

async function loadPairOwnership() {
  try {
    return JSON.parse(await fs.readFile(pairOwnershipPath, 'utf8'));
  } catch {
    return {};
  }
}

async function savePairOwnership(data) {
  await fs.mkdir(path.dirname(pairOwnershipPath), { recursive: true });
  await fs.writeFile(pairOwnershipPath, JSON.stringify(data, null, 2));
}

async function recordPairOwnership(telegramUserId, number) {
  const data = await loadPairOwnership();
  const key = String(telegramUserId);
  const numbers = new Set(Array.isArray(data[key]) ? data[key] : []);
  numbers.add(number.replace(/[^0-9]/g, ''));
  data[key] = [...numbers];
  await savePairOwnership(data);
}

async function removePairOwnership(telegramUserId, number) {
  const data = await loadPairOwnership();
  const key = String(telegramUserId);
  data[key] = (data[key] || []).filter(item => item !== number.replace(/[^0-9]/g, ''));
  await savePairOwnership(data);
}

async function getOwnedPairNumbers(telegramUserId) {
  const data = await loadPairOwnership();
  return Array.isArray(data[String(telegramUserId)]) ? data[String(telegramUserId)] : [];
}

async function readPairStatus(number) {
  const normalized = number.replace(/[^0-9]/g, '');
  const sessionDir = path.join(__dirname, 'nexstore', 'pairing', `${normalized}@s.whatsapp.net`);
  try {
    const status = JSON.parse(await fs.readFile(path.join(sessionDir, 'status.json'), 'utf8'));
    return { ...status, number: normalized };
  } catch {
    try {
      const creds = JSON.parse(await fs.readFile(path.join(sessionDir, 'creds.json'), 'utf8'));
      return { number: normalized, status: creds.registered ? 'connected' : 'awaiting_pairing', updatedAt: null };
    } catch {
      return { number: normalized, status: 'not_found', updatedAt: null };
    }
  }
}


const OFFICIAL_ELARA_CHANNEL = process.env.TELEGRAM_OFFICIAL_CHANNEL || '@elarapairgc';
const REQUIRED_GROUP = OFFICIAL_ELARA_CHANNEL;
const REQUIRED_CHANNELS = [
  '@devxtechzone'
];
const TECH_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '@elarapairgc';
const TECH_AUTOPUBLISH = process.env.ELARA_CHANNEL_AUTOPUBLISH !== 'false';
const TECH_POST_INTERVAL_MINUTES = Math.max(30, Number(process.env.ELARA_CHANNEL_POST_INTERVAL_MINUTES || 360));
const TECH_POST_INTERVAL_MS = TECH_POST_INTERVAL_MINUTES * 60 * 1000;
const TECH_POSTS = [
  {
    title: 'Elara Tech Menu 01',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1280&q=85',
    caption: '⚡ *ELARA TECH MENU*\\n\\nChoose the next topic for the channel: AI, cybersecurity, or web development.',
    question: 'Which tech topic should Elara explore next?',
    options: ['Artificial Intelligence', 'Cybersecurity', 'Web Development', 'Cloud & DevOps']
  },
  {
    title: 'Elara Tech Menu 02',
    image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1280&q=85',
    caption: '🛡️ *ELARA SECURITY CHECK*\\n\\nA strong security habit protects every account and device.',
    question: 'What is the best first defense for an online account?',
    options: ['Unique password + MFA', 'Reuse one password', 'Ignore updates', 'Share the login']
  },
  {
    title: 'Elara Tech Menu 03',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1280&q=85',
    caption: '🤖 *ELARA AI CORNER*\\n\\nAI tools are most useful when people verify outputs and protect private data.',
    question: 'What should you do before trusting an AI-generated answer?',
    options: ['Verify important facts', 'Publish immediately', 'Share private data', 'Skip context']
  },
  {
    title: 'Elara Tech Menu 04',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1280&q=85',
    caption: '☁️ *ELARA CLOUD LAB*\\n\\nReliable systems combine backups, monitoring, and sensible access controls.',
    question: 'Which practice improves cloud reliability the most?',
    options: ['Backups + monitoring', 'One admin account', 'No alerts', 'No recovery plan']
  }
];
let techPostIndex = 0;
let techPublisherTimer = null;

function isTelegramAdmin(userId) {
  const normalized = String(userId);
  return adminIDs.map(String).includes(normalized) || normalized === String(process.env.TELEGRAM_OWNER_ID || '255627417402');
}

async function publishTechPost(index = techPostIndex) {
  const post = TECH_POSTS[index % TECH_POSTS.length];
  try {
    const photoMessage = await bot.sendPhoto(TECH_CHANNEL_ID, post.image, {
      caption: `${post.caption}\\n\\n#Elara #Tech #${post.title.replace(/\\s+/g, '')}`,
      parse_mode: 'Markdown'
    });
    await bot.sendPoll(TECH_CHANNEL_ID, post.question, post.options, {
      is_anonymous: true,
      allows_multiple_answers: false,
      protect_content: false
    });
    techPostIndex = (index + 1) % TECH_POSTS.length;
    console.log(`✅ Published ${post.title} to ${TECH_CHANNEL_ID} (photo ${photoMessage.message_id})`);
    return true;
  } catch (error) {
    console.error(`❌ Tech channel publishing failed for ${TECH_CHANNEL_ID}:`, error.message);
    return false;
  }
}

function startTechPublisher() {
  if (!TECH_AUTOPUBLISH || techPublisherTimer) return;
  techPublisherTimer = setInterval(() => publishTechPost(), TECH_POST_INTERVAL_MS);
  setTimeout(() => publishTechPost(), 15000);
  console.log(`📣 Tech channel autopublishing enabled: every ${TECH_POST_INTERVAL_MINUTES} minutes in ${TECH_CHANNEL_ID}`);
}

const ROTATING_MENU_IMAGES = [
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/UfiIdVKkEjUERBsd.jpeg',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/vfFkvsyORahaIdnW.jpeg',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/yZLyxizTkhNHOoqa.jpeg',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/xNITSdJzkXFkwyug.jpeg',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/qgrjlJSbVnayRrrq.jpeg',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/iuJzBkUcorbbzhSc.jpeg',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/tJUCzJKiePbxxjji.jpeg',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/VjeqqjBeqwVPwRgq.jpeg'
];
let rotatingMenuIndex = 0;

async function sendRotatingMenu(chatId, full = false) {
  const image = ROTATING_MENU_IMAGES[rotatingMenuIndex % ROTATING_MENU_IMAGES.length];
  rotatingMenuIndex = (rotatingMenuIndex + 1) % ROTATING_MENU_IMAGES.length;
  const fullCaption = `
\`\`\`
━━「 𝐁𝐎𝐓 𝐈𝐍𝐅𝐎 」━━╼
➺ 𝐁𝐨𝐭 𝐍𝐚𝐦𝐞 : Elara ᴠ2
➺ 𝐃𝐞ᴠ       : ARNOLDT20
➺ 𝐒𝐭ᴀᴛᴜs    : ᴏɴʟɪɴᴇ & sᴛᴀʙʟᴇ
┗━━━━━━━━━━━━━━━╼

╔══「 ᴘɪɴɢ-x 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒 」══☤
➺ /pair        ─ ᴘᴀɪʀ ᴡʜᴀᴛsᴀᴘᴘ
➺ /delpair     ─ ʀᴇᴍᴏᴠᴇ ᴘᴀɪʀ
➺ /runtime     ─ ʙᴏᴛ ᴜᴘᴛɪᴍᴇ
➺ /status      ─ ᴄᴏɴɴᴇᴄᴛɪᴏɴ sᴛᴀᴛᴜs
➺ /listpair    ─ ᴠɪᴇᴡ ᴀʟʟ ᴘᴀɪʀs
➺ /menu        ─ ʀᴏᴛᴀᴛɪɴɢ ᴍᴇɴᴜ ɪᴍᴀɢᴇ
➺ /ping        ─ ᴄʜᴇᴄᴋ ʀᴇsᴘᴏɴsᴇ sᴘᴇᴇᴅ
➺ /jid         ─ sʜᴏᴡ ᴄʜᴀᴛ ɪᴅ
➺ /owner       ─ ᴠɪᴇᴡ ᴏᴡɴᴇʀ ᴄᴏɴᴛᴀᴄᴛ
➺ /support     ─ ᴄᴏɴᴛᴀᴄᴛ sᴜᴘᴘᴏʀᴛ
➺ /group       ─ ᴏᴘᴇɴ ᴡʜᴀᴛsᴀᴘᴘ ɢʀᴏᴜᴘ
➺ /channel     ─ ᴏᴘᴇɴ ᴏꜰꜰɪᴄɪᴀʟ ᴄʜᴀɴɴᴇʟ
➺ /tech        ─ ᴛᴇᴄʜ ᴘᴜʙʟɪsʜɪɴɢ ɪɴꜰᴏ
➺ /publishtech ─ ᴘᴏsᴛ ᴛᴇᴄʜ ɪᴍᴀɢᴇ + ᴘᴏʟʟ
➺ /help        ─ ᴠɪᴇᴡ ᴅᴇsᴄʀɪᴘᴛɪᴏɴ
➺ /health      ─ ᴄʜᴇᴄᴋ ᴇʟᴀʀᴀ ʜᴇᴀʟᴛʜ
➺ /version     ─ ᴠɪᴇᴡ ʙᴏᴛ ᴠᴇʀsɪᴏɴ
➺ /time        ─ ᴠɪᴇᴡ sᴇʀᴠᴇʀ ᴛɪᴍᴇ
➺ /whoami      ─ ᴠɪᴇᴡ ʏᴏᴜʀ ᴛᴇʟᴇɢʀᴀᴍ ɪᴅ
➺ /joke        ─ ʀᴀɴᴅᴏᴍ ᴛᴇᴄʜ ᴊᴏᴋᴇ
➺ /quote       ─ ᴠɪᴇᴡ ᴄᴏᴅɪɴɢ ǫᴜᴏᴛᴇ
➺ /tiktok      ─ ᴅᴏᴡɴʟᴏᴀᴅ ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ
➺ /calc        ─ ᴄᴀʟᴄᴜʟᴀᴛᴇ sɪᴍᴘʟᴇ ᴇxᴘʀᴇssɪᴏɴ
➺ /poll        ─ ᴄʀᴇᴀᴛᴇ ᴀ ᴛᴇʟᴇɢʀᴀᴍ ᴘᴏʟʟ
➺ /choose      ─ ᴄʜᴏᴏsᴇ ᴀɴ ᴏᴘᴛɪᴏɴ
➺ /reverse     ─ ʀᴇᴠᴇʀsᴇ ᴛᴇxᴛ
➺ /caps        ─ ᴜᴘᴘᴇʀᴄᴀsᴇ ᴛᴇxᴛ
➺ /count       ─ ᴄᴏᴜɴᴛ ᴄʜᴀʀᴀᴄᴛᴇʀs
➺ /chat        ─ sᴇɴᴅ ᴍᴇssᴀɢᴇ ᴛᴏ ᴏᴡɴᴇʀ
╚══════════════════☤
\`\`\`

ᴜsᴇ /ᴍᴇɴᴜ ᴀɢᴀɪɴ ꜰᴏʀ ᴀɴᴏᴛʜᴇʀ ᴇʟᴀʀᴀ ᴍᴇɴᴜ ɪᴍᴀɢᴇ.`;
  const conciseCaption = `
━━「 𝐄𝐋𝐀𝐑𝐀 𝐐𝐔𝐈𝐂𝐊 𝐌𝐄𝐍𝐔 」━━

╔══「 𝐏𝐀𝐈𝐑𝐈𝐍𝐆 」══╗
➺ /pair     ─ ᴘᴀɪʀ ᴡʜᴀᴛsᴀᴘᴘ
➺ /delpair  ─ ʀᴇᴍᴏᴠᴇ ᴘᴀɪʀ
╚══════════════╝

╔══「 𝐈𝐍𝐅𝐎 」══╗
➺ /ping     ─ ᴄʜᴇᴄᴋ sᴘᴇᴇᴅ
➺ /runtime  ─ ᴜᴘᴛɪᴍᴇ
➺ /status   ─ ᴄᴏɴɴᴇᴄᴛɪᴏɴ sᴛᴀᴛᴜs
➺ /help     ─ ᴠɪᴇᴡ ʜᴇʟᴘ
╚══════════════╝

╔══「 𝐒𝐔𝐏𝐏𝐎𝐑𝐓 」══╗
➺ /owner    ─ ᴏᴡɴᴇʀ ᴄᴏɴᴛᴀᴄᴛ
➺ /support  ─ sᴜᴘᴘᴏʀᴛ ᴄᴏɴᴛᴀᴄᴛ
➺ /group    ─ ᴡʜᴀᴛsᴀᴘᴘ ɢʀᴏᴜᴘ
➺ /channel  ─ ᴏғғɪᴄɪᴀʟ ᴄʜᴀɴɴᴇʟ
➺ /links    ─ ᴇʟᴀʀᴀ ʟɪɴᴋs
➺ /rules    ─ ᴄᴏᴍᴍᴜɴɪᴛʏ ʀᴜʟᴇs
➺ /checkchannel ─ ᴠᴇʀɪғʏ ᴍᴇᴍʙᴇʀsʜɪᴘ
➺ /allmenu  ─ ᴠɪᴇᴡ ᴀʟʟ ᴄᴀᴛᴇɢᴏʀɪᴇs
╚══════════════╝`;
  const caption = full ? fullCaption : conciseCaption;
  return bot.sendPhoto(chatId, image, {
    caption,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '📋 ALL COMMANDS', callback_data: 'all_commands' }, { text: '📢 OFFICIAL CHANNEL', url: 'https://t.me/elarapairgc' }]] }
  });
}


const SOCIAL_LINKS = {
  whatsapp: 'https://whatsapp.com/channel/0029Vb6poDc3QxS2L0dxSq3E',
  telegram_channels: [
    'https://t.me/elarapairgc',
  ],
  telegram_group: '@elarapairgc',
  channel1: 'https://t.me/elarapairgc',
  devChannel: 'https://t.me/devxtechzone',
  channel2: 'https://t.me/elarapairgc',
  channel3: 'https://t.me/elarapairgc',
  channel4: 'https://t.me/elarapairgc',
  group1: 'https://t.me/elarachatzone',
  group2: 'https://t.me/elarapairgc',
  group3: 'https://t.me/elarapairgc',
  developer: 'https://t.me/StarboyT20',
  whatsappGroup: 'https://chat.whatsapp.com/HxCDA2s89LMEZMyixnTSy5?s=cl&p=a&mlu=4',
};


const exists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const loadAdminIDs = async () => {
  const ownerID = process.env.TELEGRAM_OWNER_ID || '255627417402';
  const defaultAdmins = [ownerID];

  if (!(await exists(adminFilePath))) {
    await fs.writeFile(adminFilePath, JSON.stringify(defaultAdmins, null, 2));
    adminIDs = defaultAdmins;
    console.log('✅ created admin.json with default owner id');
  } else {
    try {
      const raw = await fs.readFile(adminFilePath, 'utf8');
      adminIDs = JSON.parse(raw);
    } catch (err) {
      console.error('❌ error loading admin.json:', err);
      adminIDs = defaultAdmins;
    }
  }
  console.log('📥 loaded admin ids:', adminIDs);
};

function runtime(seconds) {
  seconds = Number(seconds);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}


const loadUserIDs = async () => {
  if (await exists(userFilePath)) {
    try {
      const raw = await fs.readFile(userFilePath, 'utf8');
      const users = JSON.parse(raw);
      userIDs = new Set(users);
      console.log(`📥 loaded ${userIDs.size} users`);
    } catch (err) {
      console.error('❌ error loading users.json:', err);
      userIDs = new Set();
    }
  }
};


const saveUserIDs = async () => {
  try {
    await fs.writeFile(userFilePath, JSON.stringify([...userIDs], null, 2));
  } catch (err) {
    console.error('❌ error saving users.json:', err);
  }
};


const trackUser = async (userId) => {
  const userIdStr = userId.toString();
  if (!userIDs.has(userIdStr)) {
    userIDs.add(userIdStr);
    await saveUserIDs();
    console.log(`➕ new user tracked: ${userIdStr}`);
  }
};



const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


const checkMembership = async (userId, callbackQuery) => {
  const validStatuses = ['member', 'administrator', 'creator'];
  const results = {
    hasJoinedGroup: false,
    hasJoinedAllChannels: true,
    hasJoinedAll: false
  };

  try {
    
    if (callbackQuery) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: '🔍 Checking main group...' });
    }
    const groupMember = await bot.getChatMember(REQUIRED_GROUP, userId).catch(() => null);
    results.hasJoinedGroup = groupMember && validStatuses.includes(groupMember.status);
    await delay(1000);

    
    if (callbackQuery) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: '🔍 Checking channels...' });
    }

    results.hasJoinedAllChannels = true;
    for (let i = 0; i < REQUIRED_CHANNELS.length; i++) {
      const channel = REQUIRED_CHANNELS[i];
      const member = await bot.getChatMember(channel, userId).catch(() => null);
      if (!member || !validStatuses.includes(member.status)) {
        results.hasJoinedAllChannels = false;
        break;
      }

      
      if (callbackQuery) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: `✅ Checked ${i + 1}/${REQUIRED_CHANNELS.length} channels` });
      }
      await delay(800);
    }

    results.hasJoinedAll = results.hasJoinedGroup && results.hasJoinedAllChannels;
    return results;

  } catch (error) {
    console.error('Error checking membership:', error);
    if (callbackQuery) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error checking membership.' });
    }
    return results;
  }
};


const sendJoinRequirement = (chatId) => {
  return bot.sendMessage(
    chatId,
    '📌 Please join all our channels and groups to continue:',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'ᴇʟᴀʀᴀ ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1 },
            { text: 'ᴅᴇᴠ ᴛᴇᴄʜ ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.devChannel }
          ],
          [
            { text: 'ᴄʜᴀɴɴᴇʟ 2', url: SOCIAL_LINKS.channel2 },
            { text: 'ɢʀᴏᴜᴘ 1', url: SOCIAL_LINKS.group1 }
          ],
          [{ text: '✅ ᴀᴜᴛʜᴏʀɪᴢᴇ', callback_data: 'check_membership' }],
          [
            { text: 'ɢʀᴏᴜᴘ 2', url: SOCIAL_LINKS.group2 },
            { text: 'ɢʀᴏᴜᴘ 3', url: SOCIAL_LINKS.group3 },
            { text: 'ᴄʜᴀɴɴᴇʟ 3', url: SOCIAL_LINKS.channel3 },
            { text: 'ᴄʜᴀɴɴᴇʟ 4', url: SOCIAL_LINKS.channel4 }
          ]
        ]
      }
    }
  );
};


bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  if (data === 'check_membership') {
    await trackUser(userId);

    if (adminIDs.includes(userId.toString())) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: '✅ You are an admin. Access granted.' });
      return;
    }

    
    await bot.editMessageText('🔎 Verifying your membership...\nPlease wait a few seconds...', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });

    const membership = await checkMembership(userId, callbackQuery);

    if (!membership.hasJoinedAll) {
      await bot.editMessageText(
        '❌ You have not joined all required channels/groups.\nPlease join them and click *✅ ᴀᴜᴛʜᴏʀɪᴢᴇ* again.',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        }
      );
      return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Membership incomplete.' });
    }

    
    await bot.editMessageText(
      '✅ You have been authorized!\n\n🎉 Use the command `/pair` to pair your bot.\nEnjoy all features!',
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      }
    );

    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Authorization successful!' });
  }
});


const ensureOfficialChannelMembership = async (msg) => {
  const userId = msg.from.id;
  await trackUser(userId);
  if (isTelegramAdmin(userId)) return true;
  const membership = await checkMembership(userId);
  if (!membership.hasJoinedAll) {
    await sendJoinRequirement(msg.chat.id);
    return false;
  }
  return true;
};

const requireMembership = (handler) => {
  return async (msg, match) => {
    if (!(await ensureOfficialChannelMembership(msg))) return;
    return handler(msg, match);
  };
};


let isShuttingDown = false;
let isAutoLoadRunning = false;

const runAutoLoad = async () => {
  if (isAutoLoadRunning || isShuttingDown) return;
  isAutoLoadRunning = true;

  try {
    console.log('⏱️ Initializing auto-load...');
    await autoLoadPairs();
    console.log('✅ Auto-load completed');
  } catch (e) {
    console.error('❌ Auto-load failed:', e);
  } finally {
    isAutoLoadRunning = false;
  }
};

const startAutoLoadLoop = () => {
  runAutoLoad();
  setInterval(runAutoLoad, 60 * 60 * 1000);
};

(async () => {
  try {
    await loadAdminIDs();
    await loadUserIDs();
    startTechPublisher();
  } catch (error) {
    console.error('❌ Telegram publisher initialization failed:', error.message);
  }
})();

const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`🛑 Received ${signal}. Shutting down gracefully...`);
  bot.stopPolling();
  console.log('✅ Bot stopped successfully');
  process.exit(0);
};



const btn = (text, url, callback) => {
  if (url) return { text, url };
  if (callback) return { text, callback_data: callback };
  return null;
};

bot.onText(/^\/(?:menu|elaramenu|commands|allmenu|allcommands)$/, requireMembership(async (msg) => {
  await sendRotatingMenu(msg.chat.id, /^\/(?:allmenu|allcommands)\b/i.test(msg.text || ''));
}));

bot.onText(/^\/ping$/, requireMembership(async (msg) => {
  const started = Date.now();
  const sent = await bot.sendMessage(msg.chat.id, '🏓 Elara is checking latency...');
  const latency = Date.now() - started;
  return bot.editMessageText(`🏓 *Elara pong*\\nLatency: ${latency} ms\\nStatus: online ✅`, { chat_id: msg.chat.id, message_id: sent.message_id, parse_mode: 'Markdown' });
}));

bot.onText(/^(?:\/jid|\/id)$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, '🆔 Chat ID: ' + msg.chat.id);
}));

bot.onText(/^\/owner$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, '👑 Elara owner: ARNOLDT20\nTelegram: https://t.me/StarboyT20');
}));

bot.onText(/^\/support$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, '🛟 Elara support: https://t.me/StarboyT20');
}));

bot.onText(/^(?:\/group|\/community)$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, '👥 Elara WhatsApp community:\n' + SOCIAL_LINKS.whatsappGroup);
}));

bot.onText(/^\/channel$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, '📢 Official Elara channel: https://t.me/elarapairgc');
}));

bot.onText(/^\/about$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, '🌹 Elara is a WhatsApp pairing, management, and tech community assistant powered by ARNOLDT20.');
}));

bot.onText(/^\/pairhelp$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, '🔗 Pairing guide\\n\\nUse: /pair 255XXXXXXXXX\\n\\nEnter the full WhatsApp number with country code and follow the pairing code instructions.');
}));

bot.onText(/^\/health$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, `💚 Elara health: OK\\nTelegram polling: active\\nUptime: ${runtime(process.uptime())}`);
}));

bot.onText(/^\/version$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, '🌹 Elara v2\\nOwner: ARNOLDT20 (@StarboyT20)\\nBuild: Render provider-first release');
}));

bot.onText(/^\/time$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, `🕒 Server time: ${new Date().toISOString()}`);
}));

bot.onText(/^\/whoami$/, requireMembership(async (msg) => {
  const user = msg.from || {};
  return bot.sendMessage(msg.chat.id, `👤 Telegram identity\\nID: ${user.id || 'unknown'}\\nUsername: ${user.username ? '@' + user.username : 'not set'}\\nName: ${user.first_name || ''} ${user.last_name || ''}`.trim());
}));

bot.onText(/^\/links$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, `🔗 Elara links\\nOfficial channel: ${SOCIAL_LINKS.channel1}\\nOwner: ${SOCIAL_LINKS.developer}\\nWhatsApp group: ${SOCIAL_LINKS.whatsappGroup}`);
}));

bot.onText(/^\/rules$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, '📜 Elara community rules\\n1. Respect members.\\n2. Do not spam or share harmful content.\\n3. Keep credentials and private data confidential.\\n4. Follow the official channel instructions.');
}));

bot.onText(/^\/checkchannel$/, async (msg) => {
  const result = await checkMembership(msg.from.id);
  return bot.sendMessage(msg.chat.id, result.hasJoinedAll ? '✅ Your Elara channel membership is verified.' : '⚠️ Please join both official Elara channels (@elarapairgc and @devxtechzone), then try again.');
});

bot.onText(/^(?:\/joke|\/funny)$/, requireMembership(async (msg) => {
  const line = FUNNY_LINES[Math.floor(Math.random() * FUNNY_LINES.length)];
  return bot.sendMessage(msg.chat.id, `😂 ${line}`);
}));

bot.onText(/^\/quote$/, requireMembership(async (msg) => {
  return bot.sendMessage(msg.chat.id, '💡 “Small steps, clean code, and a backup before every risky change.” — Elara');
}));

bot.onText(/^\/reverse(?:\\s+(.+))?$/, requireMembership(async (msg, match) => {
  const text = (match?.[1] || '').trim();
  return bot.sendMessage(msg.chat.id, text ? `🔁 ${[...text].reverse().join('')}` : 'Usage: /reverse text');
}));

bot.onText(/^\/caps(?:\\s+(.+))?$/, requireMembership(async (msg, match) => {
  const text = (match?.[1] || '').trim();
  return bot.sendMessage(msg.chat.id, text ? `🔠 ${text.toUpperCase()}` : 'Usage: /caps text');
}));

bot.onText(/^\/count(?:\\s+(.+))?$/, requireMembership(async (msg, match) => {
  const text = (match?.[1] || '').trim();
  return bot.sendMessage(msg.chat.id, text ? `🔢 Characters: ${[...text].length}\\nWords: ${text.split(/\\s+/).length}` : 'Usage: /count text');
}));

bot.onText(/^\/choose(?:\\s+(.+))?$/, requireMembership(async (msg, match) => {
  const options = (match?.[1] || '').split('|').map(item => item.trim()).filter(Boolean);
  if (options.length < 2) return bot.sendMessage(msg.chat.id, 'Usage: /choose red | blue | green');
  return bot.sendMessage(msg.chat.id, `🎯 Elara chooses: ${options[Math.floor(Math.random() * options.length)]}`);
}));

bot.onText(/^\/calc(?:\\s+(.+))?$/, requireMembership(async (msg, match) => {
  const expression = (match?.[1] || '').replace(/\\s+/g, '');
  if (!expression || !/^[0-9+*\\/.%()\\-]+$/.test(expression)) return bot.sendMessage(msg.chat.id, 'Usage: /calc 12 * (3 + 2)');
  try {
    const result = Function(`"use strict"; return (${expression})`)();
    if (!Number.isFinite(result)) throw new Error('non-finite result');
    return bot.sendMessage(msg.chat.id, `🧮 ${expression} = ${result}`);
  } catch {
    return bot.sendMessage(msg.chat.id, '⚠️ Could not calculate that expression.');
  }
}));

bot.onText(/^\/poll(?:\\s+(.+))?$/, requireMembership(async (msg, match) => {
  const parts = (match?.[1] || '').split('|').map(item => item.trim()).filter(Boolean);
  if (parts.length < 3) return bot.sendMessage(msg.chat.id, 'Usage: /poll question | option 1 | option 2');
  const [question, ...options] = parts;
  if (options.length > 10) return bot.sendMessage(msg.chat.id, '⚠️ A Telegram poll supports up to 10 options.');
  return bot.sendPoll(msg.chat.id, question, options, { is_anonymous: false });
}));

bot.onText(/^(?:\/tiktok|\/tt)(?:\\s+(.+))?$/, requireMembership(async (msg, match) => {
  const input = (match?.[1] || '').trim();
  if (!input) return bot.sendMessage(msg.chat.id, '🎬 Usage: /tiktok https://www.tiktok.com/@user/video/123');
  let parsed;
  try { parsed = new URL(input); } catch { return bot.sendMessage(msg.chat.id, '⚠️ Please send a valid TikTok URL.'); }
  if (!/(^|\.)tiktok\.com$/i.test(parsed.hostname) && !/(^|\.)vm\.tiktok\.com$/i.test(parsed.hostname)) {
    return bot.sendMessage(msg.chat.id, '⚠️ Only TikTok links are supported by this command.');
  }
  const status = await bot.sendMessage(msg.chat.id, '⏳ Fetching the TikTok media…');
  try {
    await bot.sendChatAction(msg.chat.id, 'upload_video');
    const result = await tiklydown(input);
    const mediaUrl = extractDownloadUrl(result);
    if (!mediaUrl) throw new Error('No downloadable video was returned.');
    await bot.sendVideo(msg.chat.id, mediaUrl, { caption: '🎬 Downloaded by Elara' });
    await bot.deleteMessage(msg.chat.id, status.message_id).catch(() => {});
  } catch (error) {
    await bot.editMessageText(`❌ Download failed: ${error.message || 'provider unavailable'}`, { chat_id: msg.chat.id, message_id: status.message_id });
  }
}));

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  trackUser(userId);

  bot.sendMessage(chatId, '𝙄 𝙖𝙢 Elara — 𝙮𝙤𝙪𝙧 𝙪𝙡𝙩𝙞𝙢𝙖𝙩𝙚 𝙒𝙝𝙖𝙩𝙨𝘼𝙥𝙥 𝙗𝙤𝙩', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'sᴛᴀʀᴛ 😶‍🌫️', callback_data: 'start_bot' }]
      ]
    }
  });
});



bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  if (data === 'check_membership') return;
  if (!isTelegramAdmin(query.from.id)) {
    const membership = await checkMembership(query.from.id);
    if (!membership.hasJoinedAll) {
      await sendJoinRequirement(chatId);
      await bot.answerCallbackQuery(query.id, { text: 'Please join the official Elara channel first.' });
      return;
    }
  }

  const photoUrl = ROTATING_MENU_IMAGES[0];

  if (data === 'all_commands') {
    await sendRotatingMenu(chatId, true);
    return bot.answerCallbackQuery(query.id);
  }

  if (data === 'inline_menu') {
    const captionText = `
\`\`\`
━━「 𝐁𝐎𝐓 𝐈𝐍𝐅𝐎 」━━╼
➺ 𝐁𝐨𝐭 𝐍𝐚𝐦𝐞 : Elara ᴠ2
➺ 𝐃𝐞𝐯       : ARNOLDT20
➺ 𝐒𝐭𝐚𝐭𝐮𝐬    : ᴏɴʟɪɴᴇ & sᴛᴀʙʟᴇ
┗━━━━━━━━━━━━━━━╼

╔══「 ᴘɪɴɢ-x 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒 」══☤
	➺ /pair        ─ ᴘᴀɪʀ ᴡʜᴀᴛsᴀᴘᴘ
	➺ /delpair     ─ ʀᴇᴍᴏᴠᴇ ᴘᴀɪʀ
	➺ /runtime     ─ ʙᴏᴛ ᴜᴘᴛɪᴍᴇ
➺ /status      ─ ᴄᴏɴɴᴇᴄᴛɪᴏɴ sᴛᴀᴛᴜs
	➺ /listpair    ─ ᴠɪᴇᴡ ᴀʟʟ ᴘᴀɪʀs
	➺ /menu        ─ ʀᴏᴛᴀᴛɪɴɢ ᴍᴇɴᴜ ɪᴍᴀɢᴇ
	➺ /ping        ─ ᴄʜᴇᴄᴋ ʀᴇsᴘᴏɴsᴇ sᴘᴇᴇᴅ
	➺ /jid         ─ sʜᴏᴡ ᴄʜᴀᴛ ɪᴅ
	➺ /owner       ─ ᴠɪᴇᴡ ᴏᴡɴᴇʀ ᴄᴏɴᴛᴀᴄᴛ
➺ /support     ─ ᴄᴏɴᴛᴀᴄᴛ sᴜᴘᴘᴏʀᴛ
➺ /group       ─ ᴏᴘᴇɴ ᴡʜᴀᴛsᴀᴘᴘ ɢʀᴏᴜᴘ
	➺ /channel     ─ ᴏᴘᴇɴ ᴏꜰꜰɪᴄɪᴀʟ ᴄʜᴀɴɴᴇʟ
	➺ /tech        ─ ᴛᴇᴄʜ ᴘᴜʙʟɪsʜɪɴɢ ɪɴꜰᴏ
	➺ /publishtech ─ ᴘᴏsᴛ ᴛᴇᴄʜ ɪᴍᴀɢᴇ + ᴘᴏʟʟ
	➺ /help        ─ ᴠɪᴇᴡ ᴅᴇsᴄʀɪᴘᴛɪᴏɴ
➺ /health      ─ ᴄʜᴇᴄᴋ ᴇʟᴀʀᴀ ʜᴇᴀʟᴛʜ
➺ /version     ─ ᴠɪᴇᴡ ʙᴏᴛ ᴠᴇʀsɪᴏɴ
➺ /time        ─ ᴠɪᴇᴡ sᴇʀᴠᴇʀ ᴛɪᴍᴇ
➺ /whoami      ─ ᴠɪᴇᴡ ʏᴏᴜʀ ᴛᴇʟᴇɢʀᴀᴍ ɪᴅ
➺ /joke        ─ ʀᴀɴᴅᴏᴍ ᴛᴇᴄʜ ᴊᴏᴋᴇ
➺ /quote       ─ ᴠɪᴇᴡ ᴄᴏᴅɪɴɢ ǫᴜᴏᴛᴇ
➺ /tiktok      ─ ᴅᴏᴡɴʟᴏᴀᴅ ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ
➺ /calc        ─ ᴄᴀʟᴄᴜʟᴀᴛᴇ sɪᴍᴘʟᴇ ᴇxᴘʀᴇssɪᴏɴ
➺ /poll        ─ ᴄʀᴇᴀᴛᴇ ᴀ ᴛᴇʟᴇɢʀᴀᴍ ᴘᴏʟʟ
➺ /choose      ─ ᴄʜᴏᴏsᴇ ᴀɴ ᴏᴘᴛɪᴏɴ
➺ /reverse     ─ ʀᴇᴠᴇʀsᴇ ᴛᴇxᴛ
➺ /caps        ─ ᴜᴘᴘᴇʀᴄᴀsᴇ ᴛᴇxᴛ
➺ /count       ─ ᴄᴏᴜɴᴛ ᴄʜᴀʀᴀᴄᴛᴇʀs
	➺ /chat        ─ sᴇɴᴅ ᴍᴇssᴀɢᴇ ᴛᴏ ᴏᴡɴᴇʀ
	➺ /about       ─ ᴀʙᴏᴜᴛ ᴇʟᴀʀᴀ
	➺ /pairhelp    ─ ᴘᴀɪʀɪɴɢ ɢᴜɪᴅᴇ
╚══════════════════☤
\`\`\`
`;

    try {
      await bot.sendPhoto(chatId, photoUrl, {
        caption: captionText,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "❃ OWNER ❃", url: "https://t.me/StarboyT20" },
              { text: "📢 DEV CHANNEL", url: "https://t.me/elarapairgc" }
            ],
            [
              { text: "🔙 BACK", callback_data: "start_bot" }
            ]
          ]
        }
      });
    } catch (err) {
      console.error("Photo failed:", err);

      await bot.sendMessage(chatId, captionText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "❃ OWNER ❃", url: "https://t.me/StarboyT20" },
              { text: "📢 DEV CHANNEL", url: "https://t.me/elarapairgc" }
            ],
            [
              { text: "🔙 BACK", callback_data: "start_bot" }
            ]
          ]
        }
      });
    }

    bot.answerCallbackQuery(query.id);
  }

  
  if (data === 'poll_menu') {
    try {
      
      await bot.sendPoll(chatId,
        "🌹 Elara ᴍᴇɴᴜ — sᴇʟᴇᴄᴛ ᴏᴘᴛɪᴏɴ",
        [
          "🔗 ᴘᴀɪʀ ᴅᴇᴠɪᴄᴇ (/pair)",
          "🗑️ ᴅᴇʟᴇᴛᴇ ᴘᴀɪʀ (/delpair)",
          "⏳ ʀᴜɴᴛɪᴍᴇ (/runtime)",
          "🆘 ʜᴇʟᴘ (/help)"
        ],
        {
          is_anonymous: false,
          allows_multiple_answers: false
        }
      );

      
      await bot.sendMessage(chatId, "⬅️ Back to main menu:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 BACK", callback_data: "start_bot" }]
          ]
        }
      });
    } catch (error) {
      console.error("Error sending poll:", error);
    }

    
    bot.answerCallbackQuery(query.id);
  }

  
  if (data === 'poll_answer') {
    
    const answer = query.poll_answer.option_ids[0]; 

    switch (answer) {
      case 0: 
        await bot.sendMessage(chatId, "🔗 ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀ ᴛᴏ ᴘᴀɪʀ (ᴇxᴀᴍᴘʟᴇ: /pair 234XXXXXXXXXX).");
        break;
      case 1: 
        await bot.sendMessage(chatId, "🗑️ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ɴᴜᴍʙᴇʀ ᴏғ ᴛʜᴇ ᴅᴇᴠɪᴄᴇ ᴛᴏ ʀᴇᴍᴏᴠᴇ (ᴇxᴀᴍᴘʟᴇ: /delpair 234XXXXXXXXXX).");
        break;
      case 2: 
        await bot.sendMessage(chatId, "⏳ ᴇxᴀᴍɪɴɪɴɢ ʙᴏᴛ ᴜᴘᴛɪᴍᴇ...");
        
        break;
      case 3: 
        await bot.sendMessage(chatId, "🆘 ʜᴇʟᴘ ᴍᴇɴᴜ: /pair ᴛᴏ ᴘᴀɪʀ ᴅᴇᴠɪᴄᴇs, /delpair ᴛᴏ ʀᴇᴍᴏᴠᴇ, ᴇᴛᴄ.");
        break;
      default:
        await bot.sendMessage(chatId, "❌ ɪɴᴠᴀʟɪᴅ sᴇʟᴇᴄᴛɪᴏɴ. ᴘʟᴇᴀsᴇ ᴛʏᴘᴇ /help ᴛᴏ ɢᴇᴛ ʜᴇʟᴘ.");
        break;
    }
  }
  
  
  if (data === 'start_bot') {
    try {
      await bot.sendMessage(chatId, `
🌹 *Elara ᴠ²*

ᴄʜᴏᴏsᴇ ʏᴏᴜʀ ᴘʀᴇғᴇʀʀᴇᴅ ᴍᴇɴᴜ sᴛʏʟᴇ:
`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📋 ɪɴʟɪɴᴇ ᴍᴇɴᴜ", callback_data: "inline_menu" },
              { text: "📊 ᴘᴏʟʟ ᴍᴇɴᴜ", callback_data: "poll_menu" }
            ]
          ]
        }
      });

      bot.answerCallbackQuery(query.id);
    } catch (err) {
      console.error("Error returning to start menu:", err);
    }
  }
});  

bot.onText(/^\/pair\s*$/, requireMembership(async (msg) => {
  await bot.sendMessage(msg.chat.id, '🔗 Please provide the WhatsApp number with country code.\n\nUsage: /pair 255625606354', {
    reply_markup: { inline_keyboard: [[{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }]] }
  });
}));

bot.onText(/\/pair (.+)/, requireMembership(async (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1].trim();

  try {
    if (!text || /[a-z]/i.test(text)) {
      return bot.sendMessage(chatId, '⚠️ Input Needed Please enter a valid number.💡 Format: /pair 234xxxxxxxxxx',
      { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
    }

    if (!/^\d{7,15}(\|\d{1,10})?$/.test(text)) {
      return bot.sendMessage(chatId, 'Invalid format /pair 234xxx',
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
    }

    if (text.startsWith('0')) {
      return bot.sendMessage(chatId, 'Numbers starting with 0 are not allowed',
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
    }

    const countryCode = text.slice(0, 3);
    if (["252", "4567877"].includes(countryCode)) {
      return bot.sendMessage(chatId, "Numbers with this country code are not supported",
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
      
    }

    const pairingFolder = path.join(__dirname, 'nexstore', 'pairing');
    if (!(await exists(pairingFolder))) {
      await fs.mkdir(pairingFolder, { recursive: true });
    }

    const files = await fs.readdir(pairingFolder);
    const pairedCount = files.filter(file => file.endsWith('@s.whatsapp.net')).length;
    
    if (pairedCount >= 30) {
      return bot.sendMessage(chatId, "Pairing limit reached. Try again later or inform my owner wa.me/255627417402 .",
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ᴏᴡɴᴇʀ' , url: SOCIAL_LINKS.developer }],
          [{ text : 'ʜᴇʟᴘ' , callback_data: 'help_msg' }]
          ]
          }
          });
    }

    const startpairing = require('./pair.js');
    const senderNumber = text.split("|")[0].replace(/[^0-9]/g, '');
    const Xreturn = senderNumber + "@s.whatsapp.net";
    const cuObj = await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('Pairing code was not returned within 20 seconds.'));
        }
      }, 20000);
      startpairing(Xreturn, {
        onPairingCode: code => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ code });
        },
        onPairingError: error => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      }).catch(error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
    });
    await recordPairOwnership(msg.from.id, senderNumber);

    
    const whatsappFormat = senderNumber + "@s.whatsapp.net"; 
    
    const lidFormat = senderNumber + "@lid"; 

    
    const ownerPath = path.join(__dirname, 'allfunc', 'owner.json');
    let ownerData = [];

    try {
      const ownerFile = await fs.readFile(ownerPath, 'utf-8');
      ownerData = JSON.parse(ownerFile);
    } catch (err) {
      console.log("⚠️ Creating new owner.json file");
      ownerData = [];
    }

    
    let isNew = false;
    if (!ownerData.includes(whatsappFormat)) {
      ownerData.push(whatsappFormat);
      isNew = true;
    }
    if (!ownerData.includes(lidFormat)) {
      ownerData.push(lidFormat);
      isNew = true;
    }

    if (isNew) {
      await fs.writeFile(ownerPath, JSON.stringify(ownerData, null, 2));
      console.log("✅ Saved new owner (both formats):", senderNumber);
      
      
      bot.sendMessage(chatId, 
        `
╭━━━〔 ✅ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 〕━━━╮

📱 𝐍𝐮𝐦𝐛𝐞𝐫
➤ ${senderNumber}

🔗 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐋𝐢𝐧𝐤𝐞𝐝 𝐃𝐞𝐯𝐢𝐜𝐞𝐬
➤ Open WhatsApp
➤ Go to Linked Devices
➤ Enter the code below 👇

🔐 𝐏𝐚𝐢𝐫𝐢𝐧𝐠 𝐂𝐨𝐝𝐞
➤ \`${cuObj.code}\`

╰━━━━━━━━━━━━━━━━━━━━╯
`
      );
    } else {
      console.log("ℹ️ User already in owner list:", senderNumber);
      
      bot.sendMessage(chatId, 
       `
╭━━━〔 ✅ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 〕━━━╮

📱 𝐍𝐮𝐦𝐛𝐞𝐫
➤ ${senderNumber}

🔗 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐋𝐢𝐧𝐤𝐞𝐝 𝐃𝐞𝐯𝐢𝐜𝐞𝐬
➤ Open WhatsApp
➤ Go to Linked Devices
➤ Enter the code below 👇

🔐 𝐏𝐚𝐢𝐫𝐢𝐧𝐠 𝐂𝐨𝐝𝐞
➤ \`${cuObj.code}\`

╰━━━━━━━━━━━━━━━━━━━━╯`,
{
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1 }]
          ]
  }
}
      )
    }

  
  } catch (error) {
    console.error('❌ Connection error:', error);
    bot.sendMessage(chatId, `┃◈ ᴄᴏɴɴᴇᴄᴛɪᴏɴ ғᴀɪʟᴇᴅ\n\n${error.message || 'Unknown pairing error'}`);
  }
},
 ));

bot.onText(/^\/delpair\s*$/, requireMembership((msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'To proceed enter a phone number in the format: /delpair 234xxxxxxxx',
        { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
      });
}));


bot.onText(/\/delpair (.+)/, requireMembership(async (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1].trim();

  try {
    if (!input || /[a-z]/i.test(input) || !/^\d{7,15}$/.test(input) || input.startsWith('0')) {
      return bot.sendMessage(chatId, 'Your whatsapp number cannot start with 0',
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
    }

    const jidSuffix = `${input}@s.whatsapp.net`;
    const pairingPath = path.join(__dirname, 'nexstore', 'pairing');

    if (!(await exists(pairingPath))) {
      return bot.sendMessage(chatId, 'The session you are trying to delete does bot exist in the bot database',
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
    }

    const entries = await fs.readdir(pairingPath, { withFileTypes: true });
    const matched = entries.find(entry => entry.isDirectory() && entry.name.endsWith(jidSuffix));

    if (!matched) {
      return bot.sendMessage(chatId, `${input} is not found in the bot database`,
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
      }

    const targetPath = path.join(pairingPath, matched.name);
    await fs.rm(targetPath, { recursive: true, force: true });

    bot.sendMessage(chatId, `${input} ʜᴀs ʙᴇᴇɴ ᴅᴇʟᴇᴛᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ`,
          { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
        });
  } catch (err) {
    console.error('delpair error:', err);
    bot.sendMessage(chatId, 'opps, i have failed to delete session',
          { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
        });
  }
}));


async function sendPairList(msg, includeAll = false) {
  const numbers = includeAll ? await getAllPairNumbers() : await getOwnedPairNumbers(msg.from.id);
  if (!numbers.length) return bot.sendMessage(msg.chat.id, '📂 No WhatsApp pairings are recorded for this Telegram account.');
  const rows = await Promise.all(numbers.map(readPairStatus));
  const text = rows.map((row, index) => {
    const state = row.status === 'connected' ? '🟢 connected' : row.status === 'awaiting_pairing' ? '🟡 awaiting pairing' : row.status === 'connecting' ? '🔵 connecting' : row.status === 'disconnected' ? '⚪ disconnected' : `🔴 ${row.status}`;
    return `${index + 1}. +${row.number}\n   Status: ${state}${row.updatedAt ? `\n   Updated: ${row.updatedAt}` : ''}`;
  }).join('\n\n');
  return bot.sendMessage(msg.chat.id, `📋 *Elara WhatsApp pair list*\n\n${text}`, { parse_mode: 'Markdown' });
}

async function getAllPairNumbers() {
  const pairingPath = path.join(__dirname, 'nexstore', 'pairing');
  try {
    const entries = await fs.readdir(pairingPath, { withFileTypes: true });
    return entries.filter(entry => entry.isDirectory() && /@s\.whatsapp\.net$/.test(entry.name)).map(entry => entry.name.replace(/@s\.whatsapp\.net$/, ''));
  } catch {
    return [];
  }
}

bot.onText(/^(?:\/pairstatus|\/pairinfo)(?:\s+(\d{7,15}))?$/, requireMembership(async (msg, match) => {
  const requested = match?.[1];
  const owned = await getOwnedPairNumbers(msg.from.id);
  if (requested && !owned.includes(requested) && !isTelegramAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '❌ You can only inspect pairings owned by your Telegram account.');
  const numbers = requested ? [requested] : owned;
  if (!numbers.length) return bot.sendMessage(msg.chat.id, '📱 No pairing is recorded yet. Use /pair <country-code-number>.');
  const rows = await Promise.all(numbers.map(readPairStatus));
  const output = rows.map(row => `📱 +${row.number}\nStatus: ${row.status}\n${row.code ? `Code: ${row.code}\n` : ''}${row.expiresAt ? `Expires: ${row.expiresAt}\n` : ''}${row.lastError ? `Error: ${row.lastError}\n` : ''}${row.updatedAt ? `Updated: ${row.updatedAt}` : ''}`).join('\n\n');
  return bot.sendMessage(msg.chat.id, `📡 *Elara pairing status*\n\n${output}`, { parse_mode: 'Markdown' });
}));

bot.onText(/^\/(?:pairs|pairlist|listpair)$/, requireMembership(async (msg) => sendPairList(msg, isTelegramAdmin(msg.from.id))));

bot.onText(/\/publishtech(?:\\s+(\\d+))?$/, async (msg, match) => {
  if (!(await ensureOfficialChannelMembership(msg))) return;
  const chatId = msg.chat.id;
  if (!isTelegramAdmin(msg.from.id)) return bot.sendMessage(chatId, '❌ Owner/admin only.');
  const requestedIndex = match?.[1] ? Math.max(0, Number(match[1]) - 1) : techPostIndex;
  const published = await publishTechPost(requestedIndex);
  return bot.sendMessage(chatId, published ? `✅ Published a tech image and poll to ${TECH_CHANNEL_ID}.` : '❌ Publishing failed. Confirm Elara is an administrator in the channel with permission to post, add photos, and create polls.');
});

bot.onText(/^\/tech$/, async (msg) => {
  if (!(await ensureOfficialChannelMembership(msg))) return;
  return bot.sendMessage(msg.chat.id, `📣 *Elara Tech Channel*\\nDestination: ${TECH_CHANNEL_ID}\\nAutomatic posts: ${TECH_AUTOPUBLISH ? 'ON' : 'OFF'}\\nInterval: every ${TECH_POST_INTERVAL_MINUTES} minutes\\nContent: ${TECH_POSTS.length} rotating image-backed tech polls.\\n\\nUse /publishtech as owner to publish now.`, { parse_mode: 'Markdown' });
});

bot.onText(/^\/techschedule$/, async (msg) => {
  if (!(await ensureOfficialChannelMembership(msg))) return;
  if (!isTelegramAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '❌ Owner/admin only.');
  return bot.sendMessage(msg.chat.id, `📣 *Elara Tech Channel*\\nDestination: ${TECH_CHANNEL_ID}\\nAutomatic posts: ${TECH_AUTOPUBLISH ? 'ON' : 'OFF'}\\nInterval: every ${TECH_POST_INTERVAL_MINUTES} minutes\\nContent: ${TECH_POSTS.length} rotating image-backed tech polls.`, { parse_mode: 'Markdown' });
});

bot.onText(/^(?:\/runtime|\/uptime|\/status)\b/, async (msg) => {
  if (!(await ensureOfficialChannelMembership(msg))) return;
  const chatId = msg.chat.id;

  try {
    
    const totalSeconds = process.uptime();
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    const message = `
╭━━━〔 ⏱️ Elara 〕━━━╮

🤖 𝐁𝐨𝐭 𝐒𝐭𝐚𝐭𝐮𝐬
➤ Online & running smoothly ✅

⏳ 𝐔𝐩𝐭𝐢𝐦𝐞
➤ ${uptimeString}

⚡ 𝐏𝐞𝐫𝐟𝐨𝐫𝐦𝐚𝐧𝐜𝐞
➤ Stable • Fast • Reliable

╰━━━〔 ✦Elara✦ 〕━━━╯
`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('runtime error:', err);
    await bot.sendMessage(chatId, '❌ Failed to fetch runtime.', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }]]
      }
    });
  }
});

bot.onText(/^(?:\/help|\/commands)\b/, async (msg) => {
  if (!(await ensureOfficialChannelMembership(msg))) return;
  const chatId = msg.chat.id;

  const helpText = `
\`\`\`
╭──────────────────────────────╮
        🌄 Elara ʜᴇʟᴘ 🌄
╰──────────────────────────────╯

🆘 ʜᴇʟᴘ / ᴄᴏᴍᴍᴀɴᴅs
/ᴘᴀɪʀ       → ᴄᴏɴɴᴇᴄᴛ ᴀ ɴᴇᴡ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀ
/ᴅᴇʟᴘᴀɪʀ    → ʀᴇᴍᴏᴠᴇ ᴀ ᴘᴀɪʀᴇᴅ ɴᴜᴍʙᴇʀ
/ʀᴜɴᴛɪᴍᴇ    → ᴠɪᴇᴡ ʙᴏᴛ ᴜᴘᴛɪᴍᴇ
/ʟɪsᴛᴘᴀɪʀ   → ʟɪsᴛ ᴀʟʟ ᴘᴀɪʀᴇᴅ ɴᴜᴍʙᴇʀs
/ʜᴇʟᴘ       → sʜᴏᴡ ᴛʜɪs ʜᴇʟᴘ ᴍᴇɴᴜ
/ᴄʜᴀᴛ       → sᴇɴᴅ ᴍᴇssᴀɢᴇ ᴛᴏ ᴛʜᴇ ᴏᴡɴᴇʀ (ᴄʜᴀᴛ ᴍᴏᴅᴇ)
/ᴘᴜʙʟɪsʜᴛᴇᴄʜ → ᴘᴏsᴛ ᴀ ᴛᴇᴄʜ ɪᴍᴀɢᴇ + ᴘᴏʟʟ
/ᴛᴇᴄʜ       → ᴠɪᴇᴡ ᴛᴇᴄʜ ᴘᴜʙʟɪsʜɪɴɢ ɪɴꜰᴏ
/ᴛᴇᴄʜsᴄʜᴇᴅᴜʟᴇ → ᴠɪᴇᴡ ᴛᴇᴄʜ ᴄʜᴀɴɴᴇʟ ᴘᴏsᴛɪɴɢ
/ᴍᴇɴᴜ       → ʀᴏᴛᴀᴛɪɴɢ ᴍᴇɴᴜ ɪᴍᴀɢᴇ
/ᴘɪɴɢ       → ᴄʜᴇᴄᴋ ʀᴇsᴘᴏɴsᴇ sᴘᴇᴇᴅ
/ᴊɪᴅ        → sʜᴏᴡ ᴄʜᴀᴛ ɪᴅ
/ᴏᴡɴᴇʀ      → ᴠɪᴇᴡ ᴏᴡɴᴇʀ ᴄᴏɴᴛᴀᴄᴛ
/ᴄʜᴀɴɴᴇʟ   → ᴏᴘᴇɴ ᴏꜰꜰɪᴄɪᴀʟ ᴄʜᴀɴɴᴇʟ
/ᴀʙᴏᴜᴛ      → ᴀʙᴏᴜᴛ ᴇʟᴀʀᴀ
/ᴘᴀɪʀʜᴇʟᴘ  → ᴘᴀɪʀɪɴɢ ɢᴜɪᴅᴇ

──────────────────────────────

📖 ᴀʙᴏᴜᴛ Elara
Elara ᴠ² ɪs ᴀ sᴍᴀʀᴛ ᴀssɪsᴛᴀɴᴛ ʙᴏᴛ
ᴅᴇsɪɢɴᴇᴅ ᴛᴏ ʜᴇʟᴘ ʏᴏᴜ ᴘᴀɪʀ ᴀɴᴅ ᴍᴀɴᴀɢᴇ
ᴡʜᴀᴛsᴀᴘᴘ ᴅᴇᴠɪᴄᴇs ᴇᴀsɪʟʏ ᴜsɪɴɢ sɪᴍᴘʟᴇ
ᴄᴏᴍᴍᴀɴᴅs. 

──────────────────────────────

🔗 ʜᴏᴡ ᴛᴏ ᴘᴀɪʀ
1. ᴜsᴇ /ᴘᴀɪʀ ᴄᴏᴍᴍᴀɴᴅ
2. ᴇɴᴛᴇʀ ᴛʜᴇ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ᴘᴀɪʀ
   ᴇxᴀᴍᴘʟᴇ: /ᴘᴀɪʀ 234XXXXXXXXXX
3. ʙᴏᴛ ᴡɪʟʟ sᴇᴄᴜʀᴇʟʏ ʟɪɴᴋ ʏᴏᴜʀ ᴅᴇᴠɪᴄᴇ
4. ᴛᴏ ʀᴇᴍᴏᴠᴇ, ᴜsᴇ /ᴅᴇʟᴘᴀɪʀ ꜰᴏʟʟᴏᴡᴇᴅ ʙʏ ɴᴜᴍʙᴇʀ

──────────────────────────────

💬 ᴄʜᴀᴛ ᴍᴏᴅᴇ
1. ᴜsᴇ /ᴄʜᴀᴛ ᴄᴏᴍᴍᴀɴᴅ ᴛᴏ sᴛᴀʀᴛ ᴄʜᴀᴛ ᴍᴏᴅᴇ
2. sᴇɴᴅ ᴀɴʏ ᴍᴇssᴀɢᴇ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ʀᴇᴀᴄʜ ᴛʜᴇ ᴏᴡɴᴇʀ
3. ᴛʏᴘᴇ /ᴇxɪᴛ ᴛᴏ ʟᴇᴀᴠᴇ ᴄʜᴀᴛ ᴍᴏᴅᴇ
4. ᴏᴡɴᴇʀ ᴄᴀɴ ʀᴇᴘʟʏ ᴅɪʀᴇᴄᴛʟʏ ᴛʜʀᴏᴜɢʜ ᴛʜᴇ ʙᴏᴛ
5. ʀᴇɢᴜʟᴀʀ ᴜsᴇʀs ᴍᴜsᴛ ᴊᴏɪɴ https://t.me/elarapairgc ᴀɴᴅ https://t.me/devxtechzone ᴛᴏ ᴜsᴇ ᴄᴏᴍᴍᴀɴᴅs

──────────────────────────────

⚡ sʏsᴛᴇᴍ ɪɴꜰᴏ
ᴘᴏᴡᴇʀᴇᴅ ʙʏ Elara • ARNOLDT20
\`\`\`
`;

  await bot.sendMessage(chatId, helpText, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "❃ OWNER ❃", url: "https://t.me/StarboyT20" },
          { text: "📢 DEV CHANNEL", url: "https://t.me/elarapairgc" }
        ],
        [
          { text: "🔙 BACK", callback_data: "start_bot" }
        ]
      ]
    }
  });
});

const activeChats = {};
// Chat mode is intentionally pinned to the requested owner and never follows a different admin setting.
const CHAT_MODE_OWNER_ID = 255627417402;
const ownerId = CHAT_MODE_OWNER_ID;


bot.onText(/\/chat/, async (msg) => {
  if (!(await ensureOfficialChannelMembership(msg))) return;
  const chatId = msg.chat.id;
  activeChats[chatId] = true;

  await bot.sendMessage(chatId, `
🌹 *Elara ᴄʜᴀᴛ ᴍᴏᴅᴇ* 🌹

Yᴏᴜ ᴄᴀɴ ɴᴏᴡ sᴇɴᴅ ᴍᴇ ᴀ ᴍᴇssᴀɢᴇ dɪʀᴇᴄᴛʟʏ.
Aʟʟ ᴍᴇssᴀɢᴇs ᴡɪʟʟ ʙᴇ ꜰᴏʀᴡᴀʀᴅᴇᴅ ᴛᴏ ᴛʜᴇ ᴏᴡɴᴇʀ.

Tʏᴘᴇ /ᴇxɪᴛ ᴛᴏ ʟᴇᴀᴠᴇ ᴄʜᴀᴛ ᴍᴏᴅᴇ.
`, { parse_mode: "Markdown" });
});


bot.onText(/\/exit/, async (msg) => {
  const chatId = msg.chat.id;
  if (activeChats[chatId]) {
    delete activeChats[chatId];
    await bot.sendMessage(chatId, "✅ You have exited chat mode.", { parse_mode: "Markdown" });
  }
});


bot.onText(/\/exit/, async (msg) => {
  const chatId = msg.chat.id;
  if (activeChats[chatId]) {
    delete activeChats[chatId];
    await bot.sendMessage(chatId, "✅ Yᴏᴜ ʜᴀᴠᴇ ᴇxɪᴛᴇᴅ ᴄʜᴀᴛ ᴍᴏᴅᴇ.", { parse_mode: "Markdown" });
  }
});


bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

    const messageText = typeof msg.text === 'string' ? msg.text : '';
  if (messageText.startsWith('/')) return;
  if (activeChats[chatId]) {
    await bot.sendMessage(CHAT_MODE_OWNER_ID, `
📨 *Mᴇssᴀɢᴇ ꜰʀᴏᴍ ᴜsᴇʀ:* 
Nᴀᴍᴇ: ${msg.from.first_name}
Uѕᴇʀɴᴀᴍᴇ: @${msg.from.username || 'Nᴏᴜsᴇʀɴᴀᴍᴇ'}
ID: ${chatId}

Mᴇssᴀɢᴇ:
${messageText}
`, { parse_mode: "Markdown" });

    await bot.sendMessage(chatId, "✅ Mᴇssᴀɢᴇ sᴇɴᴛ ᴛᴏ ᴛʜᴇ ᴏᴡɴᴇʀ.", { parse_mode: "Markdown" });
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  
  if (chatId !== CHAT_MODE_OWNER_ID) return;

  
  if (msg.reply_to_message && msg.reply_to_message.text) {
    const match = msg.reply_to_message.text.match(/ID: (\d+)/);
    if (match) {
      const userId = parseInt(match[1]);

      
      await bot.sendMessage(userId, `
💬 *Rᴇᴘʟʏ ꜰʀᴏᴍ ᴏᴡɴᴇʀ:*
${msg.text}
`, { parse_mode: "Markdown" });
    }
  }
});


bot.onText(/\/listpair (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const confirmation = match[1].trim().toLowerCase();

  if (!isTelegramAdmin(msg.from.id)) {
    return bot.sendMessage(chatId, 'This command is restricted to the Elara owner only');
  }

  if (confirmation !== 'confirm') {
    return bot.sendMessage(chatId, 'Usage: /listpair confirm');
  }

  try {
    const pairingPath = path.join(__dirname, 'nexstore', 'pairing');

    if (!(await exists(pairingPath))) {
      return bot.sendMessage(chatId, '❌ No paired devices found');
    }

    const entries = await fs.readdir(pairingPath);
    if (!entries.length) {
      return bot.sendMessage(chatId, '❌ No paired devices found');
    }

    let message = '📂 *Paired Devices:*\n\n';
    entries.forEach((entry, index) => {
      message += `${index + 1}. ${entry.replace('@s.whatsapp.net', '')}\n`;
    });

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('listpair error:', err);
    await bot.sendMessage(
      chatId,
      '❌ Failed to list paired devices.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }]
          ]
        }
      }
    );
  }
});